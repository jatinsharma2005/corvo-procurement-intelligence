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

export interface PolicyAmendmentProposal {
  version: string;
  title: string;
  effective_date: string;
  amendment_summary: string;
  modified_parameters?: Partial<PolicyDocument['parameters']>;
  added_rules: PolicyRule[];
  modified_rules: PolicyRule[];
  removed_rule_ids: string[];
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
    const urgency = lower.includes('emergency') || lower.includes('urgent') ? 'Emergency' : 'Normal';

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

    // 5. Item match extraction from description keywords
    let matchedItem: Item | undefined = undefined;
    for (const it of items) {
      const itWords = it.description.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const matches = itWords.filter((w) => lower.includes(w));
      if (matches.length >= 2 || (itWords.length === 1 && matches.length === 1)) {
        matchedItem = it;
        break;
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
      missing_fields: missing,
      assistant_reply: reply,
      confidence: matchedItem ? 0.9 : 0.6
    };
  }

  private fallbackPolicyParse(
    text: string,
    currentPolicy: PolicyDocument
  ): PolicyAmendmentProposal {
    const lower = text.toLowerCase();
    const proposal: PolicyAmendmentProposal = {
      version: `5.${parseInt(currentPolicy.version.split('.')[1] || '0', 10) + 1}`,
      title: `${currentPolicy.title} (Amended)`,
      effective_date: new Date().toISOString().split('T')[0],
      amendment_summary: text.slice(0, 300),
      modified_parameters: {},
      added_rules: [],
      modified_rules: [],
      removed_rule_ids: []
    };

    // Check for effective date e.g. "Effective 1 December 2026" or "effective 2026-12-01"
    const dateMatch = text.match(/effective\s+(?:from\s+)?(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      proposal.effective_date = dateMatch[1];
    }

    // Check for spot limit change (e.g. "spot po limit increased to 3,00,000" or "threshold of 300000")
    const spotMatch = text.match(/(?:spot|po limit|threshold|below)\s*(?:of|to|is|increased to)?\s*₹?\s*(\d+[\d,]*)/i);
    if (spotMatch) {
      const numVal = parseInt(spotMatch[1].replace(/,/g, ''), 10);
      if (numVal > 0) {
        // Clone existing rule 5.4 and update threshold
        const spotRule = currentPolicy.rules.find((r) => r.rule_id === 'RULE_5_4_SPOT_PO');
        if (spotRule) {
          const updated = JSON.parse(JSON.stringify(spotRule)) as PolicyRule;
          updated.description = `Value below ₹${numVal.toLocaleString('en-IN')}, and item bought from Active supplier in last 365 days.`;
          // Update condition
          if ('all' in updated.conditions && updated.conditions.all) {
            for (const cond of updated.conditions.all) {
              if ('field' in cond && cond.field === 'requirement.value_inr') {
                cond.value = numVal;
              }
            }
          }
          proposal.modified_rules.push(updated);
        }
      }
    }

    // Check for plant-specific rule (e.g. "for plant CHK1, all lubricants must go to RFQ")
    if (lower.includes('chk1') || lower.includes('pun1')) {
      const targetPlant = lower.includes('chk1') ? 'CHK1' : 'PUN1';
      proposal.added_rules.push({
        rule_id: `RULE_PLANT_${targetPlant}_SPECIFIC`,
        clause: '5.2-A',
        name: `${targetPlant} Plant Specific Sourcing`,
        description: `Special policy rule for plant ${targetPlant} requirements.`,
        priority: 15, // higher precedence than standard contract or spot PO
        conditions: {
          all: [
            { field: 'requirement.plant', operator: 'eq', value: targetPlant },
            { field: 'requirement.value_inr', operator: 'gte', value: 100000 }
          ]
        },
        outcome: {
          decision: 'SOURCING_REQUEST',
          route: 'RFQ',
          supplier_selection: { strategy: 'SUGGEST_RANKED', suggest_count: 3 },
          requires_approval: false
        }
      });
    }

    return proposal;
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
