import { z } from 'zod';

export type Operator =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'between'
  | 'date_before'
  | 'date_after';

export const OperatorSchema = z.enum([
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'not_in',
  'contains',
  'between',
  'date_before',
  'date_after'
]);

export interface FieldCondition {
  field: string;
  operator: Operator;
  value: any;
}

export interface CompoundCondition {
  all?: Condition[];
  any?: Condition[];
}

export type Condition = FieldCondition | CompoundCondition;

export const FieldConditionSchema = z.object({
  field: z.string(),
  operator: OperatorSchema,
  value: z.any()
});

export const ConditionSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    FieldConditionSchema,
    z.object({
      all: z.array(z.lazy(() => ConditionSchema)).optional(),
      any: z.array(z.lazy(() => ConditionSchema)).optional()
    })
  ])
);

export const DecisionRouteSchema = z.enum([
  'CONTRACT_PO',
  'EMERGENCY_PO',
  'SPOT_PO',
  'RFQ',
  'RFP',
  'CAPEX_SOURCING',
  'NEW_ITEM_SOURCING',
  'NOT_PROCESSED'
]);

export const SupplierSelectionSchema = z.object({
  strategy: z.enum(['CONTRACT_SUPPLIER', 'FIRST_PREFERRED', 'SUGGEST_RANKED', 'NONE']),
  suggest_count: z.number().int().positive().optional(),
  price_basis: z.enum(['CONTRACT_RATE', 'REFERENCE_PRICE', 'NONE']).optional()
});

export const PolicyOutcomeSchema = z.object({
  decision: z.enum(['PO', 'SOURCING_REQUEST']),
  route: DecisionRouteSchema,
  supplier_selection: SupplierSelectionSchema,
  requires_approval: z.boolean().optional().default(false),
  approval_type: z.string().optional()
});

export type PolicyOutcome = z.infer<typeof PolicyOutcomeSchema>;

