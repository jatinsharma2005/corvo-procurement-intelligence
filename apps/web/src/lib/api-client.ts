const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const errorJson = await res.json();
        errorMsg = errorJson.error || errorJson.message || errorMsg;
      } catch {
        // fallback
      }
      throw new Error(errorMsg);
    }

    // Check content type
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  // Dashboard
  async getDashboardSummary() {
    return this.request<{
      metrics: {
        total_pr_lines: number;
        total_requirements: number;
        total_purchase_orders: number;
        total_sourcing_requests: number;
        total_procurement_value_inr: number;
        pending_approvals: number;
        active_policy_version: string;
      };
      distributions: {
        plants: Record<string, number>;
        routes: Record<string, number>;
      };
      recent_activity: any[];
    }>('/dashboard/summary');
  }

  // Batch Processing
  async processBatchCSV(file: File | FormData | string, policyVersion?: string) {
    let body: any;
    let headers: Record<string, string> = {};

    if (file instanceof FormData) {
      body = file;
    } else if (file instanceof File) {
      const formData = new FormData();
      formData.append('file', file);
      body = formData;
    } else {
      body = JSON.stringify({ csv: file, policy_version: policyVersion });
      headers['Content-Type'] = 'application/json';
    }

    const query = policyVersion ? `?policy_version=${encodeURIComponent(policyVersion)}` : '';
    return this.request<{
      success: boolean;
      batch_id: string;
      policy_version: string;
      summary: {
        total_pr_lines: number;
        total_requirement_groups: number;
        total_purchase_orders: number;
        total_sourcing_requests: number;
        total_procurement_value_inr: number;
      };
      decisions: any[];
      requirements: any[];
      csv_rows: any[];
    }>(`/process-batch${query}`, {
      method: 'POST',
      body,
      headers,
    });
  }

  async getBatches() {
    return this.request<{ batches: any[] }>('/batches');
  }

  // Procurement Requirements & Decisions
  async getRequirements(params?: { plant?: string; status?: string; search?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.plant) qs.append('plant', params.plant);
    if (params?.status) qs.append('status', params.status);
    if (params?.search) qs.append('search', params.search);
    if (params?.limit) qs.append('limit', String(params.limit));
    return this.request<{ requirements: any[] }>(`/procurement/requirements?${qs.toString()}`);
  }

  async getRequirementDetails(id: string) {
    return this.request<{ requirement: any; decision: any; lines: any[] }>(`/procurement/requirements/${id}`);
  }

  async getDecisions(params?: { route?: string; decision?: string; status?: string; search?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.route) qs.append('route', params.route);
    if (params?.decision) qs.append('decision', params.decision);
    if (params?.status) qs.append('status', params.status);
    if (params?.search) qs.append('search', params.search);
    if (params?.limit) qs.append('limit', String(params.limit));
    return this.request<{ decisions: any[] }>(`/procurement/decisions?${qs.toString()}`);
  }

  async approveDecision(id: string) {
    return this.request<{ success: boolean; decision: any }>(`/procurement/decisions/${id}/approve`, {
      method: 'POST',
    });
  }

  async overrideDecision(id: string, payload: {
    new_decision: 'PO' | 'SOURCING_REQUEST';
    new_route: string;
    new_supplier_id?: string;
    reason: string;
  }) {
    return this.request<{ success: boolean; decision: any }>(`/procurement/decisions/${id}/override`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Policies
  async getPolicies() {
    return this.request<{ policies: any[] }>('/policies');
  }

  async getActivePolicy() {
    return this.request<{ policy: any }>('/policies/active');
  }

  async uploadPolicyAmendment(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{
      success: boolean;
      draft_policy: any;
      proposal: any;
      diff: any;
    }>('/policies/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async submitPolicyDraft(amendment_text: string) {
    return this.request<{
      success: boolean;
      draft_policy: any;
      proposal: any;
      diff: any;
    }>('/policies/draft', {
      method: 'POST',
      body: JSON.stringify({ amendment_text }),
    });
  }

  async approvePolicy(version: string) {
    return this.request<{ success: boolean; policy: any }>(`/policies/${encodeURIComponent(version)}/approve`, {
      method: 'POST',
    });
  }

  async getPolicyDiff(version: string) {
    return this.request<{ diff: any }>(`/policies/${encodeURIComponent(version)}/diff`);
  }

  // Contracts
  async getContracts() {
    return this.request<{ contracts: any[] }>('/contracts');
  }

  async getContract(id: string) {
    return this.request<{ contract: any }>(`/contracts/${id}`);
  }

  async uploadContractPDF(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{
      success: boolean;
      extracted_contract: any;
      message: string;
    }>('/contracts/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async saveContract(contract: any) {
    return this.request<{ success: boolean; contract: any }>('/contracts', {
      method: 'POST',
      body: JSON.stringify({ contract }),
    });
  }

  // Suppliers
  async getSuppliers(params?: { status?: string; category?: string; search?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    if (params?.category) qs.append('category', params.category);
    if (params?.search) qs.append('search', params.search);
    return this.request<{ suppliers: any[] }>(`/suppliers?${qs.toString()}`);
  }

  async getSupplierDetails(id: string) {
    return this.request<{ supplier: any; recent_pos: any[]; contracts: any[] }>(`/suppliers/${id}`);
  }

  async getSupplierRankings(itemCode: string, asOfDate: string = '2026-11-01') {
    return this.request<{
      item_code: string;
      as_of_date: string;
      rankings: Array<{
        rank: number;
        supplier_id: string;
        name: string;
        total_score: number;
        scores: {
          frequency: number;
          recency: number;
          contract: number;
          on_time: number;
          quality: number;
        };
        reference_price: number;
        source: string;
      }>;
    }>(`/suppliers/rankings?item_code=${encodeURIComponent(itemCode)}&as_of_date=${encodeURIComponent(asOfDate)}`);
  }

  // Chat
  async sendChatMessage(content: string, conversationId?: string) {
    return this.request<{
      conversation_id: string;
      message: string;
      extracted: any;
      candidate_items: any[];
    }>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ content, conversation_id: conversationId }),
    });
  }

  async confirmPurchaseRequest(conversationId: string, prData: any) {
    return this.request<{ success: boolean; purchase_request: any }>('/chat/confirm', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, pr_data: prData }),
    });
  }

  // Audit Logs
  async getAuditLogs(limit: number = 50) {
    return this.request<{ logs: any[] }>(`/audit/logs?limit=${limit}`);
  }

  // Export URLs
  getDecisionsExportUrl(batchId?: string) {
    const qs = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    return `${API_BASE_URL}/export/decisions${qs}`;
  }

  getPreferredSuppliersExportUrl(asOfDate: string = '2026-11-01') {
    return `${API_BASE_URL}/export/preferred-suppliers?as_of_date=${encodeURIComponent(asOfDate)}`;
  }
}

export const api = new ApiClient();
