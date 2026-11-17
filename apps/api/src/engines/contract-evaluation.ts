import { Contract, Supplier } from '@corvo/shared-types';

export interface ApplicableContractResult {
  contract_id: string;
  supplier_id: string;
  rate: number;
  value_cap: number;
  consumed_value: number;
  remaining_ceiling: number;
  requirement_val_at_rate: number;
  has_enough_ceiling: boolean;
}

export interface ContractEvaluationResult {
  has_usable_contract: boolean;
  selected_contract?: ApplicableContractResult;
  has_any_applicable_contract: boolean;
  all_applicable_out_of_ceiling: boolean;
  lowest_applicable_rate?: number;
  all_applicable: ApplicableContractResult[];
}

export class ContractEvaluationEngine {
  private contracts: Map<string, Contract> = new Map();
  private suppliers: Map<string, Supplier> = new Map();
  // Tracks dynamic ceiling consumption during a batch run
  private dynamicConsumption: Map<string, number> = new Map();

  constructor(contracts: Contract[] = [], suppliers: Supplier[] = []) {
    this.init(contracts, suppliers);
  }

  public init(contracts: Contract[], suppliers: Supplier[]): void {
    this.contracts.clear();
    this.dynamicConsumption.clear();
    for (const c of contracts) {
      this.contracts.set(c.contract_id, { ...c });
      this.dynamicConsumption.set(c.contract_id, c.consumed_value || 0);
    }

    this.suppliers.clear();
    for (const s of suppliers) {
      this.suppliers.set(s.supplier_id, s);
    }
  }

  public resetConsumption(): void {
    for (const [cid, c] of this.contracts.entries()) {
      this.dynamicConsumption.set(cid, c.consumed_value || 0);
    }
  }

  public getConsumedValue(contractId: string): number {
    return this.dynamicConsumption.get(contractId) || 0;
  }

  public evaluateRequirement(
    itemCode: string,
    quantity: number,
    requirementDateStr: string // YYYY-MM-DD
  ): ContractEvaluationResult {
    if (itemCode === 'NEW') {
      return {
        has_usable_contract: false,
        has_any_applicable_contract: false,
        all_applicable_out_of_ceiling: false,
        all_applicable: []
      };
    }

    const reqDate = new Date(requirementDateStr).getTime();
    const applicable: ApplicableContractResult[] = [];

    for (const [cid, contract] of this.contracts.entries()) {
      const line = contract.lines[itemCode];
      if (!line) continue;

      const startDate = new Date(contract.start_date).getTime();
      const endDate = new Date(contract.end_date).getTime();

      // Check dates inclusive
      if (reqDate < startDate || reqDate > endDate) continue;

      // Check supplier active
      const supplier = this.suppliers.get(contract.supplier_id);
      if (!supplier || supplier.status !== 'Active') continue;

      const consumed = this.dynamicConsumption.get(cid) || 0;
      const remaining = contract.value_cap - consumed;
      const valAtRate = quantity * line.rate;
      const hasRoom = (consumed + valAtRate) <= contract.value_cap;

      applicable.push({
        contract_id: cid,
        supplier_id: contract.supplier_id,
        rate: line.rate,
        value_cap: contract.value_cap,
        consumed_value: consumed,
        remaining_ceiling: remaining,
        requirement_val_at_rate: valAtRate,
        has_enough_ceiling: hasRoom
      });
    }

    if (applicable.length === 0) {
      return {
        has_usable_contract: false,
        has_any_applicable_contract: false,
        all_applicable_out_of_ceiling: false,
        all_applicable: []
      };
    }

    // Sort by lowest rate
    applicable.sort((a, b) => a.rate - b.rate);
    const lowestRate = applicable[0].rate;

    const usable = applicable.filter((a) => a.has_enough_ceiling);
    if (usable.length > 0) {
      // Pick lowest rate that still has room (Section 4.3)
      usable.sort((a, b) => a.rate - b.rate);
      const selected = usable[0];

      return {
        has_usable_contract: true,
        selected_contract: selected,
        has_any_applicable_contract: true,
        all_applicable_out_of_ceiling: false,
        lowest_applicable_rate: lowestRate,
        all_applicable: applicable
      };
    }

    // All applicable contracts are out of ceiling
    return {
      has_usable_contract: false,
      has_any_applicable_contract: true,
      all_applicable_out_of_ceiling: true,
      lowest_applicable_rate: lowestRate,
      all_applicable: applicable
    };
  }

  public consumeCeiling(contractId: string, amount: number): void {
    const current = this.dynamicConsumption.get(contractId) || 0;
    this.dynamicConsumption.set(contractId, current + amount);
  }
}
