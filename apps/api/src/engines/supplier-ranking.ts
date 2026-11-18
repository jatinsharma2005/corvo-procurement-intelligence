import {
  Supplier,
  PurchaseHistoryRecord,
  Contract,
  SupplierRankEntry
} from '@corvo/shared-types';

export class SupplierRankingEngine {
  private suppliers: Map<string, Supplier> = new Map();
  private poHistory: PurchaseHistoryRecord[] = [];
  private contracts: Contract[] = [];

  constructor(
    suppliers: Supplier[] = [],
    poHistory: PurchaseHistoryRecord[] = [],
    contracts: Contract[] = []
  ) {
    this.setData(suppliers, poHistory, contracts);
  }

  public setData(
    suppliers: Supplier[],
    poHistory: PurchaseHistoryRecord[],
    contracts: Contract[]
  ): void {
    this.suppliers.clear();
    for (const s of suppliers) {
      this.suppliers.set(s.supplier_id, s);
    }
    this.poHistory = poHistory;
    this.contracts = contracts;
  }

  public rankSuppliers(itemCode: string, asOfDateStr: string): SupplierRankEntry[] {
    if (!itemCode || itemCode === 'NEW') return [];

    const asOfTime = new Date(asOfDateStr).getTime();
    const cutoff548Time = asOfTime - 548 * 24 * 60 * 60 * 1000;

    // Section 6.1: Active suppliers with at least one PO in 548d OR contract covering item started on/before date
    const eligibleSuppliers = new Map<
      string,
      { pos: PurchaseHistoryRecord[]; hasContract: boolean }
    >();

    // 1. PO history in 548 days
    for (const po of this.poHistory) {
      if (po.item_code !== itemCode) continue;
      const poTime = new Date(po.po_date).getTime();
      if (poTime >= cutoff548Time && poTime < asOfTime) {
        const sup = this.suppliers.get(po.supplier_id);
        if (sup && sup.status === 'Active') {
          if (!eligibleSuppliers.has(po.supplier_id)) {
            eligibleSuppliers.set(po.supplier_id, { pos: [], hasContract: false });
          }
          eligibleSuppliers.get(po.supplier_id)!.pos.push(po);
        }
      }
    }

    // 2. Contracts covering item started on or before asOfDate
    for (const c of this.contracts) {
      if (!c.lines[itemCode]) continue;
      const startTime = new Date(c.start_date).getTime();
      if (startTime <= asOfTime) {
        const sup = this.suppliers.get(c.supplier_id);
        if (sup && sup.status === 'Active') {
          if (!eligibleSuppliers.has(c.supplier_id)) {
            eligibleSuppliers.set(c.supplier_id, { pos: [], hasContract: false });
          }
          eligibleSuppliers.get(c.supplier_id)!.hasContract = true;
        }
      }
    }

    const ranked: SupplierRankEntry[] = [];

    for (const [sid, data] of eligibleSuppliers.entries()) {
      const sup = this.suppliers.get(sid)!;
      const poCount = data.pos.length;

      // Recency: 1.0 for <= 90 days, 0.5 for <= 365 days, 0.0 older
      let recency = 0.0;
      let refPrice: number | undefined = undefined;

      if (data.pos.length > 0) {
        const sortedPos = [...data.pos].sort(
          (a, b) => new Date(b.po_date).getTime() - new Date(a.po_date).getTime()
        );
        const lastPo = sortedPos[0];
        const lastPoTime = new Date(lastPo.po_date).getTime();
        const daysAgo = Math.floor((asOfTime - lastPoTime) / (24 * 60 * 60 * 1000));

        if (daysAgo <= 90) {
          recency = 1.0;
        } else if (daysAgo <= 365) {
          recency = 0.5;
        } else {
          recency = 0.0;
        }
        refPrice = lastPo.unit_price;
      }

      // If no PO in 548 days, reference price from most recent contract (6.3)
      if (refPrice === undefined && data.hasContract) {
        const matchingContracts = this.contracts.filter(
          (c) =>
            c.supplier_id === sid &&
            c.lines[itemCode] &&
            new Date(c.start_date).getTime() <= asOfTime
        );
        if (matchingContracts.length > 0) {
          matchingContracts.sort(
            (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          );
          refPrice = matchingContracts[0].lines[itemCode].rate;
        }
      }

      const freqScore = Math.min(poCount, 10) / 10.0;
      const onTimeScore = sup.on_time_pct / 100.0;
      const qualityScore = sup.quality_rating / 5.0;
      const contractScore = data.hasContract ? 1.0 : 0.0;

      // Explainable weighted formula matching Worked Examples:
      // Frequency: 25%, Recency: 25%, Contract: 15%, On-Time: 20%, Quality: 15%
      const totalScore =
        freqScore * 25.0 +
        recency * 25.0 +
        contractScore * 15.0 +
        onTimeScore * 20.0 +
        qualityScore * 15.0;

      ranked.push({
        rank: 0,
        supplier_id: sid,
        supplier_name: sup.name,
        status: sup.status,
        po_count_548d: poCount,
        recency_score: recency,
        has_contract: data.hasContract,
        on_time_pct: sup.on_time_pct,
        quality_rating: sup.quality_rating,
        total_score: Math.round(totalScore * 100) / 100,
        scores: {
          frequency: Math.round(freqScore * 25.0 * 10) / 10,
          recency: Math.round(recency * 25.0 * 10) / 10,
          contract: Math.round(contractScore * 15.0 * 10) / 10,
          on_time: Math.round(onTimeScore * 20.0 * 10) / 10,
          quality: Math.round(qualityScore * 15.0 * 10) / 10
        },
        reference_price: refPrice !== undefined ? Math.round(refPrice * 100) / 100 : undefined,
        source: data.pos.length > 0 ? 'PO History (Last 548d)' : (data.hasContract ? 'Active Rate Contract' : 'Standard Master')
      });
    }

    // Deterministic tie-breakers make supplier choice stable across runs.
    ranked.sort((a, b) =>
      b.total_score - a.total_score ||
      b.on_time_pct - a.on_time_pct ||
      b.quality_rating - a.quality_rating ||
      (a.reference_price ?? Number.MAX_SAFE_INTEGER) - (b.reference_price ?? Number.MAX_SAFE_INTEGER) ||
      a.supplier_id.localeCompare(b.supplier_id)
    );

    // Assign 1-based ranks
    ranked.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return ranked;
  }

  public getSourcingSuggestions(
    itemCode: string,
    itemCategory: string,
    asOfDateStr: string,
    targetCount: number
  ): string[] {
    if (!itemCode || itemCode === 'NEW') return [];

    const preferred = this.rankSuppliers(itemCode, asOfDateStr);
    const suggestedIds = preferred.map((p) => p.supplier_id);

    if (suggestedIds.length >= targetCount) {
      return suggestedIds.slice(0, targetCount);
    }

    // Category top-up (Section 6.4)
    // Add other Active suppliers listing item's category, best delivery and quality record first
    const categorySuppliers: Array<{ sid: string; score: number }> = [];

    for (const [sid, sup] of this.suppliers.entries()) {
      if (suggestedIds.includes(sid)) continue;
      if (sup.status !== 'Active') continue;
      if (!sup.categories.includes(itemCategory)) continue;

      const score = (sup.on_time_pct / 100.0) * 0.5 + (sup.quality_rating / 5.0) * 0.5;
      categorySuppliers.push({ sid, score });
    }

    categorySuppliers.sort((a, b) => b.score - a.score);

    for (const cs of categorySuppliers) {
      suggestedIds.push(cs.sid);
      if (suggestedIds.length >= targetCount) break;
    }

    return suggestedIds.slice(0, targetCount);
  }
}
