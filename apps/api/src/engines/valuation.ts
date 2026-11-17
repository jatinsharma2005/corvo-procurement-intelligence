import { Item, PurchaseHistoryRecord } from '@corvo/shared-types';
import { ContractEvaluationResult } from './contract-evaluation';

export interface ValuationResult {
  unit_price: number;
  requirement_value_inr: number;
  valuation_basis: string;
  source_reference?: string;
}

export function valueRequirement(
  itemCode: string,
  totalQuantity: number,
  requirementDateStr: string,
  itemMaster?: Item,
  contractEval?: ContractEvaluationResult,
  poHistory: PurchaseHistoryRecord[] = [],
  requesterEstimate?: number
): ValuationResult {
  const reqDate = new Date(requirementDateStr).getTime();

  // 1. Unknown / NEW item
  if (itemCode === 'NEW' || !itemMaster) {
    const estPrice = requesterEstimate || 0;
    const value = Math.round(totalQuantity * estPrice * 100) / 100;
    return {
      unit_price: estPrice,
      requirement_value_inr: value,
      valuation_basis: 'Requester estimated unit price (New Item)'
    };
  }

  // 2. Usable contract rate (Priority 1a)
  if (contractEval?.has_usable_contract && contractEval.selected_contract) {
    const rate = contractEval.selected_contract.rate;
    const value = Math.round(totalQuantity * rate * 100) / 100;
    return {
      unit_price: rate,
      requirement_value_inr: value,
      valuation_basis: `Rate contract ${contractEval.selected_contract.contract_id}`,
      source_reference: contractEval.selected_contract.contract_id
    };
  }

  // 3. Lowest applicable contract rate when all are out of ceiling (Priority 1b)
  if (contractEval?.all_applicable_out_of_ceiling && contractEval.lowest_applicable_rate !== undefined) {
    const rate = contractEval.lowest_applicable_rate;
    const value = Math.round(totalQuantity * rate * 100) / 100;
    return {
      unit_price: rate,
      requirement_value_inr: value,
      valuation_basis: 'Lowest applicable contract rate (Ceiling exceeded)',
      source_reference: contractEval.all_applicable[0]?.contract_id
    };
  }

  // 4. Most recent PO in 365 days before requirement date (Priority 2)
  const cutoff365 = reqDate - 365 * 24 * 60 * 60 * 1000;
  const recentPOs = poHistory.filter((po) => {
    if (po.item_code !== itemCode) return false;
    const poTime = new Date(po.po_date).getTime();
    return poTime >= cutoff365 && poTime < reqDate;
  });

  if (recentPOs.length > 0) {
    recentPOs.sort((a, b) => new Date(b.po_date).getTime() - new Date(a.po_date).getTime());
    const mostRecent = recentPOs[0];
    const rate = mostRecent.unit_price;
    const value = Math.round(totalQuantity * rate * 100) / 100;
    return {
      unit_price: rate,
      requirement_value_inr: value,
      valuation_basis: `Most recent PO ${mostRecent.po_number} (${mostRecent.po_date})`,
      source_reference: mostRecent.po_number
    };
  }

  // 5. Item master standard price (Priority 3)
  const stdPrice = itemMaster.standard_price;
  const value = Math.round(totalQuantity * stdPrice * 100) / 100;
  return {
    unit_price: stdPrice,
    requirement_value_inr: value,
    valuation_basis: 'Item master standard price',
    source_reference: itemMaster.item_code
  };
}
