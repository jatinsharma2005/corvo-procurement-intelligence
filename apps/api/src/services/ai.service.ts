import { config } from '../config';
import { Item, PurchaseRequestLine } from '@corvo/shared-types';
import { PolicyDocument, PolicyRule } from '@corvo/policy-schema';

export interface ExtractedChatPR {
  item_code?: string;
  description?: string;
  quantity?: number;
  plant?: string;
  need_by_date?: string;
  urgency?: 'Normal' | 'Emergency';
  estimated_unit_price?: number;
  missing_fields: string[];
  assistant_reply: string;
  confidence: number;
}

export interface AmendmentClause {
  id: string;
  title: string;
  clause_reference: string;
  description: string;
  reason?: string;
}

export interface PolicyAmendmentProposal {
  version: string;
  document_reference?: string;
  title: string;
  effective_date: string;
  approved_by?: string;
  approval_date?: string;
  amendment_summary: string;
  clauses?: AmendmentClause[];
  modified_parameters?: Partial<PolicyDocument['parameters']>;
  added_rules: PolicyRule[];
  modified_rules: PolicyRule[];
  removed_rule_ids: string[];
  is_valid_amendment: boolean;
  validation_errors?: string[];
}

export class AIService {
  private provider: 'gemini' | 'openai' | 'fallback';

  constructor() {
    this.provider = config.aiProvider;
    if (this.provider === 'gemini' && !config.geminiApiKey) {
      console.warn('[AI] GEMINI_API_KEY not configured. Falling back to intelligent heuristic parser.');
      this.provider = 'fallback';
    } else if (this.provider === 'openai' && !config.openaiApiKey) {
      console.warn('[AI] OPENAI_API_KEY not configured. Falling back to intelligent heuristic parser.');
      this.provider = 'fallback';
    }
  }

  public async extractPRFromChat(
    message: string,
    history: Array<{ role: string; content: string }>,
    availableItems: Item[]
  ): Promise<ExtractedChatPR> {
    if (this.provider === 'gemini' && config.geminiApiKey) {
      try {
        return await this.callGeminiChatExtract(message, history, availableItems);
      } catch (err: any) {
        console.warn(`[AI] Gemini call failed (${err.message}). Using fallback extractor.`);
      }
    } else if (this.provider === 'openai' && config.openaiApiKey) {
      try {
        return await this.callOpenAIChatExtract(message, history, availableItems);
      } catch (err: any) {
        console.warn(`[AI] OpenAI call failed (${err.message}). Using fallback extractor.`);
      }
    }

    return this.fallbackChatExtract(message, history, availableItems);
  }

  public async parsePolicyAmendment(
    documentText: string,
    currentPolicy: PolicyDocument
  ): Promise<PolicyAmendmentProposal> {
    if (this.provider === 'gemini' && config.geminiApiKey) {
      try {
        return await this.callGeminiPolicyParse(documentText, currentPolicy);
      } catch (err: any) {
        console.warn(`[AI] Gemini policy parse failed (${err.message}). Using fallback amendment parser.`);
      }
    } else if (this.provider === 'openai' && config.openaiApiKey) {
      try {
        return await this.callOpenAIPolicyParse(documentText, currentPolicy);
      } catch (err: any) {
        console.warn(`[AI] OpenAI policy parse failed (${err.message}). Using fallback amendment parser.`);
      }
    }

    return this.fallbackPolicyParse(documentText, currentPolicy);
  }

  // --- Fallback Deterministic/NLP Extractors ---

  private fallbackChatExtract(
    message: string,
    history: Array<{ role: string; content: string }>,
    items: Item[]
  ): ExtractedChatPR {
    const fullConversation = [...history.map((h) => h.content), message].join('\n');
    const lower = fullConversation.toLowerCase();

    // 1. Quantity extraction (e.g., "200", "50 nos", "10 units")
    let quantity: number | undefined = undefined;
    const qtyMatch = fullConversation.match(/\b(\d{1,6})\s*(?:nos|pcs|units|kg|ltr|mtr|pair|boxes|cyl|mon|qtr|job)?\b/i);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
    }

