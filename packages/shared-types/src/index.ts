// Core Entity Types

export type PlantCode = 'PUN1' | 'CHK1' | string;
export type ItemType = 'Material' | 'Service' | 'Capex';
export type SupplierStatus = 'Active' | 'Blocked' | 'Inactive';
export type UrgencyLevel = 'Normal' | 'Emergency';

export interface Plant {
  plant: PlantCode;
  name: string;
}

export interface Item {
  item_code: string;
  description: string;
  uom: string;
  category: string;
  item_type: ItemType;
  standard_price: number;
}

export interface Supplier {
  supplier_id: string;
  name: string;
  city: string;
  categories: string[];
  status: SupplierStatus;
  on_time_pct: number;
  quality_rating: number;
}

export interface PurchaseHistoryRecord {
  po_number: string;
  po_date: string; // YYYY-MM-DD
  supplier_id: string;
  item_code: string;
  quantity: number;
  uom: string;
  unit_price: number;
  plant: PlantCode;
  delivered_on_time: boolean;
}

export interface ContractLine {
  item_code: string;
  description: string;
  uom: string;
  rate: number;
}

export interface Contract {
  contract_id: string;
  supplier_id: string;
  supplier_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  value_cap: number;
  consumed_value: number;
  lines: Record<string, ContractLine>; // key: item_code
  is_pdf_only?: boolean;
  document_url?: string;
}

// Purchase Request Types
export interface PurchaseRequestLine {
  pr_no: string;
  pr_line: number;
  created_at: string; // YYYY-MM-DD HH:mm or ISO
  requester: string;
  department: string;
  plant: PlantCode;
  item_code?: string;
  description: string;
  quantity: number;
  uom: string;
  estimated_unit_price?: number;
  need_by_date: string; // YYYY-MM-DD
  urgency: UrgencyLevel;
  resolved_item_code?: string;
  group_id?: string;
}

export interface RequirementGroup {
  group_id: string;
  resolved_item_code: string;
  plant: PlantCode;
  first_created_at: string;
  first_need_by: string;
  is_emergency: boolean;
  total_quantity: number;
  lines: PurchaseRequestLine[];
  estimated_value_inr?: number;
  valuation_basis?: string;
  decision?: ProcurementDecision;
}

// Decision & Route Types
export type DecisionType = 'PO' | 'SOURCING_REQUEST';

export type DecisionRoute =
  | 'CONTRACT_PO'
  | 'EMERGENCY_PO'
  | 'SPOT_PO'
  | 'RFQ'
  | 'RFP'
  | 'CAPEX_SOURCING'
  | 'NEW_ITEM_SOURCING'
  | 'NOT_PROCESSED';

export interface ProcurementDecision {
  group_id: string;
  resolved_item_code: string;
  plant: PlantCode;
  total_quantity: number;
  group_value_inr: number;
  decision: DecisionType;
  route: DecisionRoute;
  supplier_id?: string;
  supplier_name?: string;
  unit_price?: number;
  po_id?: string;
  suggested_supplier_ids: string[];
  policy_version: string;
  clause: string;
  reason: string;
  rule_id?: string;
  calculation_breakdown?: {
    total_quantity: number;
    unit_price: number;
    valuation_basis: string;
    applicable_contracts?: Array<{
      contract_id: string;
      rate: number;
      remaining_ceiling: number;
      usable: boolean;
    }>;
    recent_po?: {
      po_number: string;
      po_date: string;
      price: number;
    };
    preferred_suppliers_considered?: Array<{
      supplier_id: string;
      name: string;
      score: number;
      rank: number;
    }>;
  };
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'OVERRIDDEN';
  approved_by?: string;
  approved_at?: string;
  override_details?: {
    original_decision: DecisionType;
    original_route: DecisionRoute;
    original_supplier_id?: string;
    new_decision: DecisionType;
    new_route: DecisionRoute;
    new_supplier_id?: string;
    reason: string;
    overridden_by: string;
    overridden_at: string;
  };
}

// Preferred Supplier Ranking Types
export interface SupplierRankEntry {
  rank: number;
  supplier_id: string;
  supplier_name: string;
  status: SupplierStatus;
  po_count_548d: number;
  recency_score: number;
  has_contract: boolean;
  on_time_pct: number;
  quality_rating: number;
  total_score: number;
  reference_price?: number;
}

export interface PreferredSupplierList {
  item_code: string;
  item_description: string;
  as_of_date: string;
  rankings: SupplierRankEntry[];
}

// PO & Sourcing Request Models
export interface PurchaseOrder {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  plant: PlantCode;
  route: DecisionRoute;
  first_created_at: string;
  requirements: string[]; // group_ids
  total_value_inr: number;
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED';
  created_at: string;
}

export interface SourcingRequest {
  sr_id: string;
  group_id: string;
  item_code: string;
  plant: PlantCode;
  route: 'RFQ' | 'RFP' | 'CAPEX_SOURCING' | 'NEW_ITEM_SOURCING';
  suggested_supplier_ids: string[];
  estimated_value_inr: number;
  status: 'OPEN' | 'QUOTING' | 'AWARDED' | 'CANCELLED';
  created_at: string;
}

// User & Auth
export type UserRole = 'EMPLOYEE' | 'BUYER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  plant?: PlantCode;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    extracted_pr?: Partial<PurchaseRequestLine>;
    missing_fields?: string[];
    candidate_items?: Item[];
    is_confirmed?: boolean;
    created_pr_no?: string;
  };
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// Audit Log
export interface AuditLog {
  id: string;
  entity_type: 'POLICY' | 'DECISION' | 'CONTRACT' | 'PR_BATCH' | 'PURCHASE_ORDER' | 'SOURCING_REQUEST';
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'APPROVE' | 'OVERRIDE' | 'DELETE' | 'ACTIVATE';
  actor: {
    user_id: string;
    name: string;
    role: UserRole;
  };
  details: Record<string, any>;
  timestamp: string;
}

// CSV Export Row Formats (Exact Required Schemas)
export interface DecisionCSVRow {
  pr_no: string;
  pr_line: number;
  resolved_item_code: string;
  group_id: string;
  po_id: string;
  decision: DecisionType;
  route: DecisionRoute;
  supplier_id: string;
  unit_price: string | number;
  group_value_inr: number;
  suggested_supplier_ids: string;
  policy_version: string;
  reason: string;
}

export interface PreferredSupplierCSVRow {
  item_code: string;
  rank: number;
  supplier_id: string;
  reference_price: number | string;
}
