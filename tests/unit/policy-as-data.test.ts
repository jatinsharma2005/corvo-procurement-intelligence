import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POLICY_V5,
  PolicyDocument,
  PolicyRule,
  EvaluationContext,
  evaluateCondition
} from '@corvo/policy-schema';

describe('Policy-as-Data Architecture (Part 8 & Critical Assessment Requirement)', () => {
  const baseContext: EvaluationContext = {
    item: {
      item_code: 'ITM-1041',
      description: 'Corrugated box 5 ply',
      category: 'Packaging',
      item_type: 'Material',
      is_new: false,
      standard_price: 78
    },
    requirement: {
      group_id: 'REQ-999',
      plant: 'CHK1',
      quantity: 500,
      value_inr: 39000,
      is_emergency: false,
      requirement_date: '2026-11-15',
      first_need_by: '2026-11-25',
      line_count: 1
    },
    contract: {
      has_usable_contract: false,
      has_any_applicable_contract: false,
      all_applicable_out_of_ceiling: false
    },
    history: {
      has_active_purchase_in_365d: true,
      most_recent_po_price: 78,
      first_preferred_supplier_id: 'S025'
    }
  };

  it('evaluates AST operators correctly: eq, lt, lte, gt, gte, in, contains, between', () => {
    expect(evaluateCondition({ field: 'requirement.plant', operator: 'eq', value: 'CHK1' }, baseContext)).toBe(true);
    expect(evaluateCondition({ field: 'requirement.plant', operator: 'eq', value: 'PUN1' }, baseContext)).toBe(false);

    expect(evaluateCondition({ field: 'requirement.value_inr', operator: 'lt', value: 50000 }, baseContext)).toBe(true);
    expect(evaluateCondition({ field: 'requirement.value_inr', operator: 'lt', value: 30000 }, baseContext)).toBe(false);

    expect(evaluateCondition({ field: 'item.category', operator: 'in', value: ['Packaging', 'Safety'] }, baseContext)).toBe(true);
    expect(evaluateCondition({ field: 'item.category', operator: 'in', value: ['Steel', 'Fasteners'] }, baseContext)).toBe(false);

    expect(evaluateCondition({ field: 'item.description', operator: 'contains', value: 'corrugated' }, baseContext)).toBe(true);
    expect(evaluateCondition({ field: 'requirement.value_inr', operator: 'between', value: [30000, 45000] }, baseContext)).toBe(true);
  });

  it('evaluates compound nested ALL and ANY conditions', () => {
    const complexCondition = {
      all: [
        { field: 'requirement.plant', operator: 'eq' as const, value: 'CHK1' },
        {
          any: [
            { field: 'requirement.value_inr', operator: 'lt' as const, value: 40000 },
            { field: 'requirement.is_emergency', operator: 'eq' as const, value: true }
          ]
        }
      ]
    };
    expect(evaluateCondition(complexCondition, baseContext)).toBe(true);
  });

  it('interprets a genuinely NEW policy rule via data configuration without any engine code modification', () => {
    // Under default Policy v5.0, this 39,000 INR requirement with active purchase history would match SPOT_PO (Rule 5.4).
    // Now, Procurement introduces a new rule: "For plant CHK1 and category Packaging, all purchases >= 25,000 INR must go to RFQ"
    const newRule: PolicyRule = {
      rule_id: 'RULE_NEW_CHK1_PACKAGING_RFQ',
      clause: '5.2-B',
      name: 'CHK1 Packaging Strict RFQ',
      description: 'Packaging purchases in CHK1 above 25,000 INR require RFQ sourcing quotes.',
      priority: 35, // priority 35 evaluates BEFORE Spot PO (priority 40)
      conditions: {
        all: [
          { field: 'requirement.plant', operator: 'eq', value: 'CHK1' },
          { field: 'item.category', operator: 'eq', value: 'Packaging' },
          { field: 'requirement.value_inr', operator: 'gte', value: 25000 }
        ]
      },
      outcome: {
        decision: 'SOURCING_REQUEST',
        route: 'RFQ',
        supplier_selection: {
          strategy: 'SUGGEST_RANKED',
          suggest_count: 3
        },
        requires_approval: false
      }
    };

    // Evaluate the new rule against context
    const matches = evaluateCondition(newRule.conditions, baseContext);
    expect(matches).toBe(true);
    expect(newRule.outcome.route).toBe('RFQ');
    expect(newRule.outcome.decision).toBe('SOURCING_REQUEST');

    // Verify it doesn't match for plant PUN1
    const punContext = {
      ...baseContext,
      requirement: { ...baseContext.requirement, plant: 'PUN1' }
    };
    expect(evaluateCondition(newRule.conditions, punContext)).toBe(false);
  });
});