export const PolicyRuleSchema = z.object({
  rule_id: z.string(),
  clause: z.string(),
  name: z.string(),
  description: z.string(),
  priority: z.number().int(),
  conditions: ConditionSchema,
  outcome: PolicyOutcomeSchema,
  metadata: z.record(z.any()).optional()
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicyParametersSchema = z.object({
  clubbing_window_days: z.number().default(14),
  clubbing_need_by_window_days: z.number().default(7),
  po_consolidation_window_hours: z.number().default(24),
  purchase_history_recency_days: z.number().default(365),
  preferred_supplier_window_days: z.number().default(548)
});

export type PolicyParameters = z.infer<typeof PolicyParametersSchema>;

export const PolicyDocumentSchema = z.object({
  version: z.string(),
  document_number: z.string(),
  title: z.string(),
  effective_date: z.string(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED', 'APPROVED']),
  parameters: PolicyParametersSchema,
  rules: z.array(PolicyRuleSchema),
  created_at: z.string(),
  approved_at: z.string().optional(),
  approved_by: z.string().optional(),
  amendment_summary: z.string().optional()
});

export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

// Evaluation Context
export interface EvaluationContext {
  item: {
    item_code: string;
    description: string;
    category: string;
    item_type: 'Material' | 'Service' | 'Capex';
    is_new: boolean;
    standard_price: number;
  };
  requirement: {
    group_id: string;
    plant: string;
    quantity: number;
    value_inr: number;
    is_emergency: boolean;
    requirement_date: string;
    first_need_by: string;
    line_count: number;
  };
  contract: {
    has_usable_contract: boolean;
    usable_contract_id?: string;
    usable_contract_rate?: number;
    usable_contract_supplier_id?: string;
    has_any_applicable_contract: boolean;
    all_applicable_out_of_ceiling: boolean;
    lowest_applicable_contract_rate?: number;
  };
  history: {
    has_active_purchase_in_365d: boolean;
    most_recent_po_price?: number;
    first_preferred_supplier_id?: string;
    first_preferred_reference_price?: number;
  };
  custom?: Record<string, any>;
}

export function getContextValue(context: EvaluationContext, path: string): any {
  const parts = path.split('.');
  let current: any = context;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

export function evaluateCondition(condition: Condition, context: EvaluationContext): boolean {
  if ('all' in condition && Array.isArray(condition.all)) {
    return condition.all.every((child) => evaluateCondition(child, context));
  }
  if ('any' in condition && Array.isArray(condition.any)) {
    return condition.any.some((child) => evaluateCondition(child, context));
  }

  const fc = condition as FieldCondition;
  const actual = getContextValue(context, fc.field);
  const target = fc.value;

  switch (fc.operator) {
    case 'eq':
      return actual === target;
    case 'neq':
      return actual !== target;
    case 'lt':
      return typeof actual === 'number' && actual < target;
    case 'lte':
      return typeof actual === 'number' && actual <= target;
    case 'gt':
      return typeof actual === 'number' && actual > target;
    case 'gte':
      return typeof actual === 'number' && actual >= target;
    case 'in':
      return Array.isArray(target) && target.includes(actual);
    case 'not_in':
      return Array.isArray(target) && !target.includes(actual);
    case 'contains':
      if (typeof actual === 'string' && typeof target === 'string') {
        return actual.toLowerCase().includes(target.toLowerCase());
      }
      if (Array.isArray(actual)) {
        return actual.includes(target);
      }
      return false;
    case 'between':
      if (Array.isArray(target) && target.length === 2 && typeof actual === 'number') {
        return actual >= target[0] && actual <= target[1];
      }
      return false;
    case 'date_before':
      return new Date(actual) < new Date(target);
    case 'date_after':
      return new Date(actual) > new Date(target);
    default:
      return false;
  }
}

export const DEFAULT_POLICY_V5: PolicyDocument = {
  version: '5.0',
  document_number: 'CORVO-PROC-POL-04',
  title: 'Corvo Engineering Procurement Policy (PR to PO)',
  effective_date: '2026-04-01',
  status: 'ACTIVE',
  parameters: {
    clubbing_window_days: 14,
    clubbing_need_by_window_days: 7,
    po_consolidation_window_hours: 24,
    purchase_history_recency_days: 365,
    preferred_supplier_window_days: 548
  },
  rules: [
    {
      rule_id: 'RULE_1_2_NEW_ITEM',
      clause: '1.2',
      name: 'New Item Sourcing',
      description: 'A line that matches no item master item is a new item and always goes to sourcing.',
      priority: 5,
      conditions: {
        field: 'item.is_new',
        operator: 'eq',
        value: true
      },
      outcome: {
        decision: 'SOURCING_REQUEST',
        route: 'NEW_ITEM_SOURCING',
        supplier_selection: {
          strategy: 'NONE'
        },
        requires_approval: false
      }
    },
    {
      rule_id: 'RULE_5_1_CAPEX',
      clause: '5.1',
      name: 'Capex Sourcing',
      description: 'The item type is Capex. Goes to sourcing with 5 suggested suppliers.',
      priority: 10,
      conditions: {
        field: 'item.item_type',
        operator: 'eq',
        value: 'Capex'
      },
      outcome: {
        decision: 'SOURCING_REQUEST',
        route: 'CAPEX_SOURCING',
        supplier_selection: {
          strategy: 'SUGGEST_RANKED',
          suggest_count: 5
        },
        requires_approval: true,
        approval_type: 'CAPEX_APPROVAL'
      }
    },
    {
      rule_id: 'RULE_5_2_CONTRACT_PO',
      clause: '5.2',
      name: 'Rate Contract PO',
      description: 'A usable rate contract exists for the item within valid dates and ceiling.',
      priority: 20,
      conditions: {
        field: 'contract.has_usable_contract',
        operator: 'eq',
        value: true
      },
      outcome: {
        decision: 'PO',
        route: 'CONTRACT_PO',
        supplier_selection: {
          strategy: 'CONTRACT_SUPPLIER',
          price_basis: 'CONTRACT_RATE'
        },
        requires_approval: false
      }
    },
    {
      rule_id: 'RULE_5_3_EMERGENCY_PO',
      clause: '5.3',
      name: 'Emergency Purchase Order',
      description: 'Emergency requirement, value <= ₹5,00,000, bought from Active supplier in last 365 days.',
      priority: 30,
      conditions: {
        all: [
          { field: 'requirement.is_emergency', operator: 'eq', value: true },
          { field: 'requirement.value_inr', operator: 'lte', value: 500000 },
          { field: 'history.has_active_purchase_in_365d', operator: 'eq', value: true }
        ]
      },
      outcome: {
        decision: 'PO',
        route: 'EMERGENCY_PO',
        supplier_selection: {
          strategy: 'FIRST_PREFERRED',
          price_basis: 'REFERENCE_PRICE'
        },
        requires_approval: false
      }
    },
    {
      rule_id: 'RULE_5_4_SPOT_PO',
      clause: '5.4',
      name: 'Spot Purchase Order',
      description: 'Value below ₹2,00,000, and item was bought from an Active supplier in the last 365 days.',
      priority: 40,
      conditions: {
        all: [
          { field: 'requirement.value_inr', operator: 'lt', value: 200000 },
          { field: 'history.has_active_purchase_in_365d', operator: 'eq', value: true }
        ]
      },
      outcome: {
        decision: 'PO',
        route: 'SPOT_PO',
        supplier_selection: {
          strategy: 'FIRST_PREFERRED',
          price_basis: 'REFERENCE_PRICE'
        },
        requires_approval: false
      }
    },
    {
      rule_id: 'RULE_5_5_RFQ',
      clause: '5.5',
      name: 'Request For Quotation (RFQ)',
      description: 'Value below ₹10,00,000 (including small items never bought in last 365 days). Suggest 3 suppliers.',
      priority: 50,
      conditions: {
        field: 'requirement.value_inr',
        operator: 'lt',
        value: 1000000
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
    },
    {
      rule_id: 'RULE_5_6_RFP',
      clause: '5.6',
      name: 'Request For Proposal (RFP)',
      description: 'Value ₹10,00,000 or more. Formal RFP with 5 suggested suppliers.',
      priority: 60,
      conditions: {
        field: 'requirement.value_inr',
        operator: 'gte',
        value: 1000000
      },
      outcome: {
        decision: 'SOURCING_REQUEST',
        route: 'RFP',
        supplier_selection: {
          strategy: 'SUGGEST_RANKED',
          suggest_count: 5
        },
        requires_approval: false
      }
    }
  ],
  created_at: '2026-04-01T00:00:00Z',
  approved_at: '2026-04-01T00:00:00Z',
  approved_by: 'Head of Procurement'
};
