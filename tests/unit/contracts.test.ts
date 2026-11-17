import { describe, it, expect, beforeEach } from 'vitest';
import { ContractEvaluationEngine } from '../../apps/api/src/engines/contract-evaluation';
import { Contract, Supplier } from '@corvo/shared-types';

describe('Contract Evaluation Engine (Policy Section 4)', () => {
  let engine: ContractEvaluationEngine;

  const mockSuppliers: Supplier[] = [
    { supplier_id: 'S001', name: 'Active Supplier', city: 'Pune', categories: ['Fasteners'], status: 'Active', on_time_pct: 90, quality_rating: 4.5 },
    { supplier_id: 'S002', name: 'Blocked Supplier', city: 'Pune', categories: ['Fasteners'], status: 'Blocked', on_time_pct: 85, quality_rating: 4.0 }
  ];

  const mockContracts: Contract[] = [
    {
      contract_id: 'RC-101',
      supplier_id: 'S001',
      supplier_name: 'Active Supplier',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      value_cap: 100000,
      consumed_value: 90000, // 10,000 ceiling remaining
      lines: {
        'ITM-1001': { rate: 10, description: 'Part A', uom: 'NOS' }
      }
    },
    {
      contract_id: 'RC-102',
      supplier_id: 'S002', // Blocked supplier
      supplier_name: 'Blocked Supplier',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      value_cap: 500000,
      consumed_value: 0,
      lines: {
        'ITM-1001': { rate: 8, description: 'Part A', uom: 'NOS' }
      }
    }
  ];

  beforeEach(() => {
    engine = new ContractEvaluationEngine(mockContracts, mockSuppliers);
  });

  it('selects usable contract within ceiling', () => {
    const res = engine.evaluateRequirement('ITM-1001', 500, '2026-11-01'); // 500 * 10 = 5000 <= 10000
    expect(res.has_usable_contract).toBe(true);
    expect(res.selected_contract?.contract_id).toBe('RC-101');
    expect(res.selected_contract?.rate).toBe(10);
  });

  it('detects when requirement exceeds remaining ceiling (Section 4.2)', () => {
    const res = engine.evaluateRequirement('ITM-1001', 1500, '2026-11-01'); // 1500 * 10 = 15000 > 10000
    expect(res.has_usable_contract).toBe(false);
    expect(res.all_applicable_out_of_ceiling).toBe(true);
    expect(res.lowest_applicable_rate).toBe(10);
  });

  it('never uses contracts from Blocked or Inactive suppliers (Section 5.7)', () => {
    // S002 is blocked, RC-102 must never be considered
    const res = engine.evaluateRequirement('ITM-1001', 100, '2026-11-01');
    expect(res.all_applicable.some((a) => a.supplier_id === 'S002')).toBe(false);
  });
});