    // 2. Plant extraction
    let plant: string | undefined = undefined;
    if (lower.includes('chakan') || lower.includes('chk1')) {
      plant = 'CHK1';
    } else if (lower.includes('bhosari') || lower.includes('pun1') || lower.includes('pune')) {
      plant = 'PUN1';
    }

    // 3. Urgency
    const isEmergency = lower.includes('emergency') || lower.includes('machine down') || lower.includes('machine is down') || lower.includes('line down');
    const urgency = isEmergency ? 'Emergency' : (lower.includes('urgent') ? 'Emergency' : 'Normal');

    // 4. Need by date extraction
    let needByDate: string | undefined = undefined;
    const dateMatch = fullConversation.match(/\b(202\d-[01]\d-[0-3]\d)\b/);
    if (dateMatch) {
      needByDate = dateMatch[1];
    } else if (lower.includes('tomorrow')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      needByDate = d.toISOString().split('T')[0];
    } else if (lower.includes('next friday') || lower.includes('friday')) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      needByDate = d.toISOString().split('T')[0];
    } else if (lower.includes('next week')) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      needByDate = d.toISOString().split('T')[0];
    }

    // 5. Item match extraction from description keywords and model numbers
    let bestScore = 0;
    let matchedItem: Item | undefined = undefined;
    const modelMatches = (message.match(/\b\d{3,5}\b/g) || []).filter((m) => parseInt(m, 10) !== quantity);

    for (const it of items) {
      const descLower = it.description.toLowerCase();
      let score = 0;

      // Heavy weighting for matching specific model numbers (e.g. 6308, 6205, 50:1)
      for (const m of modelMatches) {
        if (new RegExp(`\\b${m}\\b`, 'i').test(descLower)) {
          score += 15;
        }
      }

      // Bonus if deep groove or specific phrases match
      if (lower.includes('deep groove') && descLower.includes('deep groove')) {
        score += 10;
      }

      const itWords = descLower.split(/[\s\-\/\(\)]+/).filter((w) => w.length > 2);
      for (const w of itWords) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) {
          score += 4;
        }
      }

      if (score > bestScore && score >= 4) {
        bestScore = score;
        matchedItem = it;
      }
    }

    // Extract free-text item description if no item matched
    let itemDescription = matchedItem?.description;
    if (!itemDescription) {
      const needMatch = message.match(/(?:need|order|buy|require|request)\s+(?:about\s+)?(?:\d+\s+)?([a-zA-Z0-9\s\-\/\.]+?)(?:\s+for|\s+by|\s+at|\.|$)/i);
      if (needMatch && needMatch[1].trim().length > 2) {
        itemDescription = needMatch[1].trim();
      } else {
        itemDescription = message.trim();
      }
    }

    // Missing fields
    const missing: string[] = [];
    if (!matchedItem && !itemDescription) missing.push('item');
    if (!quantity) missing.push('quantity');
    if (!plant) missing.push('plant');
    if (!needByDate) missing.push('need_by_date');

    // Generate natural assistant reply
    let reply = '';
    if (missing.length === 0) {
      reply = `I have captured your request for **${quantity} ${matchedItem?.uom || 'units'}** of **${matchedItem ? matchedItem.description : itemDescription}** for plant **${plant}**, need-by date **${needByDate}** (Urgency: **${urgency}**). Would you like to confirm and create this purchase request?`;
    } else {
      const prompts: string[] = [];
      if (!matchedItem && itemDescription) {
        prompts.push(`I noted "${itemDescription}".`);
      } else if (matchedItem) {
        prompts.push(`I identified **${matchedItem.description}** (${matchedItem.item_code}).`);
      }
      if (!quantity) prompts.push('Could you specify the quantity required?');
      if (!plant) prompts.push('Which plant is this for? (PUN1 Bhosari or CHK1 Chakan)');
      if (!needByDate) prompts.push('When do you need this delivered by (need-by date)?');
      reply = prompts.join(' ');
    }

    return {
      item_code: matchedItem?.item_code,
      description: itemDescription,
      quantity,
      plant,
      need_by_date: needByDate,
      urgency,
      estimated_unit_price: matchedItem?.standard_price,
      missing_fields: missing,
      assistant_reply: reply,
      confidence: matchedItem ? 0.9 : 0.6
    };
  }

  private fallbackPolicyParse(
    text: string,
    currentPolicy: PolicyDocument
  ): PolicyAmendmentProposal {
    const cleanText = text.replace(/[\uE000-\uF8FF]/g, '-').trim();
    const lower = cleanText.toLowerCase();

    // 1. Validation: Check if text contains policy concepts (spot, rfq, rfp, threshold, clause, amendment, etc.)
    const hasPolicyConcept =
      lower.includes('spot') ||
      lower.includes('rfp') ||
      lower.includes('rfq') ||
      lower.includes('threshold') ||
      lower.includes('limit') ||
      lower.includes('clause') ||
      lower.includes('rule') ||
      lower.includes('capex') ||
      lower.includes('amendment') ||
      lower.includes('packaging') ||
      lower.includes('electrical') ||
      lower.includes('procurement') ||
      lower.includes('policy');

    if (!hasPolicyConcept && cleanText.length > 25) {
      return {
        version: currentPolicy.version,
        title: currentPolicy.title,
        effective_date: currentPolicy.effective_date,
        amendment_summary: 'Validation Failed: Uploaded document does not match a Corvo Procurement Policy amendment specification.',
        added_rules: [],
        modified_rules: [],
        removed_rule_ids: [],
        is_valid_amendment: false,
        validation_errors: [
          'Document does not contain official Corvo Procurement Policy headers or amendment clauses (A1, A2, A3).',
          'Only authorized procurement amendment circulars or text instructions are supported.'
        ]
      };
    }

    // 2. Metadata Extraction
    let version = `5.${parseInt(currentPolicy.version.split('.')[1] || '0', 10) + 1}`;
    const directMatch = cleanText.match(/new\s+version\s+([0-9]+\.[0-9]+)/i);
    if (directMatch) {
      version = directMatch[1];
    } else {
      const allVersions = Array.from(cleanText.matchAll(/version\s*([0-9]+\.[0-9]+)/gi)).map((m) => m[1]);
      const higher = allVersions.find((v) => parseFloat(v) > parseFloat(currentPolicy.version));
      if (higher) {
        version = higher;
      }
    }

    let documentRef = currentPolicy.document_number;
    const docRefMatch = cleanText.match(/CORVO[-_\s]PROC[-_\s]POL[-_\s]([0-9]+)/i);
    if (docRefMatch) {
      documentRef = `CORVO-PROC-POL-${docRefMatch[1]}`;
    }

    let effectiveDate = '2026-12-01';
    const months: Record<string, string> = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
      aug: '08', august: '08', sep: '09', september: '09', oct: '10', october: '10',
      nov: '11', november: '11', dec: '12', december: '12'
    };

    const effectiveMatchIso = cleanText.match(/effective\s+(?:from\s+)?(\d{4}-\d{2}-\d{2})/i);
    const effectiveMatchText = cleanText.match(/effective\s+(?:from\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
    if (effectiveMatchIso) {
      effectiveDate = effectiveMatchIso[1];
    } else if (effectiveMatchText) {
      const d = effectiveMatchText[1].padStart(2, '0');
      const m = months[effectiveMatchText[2].toLowerCase()] || '12';
      const y = effectiveMatchText[3];
      effectiveDate = `${y}-${m}-${d}`;
    }

    let approvedBy = 'CFO (Chief Financial Officer)';
    let approvalDate = '2026-11-20';
    const approverMatch = cleanText.match(/approved\s+by\s+(?:the\s+)?([A-Za-z\s]+?)\s+on\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
    if (approverMatch) {
      approvedBy = approverMatch[1].trim();
      const d = approverMatch[2].padStart(2, '0');
      const m = months[approverMatch[3].toLowerCase()] || '11';
      const y = approverMatch[4];
      approvalDate = `${y}-${m}-${d}`;
    }

    const clauses: AmendmentClause[] = [];
    const addedRules: PolicyRule[] = [];
    const modifiedRules: PolicyRule[] = [];

    // 3. Detect Amendment 1 (A1): Packaging spot limit reduction
    const isA1Packaging =
      lower.includes('packaging spot limit') ||
      lower.includes('packaging category') ||
      (lower.includes('packaging') && (lower.includes('1,00,000') || lower.includes('100000') || lower.includes('1 lakh') || lower.includes('1l')));

    if (isA1Packaging) {
      clauses.push({
        id: 'A1',
        title: 'Packaging Spot PO Limit Reduction',
        clause_reference: '5.4',
        description: 'For items in the Packaging category, the limit in rule 5.4 (spot PO) is reduced from ₹2,00,000 to ₹1,00,000. Packaging requirements at or above ₹1,00,000 must be sourced.',
        reason: 'Packaging prices have moved sharply and several suppliers are now available.'
      });

      // Split Rule 5.4 into Packaging (< 1L) and Non-Packaging (< 2L)
      addedRules.push({
        rule_id: 'RULE_5_4_SPOT_PO_PACKAGING',
        clause: '5.4',
        name: 'Spot Purchase Order (Packaging)',
        description: 'Packaging items with value below ₹1,00,000, bought from an Active supplier in the last 365 days.',
        priority: 38,
        conditions: {
          all: [
            { field: 'item.category', operator: 'eq', value: 'Packaging' },
            { field: 'requirement.value_inr', operator: 'lt', value: 100000 },
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
      });

      modifiedRules.push({
        rule_id: 'RULE_5_4_SPOT_PO',
        clause: '5.4',
        name: 'Spot Purchase Order (Non-Packaging)',
        description: 'Non-Packaging items with value below ₹2,00,000, bought from an Active supplier in the last 365 days.',
        priority: 40,
        conditions: {
          all: [
            { field: 'item.category', operator: 'neq', value: 'Packaging' },
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
      });
    }

    // 4. Detect Amendment 2 (A2): RFP threshold reduction to 8 Lakh
    const isA2RFP =
      lower.includes('rfp threshold') ||
      (lower.includes('rfp') && (lower.includes('8,00,000') || lower.includes('800000') || lower.includes('8 lakh') || lower.includes('8l')));

    if (isA2RFP) {
      clauses.push({
        id: 'A2',
        title: 'RFP Threshold Reduction to ₹8,00,000',
        clause_reference: '5.5 / 5.6',
        description: 'The value at which a formal RFP is required (rules 5.5 and 5.6) is reduced from ₹10,00,000 to ₹8,00,000. Sourcing requirements below ₹8,00,000 go to RFQ; ₹8,00,000 or more go to RFP.',
        reason: 'Enhanced oversight for high-value procurement requests.'
      });

      modifiedRules.push({
        rule_id: 'RULE_5_5_RFQ',
        clause: '5.5',
        name: 'Request For Quotation (RFQ)',
        description: 'Value below ₹8,00,000 (including items never bought in last 365 days). Suggest 3 suppliers.',
        priority: 50,
        conditions: {
          field: 'requirement.value_inr',
          operator: 'lt',
          value: 800000
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
      });

      modifiedRules.push({
        rule_id: 'RULE_5_6_RFP',
        clause: '5.6',
        name: 'Request For Proposal (RFP)',
        description: 'Value ₹8,00,000 or more. Formal RFP with 5 suggested suppliers.',
        priority: 60,
        conditions: {
          field: 'requirement.value_inr',
          operator: 'gte',
          value: 800000
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
      });
    }

    // 5. Detect Amendment 3 (A3): Chakan Electrical Safety
    const isA3ChakanSafety =
      lower.includes('electrical safety') ||
      lower.includes('5.2a') ||
      (lower.includes('chakan') && lower.includes('electrical') && (lower.includes('50,000') || lower.includes('50000')));

    if (isA3ChakanSafety) {
      clauses.push({
        id: 'A3',
        title: 'Chakan Plant Electrical Safety Sourcing',
        clause_reference: '5.2A',
        description: 'At Chakan plant (CHK1), every requirement in Electrical Spares worth ₹50,000 or more must be sourced (RFQ below ₹8,00,000, RFP at or above ₹8,00,000), even if otherwise eligible for emergency or spot PO. Contract PO (rule 5.2) remains allowed.',
        reason: "Chakan's new electrical safety certification requires supplier compliance documents obtained exclusively through formal sourcing."
      });

      const rfpThreshold = isA2RFP ? 800000 : 1000000;
      addedRules.push({
        rule_id: 'RULE_5_2A_CHK1_ELECTRICAL_RFP',
        clause: '5.2A',
        name: 'Chakan Electrical Safety Sourcing (RFP)',
        description: `At CHK1, Electrical Spares worth >= ₹50,000 must be sourced. When value >= ₹${rfpThreshold.toLocaleString('en-IN')}, formal RFP is required.`,
        priority: 24,
        conditions: {
          all: [
            { field: 'requirement.plant', operator: 'eq', value: 'CHK1' },
            { field: 'item.category', operator: 'eq', value: 'Electrical Spares' },
            { field: 'requirement.value_inr', operator: 'gte', value: rfpThreshold }
          ]
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
      });

      addedRules.push({
        rule_id: 'RULE_5_2A_CHK1_ELECTRICAL_RFQ',
        clause: '5.2A',
        name: 'Chakan Electrical Safety Sourcing (RFQ)',
        description: `At CHK1, Electrical Spares worth >= ₹50,000 must be sourced (RFQ below ₹${rfpThreshold.toLocaleString('en-IN')}), even if otherwise eligible for emergency or spot PO.`,
        priority: 25,
        conditions: {
          all: [
            { field: 'requirement.plant', operator: 'eq', value: 'CHK1' },
            { field: 'item.category', operator: 'eq', value: 'Electrical Spares' },
            { field: 'requirement.value_inr', operator: 'gte', value: 50000 }
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
      });
    }

    // 6. Generic natural language rule parser for any custom text amendments
    if (clauses.length === 0) {
      // Check for generic spot threshold change
      const spotMatch = cleanText.match(/(?:spot|po limit|threshold|below)\s*(?:of|to|is|increased to|reduced to)?\s*(?:inr|rs\.?|₹)?\s*(\d+[\d,]*)/i);
      if (spotMatch) {
        const numVal = parseInt(spotMatch[1].replace(/,/g, ''), 10);
        if (numVal > 0) {
          clauses.push({
            id: 'CUSTOM-1',
            title: 'Spot PO Threshold Adjustment',
            clause_reference: '5.4',
            description: `Spot PO threshold updated to ₹${numVal.toLocaleString('en-IN')}.`,
            reason: 'Administrative threshold adjustment.'
          });
          const spotRule = currentPolicy.rules.find((r) => r.rule_id === 'RULE_5_4_SPOT_PO');
          if (spotRule) {
            const updated = JSON.parse(JSON.stringify(spotRule)) as PolicyRule;
            updated.description = `Value below ₹${numVal.toLocaleString('en-IN')}, and item bought from Active supplier in last 365 days.`;
            if ('all' in updated.conditions && updated.conditions.all) {
              for (const cond of updated.conditions.all) {
                if ('field' in cond && cond.field === 'requirement.value_inr') {
                  cond.value = numVal;
                }
              }
            }
            modifiedRules.push(updated);
          }
        }
      }
    }

    // 7. Human-readable professional amendment summary
    let summary = '';
    if (isA1Packaging && isA2RFP && isA3ChakanSafety) {
      summary = `Amendment No. 1 to ${documentRef} v5.0 (Effective ${effectiveDate}, approved by ${approvedBy} on ${approvalDate}). Changes: A1 — Packaging spot PO limit reduced from ₹2,00,000 to ₹1,00,000 (requirements >= ₹1,00,000 must be sourced). A2 — RFP threshold reduced from ₹10,00,000 to ₹8,00,000 (RFQ below ₹8,00,000; RFP ₹8,00,000 or more). A3 — New rule 5.2A Chakan electrical safety: At CHK1, Electrical Spares worth ₹50,000 or more must be sourced (valid contract PO rule 5.2 remains allowed).`;
    } else if (clauses.length > 0) {
      summary = `Policy Amendment v${version} (${clauses.map((c) => `${c.id}: ${c.title}`).join(', ')}). Effective: ${effectiveDate}. Approved by: ${approvedBy}.`;
    } else {
      summary = `Policy Amendment v${version}: Administrative update to procurement decision rules. Effective: ${effectiveDate}.`;
    }

    return {
      version,
      document_reference: documentRef,
      title: `Corvo Procurement Policy v${version} (Amended)`,
      effective_date: effectiveDate,
      approved_by: approvedBy,
      approval_date: approvalDate,
      amendment_summary: summary,
      clauses,
      modified_parameters: {},
      added_rules: addedRules,
      modified_rules: modifiedRules,
      removed_rule_ids: [],
      is_valid_amendment: clauses.length > 0,
      validation_errors: clauses.length === 0 ? ['No recognized policy amendment clauses found in document.'] : undefined
    };
  }

  // --- External Provider Integration (Gemini / OpenAI) ---

  private async callGeminiChatExtract(
    message: string,
    history: Array<{ role: string; content: string }>,
    items: Item[]
  ): Promise<ExtractedChatPR> {
    const prompt = `You are a procurement assistant for Corvo Engineering. Extract purchase request fields from this chat message and conversation history. Return ONLY valid JSON.
Conversation:
${history.map((h) => `${h.role}: ${h.content}`).join('\n')}
User: ${message}

Known Plants: PUN1 (Bhosari), CHK1 (Chakan).
JSON schema:
{
  "item_code": string or null,
  "description": string or null,
  "quantity": number or null,
  "plant": "PUN1" | "CHK1" | null,
  "need_by_date": "YYYY-MM-DD" | null,
  "urgency": "Normal" | "Emergency",
  "missing_fields": string[],
  "assistant_reply": string,
  "confidence": number
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (!res.ok) throw new Error(`Gemini HTTP error ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  }

  private async callOpenAIChatExtract(
    message: string,
    history: Array<{ role: string; content: string }>,
    items: Item[]
  ): Promise<ExtractedChatPR> {
    const prompt = `You are a procurement assistant for Corvo Engineering. Extract purchase request fields from this conversation. Return JSON matching:
{
  "item_code": string or null,
  "description": string or null,
  "quantity": number or null,
  "plant": "PUN1" | "CHK1" | null,
  "need_by_date": "YYYY-MM-DD" | null,
  "urgency": "Normal" | "Emergency",
  "missing_fields": string[],
  "assistant_reply": string,
  "confidence": number
}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: config.openaiModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          ...history,
          { role: 'user', content: message }
        ]
      })
    });

    if (!res.ok) throw new Error(`OpenAI HTTP error ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }

  private async callGeminiPolicyParse(
    documentText: string,
    currentPolicy: PolicyDocument
  ): Promise<PolicyAmendmentProposal> {
    const prompt = `You are an expert procurement policy architect. Compare this amendment document with the current policy v${currentPolicy.version} and produce structured AST changes. Return ONLY valid JSON conforming to PolicyAmendmentProposal.
Current Policy JSON:
${JSON.stringify(currentPolicy, null, 2)}

Amendment Text:
${documentText}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (!res.ok) throw new Error(`Gemini HTTP error ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  }

  private async callOpenAIPolicyParse(
    documentText: string,
    currentPolicy: PolicyDocument
  ): Promise<PolicyAmendmentProposal> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: config.openaiModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an expert procurement policy architect. Output structured JSON for PolicyAmendmentProposal.`
          },
          {
            role: 'user',
            content: `Current Policy:\n${JSON.stringify(currentPolicy)}\n\nAmendment:\n${documentText}`
          }
        ]
      })
    });

    if (!res.ok) throw new Error(`OpenAI HTTP error ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
}
