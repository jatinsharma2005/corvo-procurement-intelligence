import { Item } from '@corvo/shared-types';

export interface ItemMatchResult {
  resolved_item_code: string;
  is_new: boolean;
  confidence: number;
  matched_item?: Item;
  candidates: Array<{ item: Item; score: number }>;
}

export class ItemMatchingEngine {
  private itemCatalog: Array<{
    item: Item;
    cleanDesc: string;
    tokens: Set<string>;
    numTokens: Set<string>;
  }> = [];

  constructor(items: Item[] = []) {
    this.setCatalog(items);
  }

  public setCatalog(items: Item[]): void {
    this.itemCatalog = items.map((item) => {
      const clean = this.cleanText(item.description);
      const tokens = new Set(clean.split(' ').filter(Boolean));
      const numTokens = new Set([...tokens].filter((t) => /\d/.test(t)));
      return {
        item,
        cleanDesc: clean,
        tokens,
        numTokens
      };
    });
  }

  public cleanText(text: string): string {
    if (!text) return '';
    let s = text.toLowerCase();
    // Remove noise phrases
    s = s.replace(/\b(as per sample|urgent|- urgent|\(repeat\)|repeat|for maintenance)\b/gi, ' ');
    // Standardize common engineering abbreviations
    s = s.replace(/\bbrg\b/gi, 'ball bearing');
    s = s.replace(/\bpneu\b/gi, 'pneumatic');
    s = s.replace(/\bhyd\b/gi, 'hydraulic');
    s = s.replace(/\bwelding rod\b/gi, 'welding electrode');
    s = s.replace(/(\d+)\s*"\b/gi, '$1 inch');
    // Replace non-alphanumeric except dot
    s = s.replace(/[^a-z0-9.]/gi, ' ');
    return s.split(/\s+/).filter(Boolean).join(' ');
  }

  public match(itemCode?: string, description?: string): ItemMatchResult {
    // 1. Direct code matching
    if (itemCode && itemCode.trim()) {
      const trimmed = itemCode.trim();
      const direct = this.itemCatalog.find((c) => c.item.item_code.toLowerCase() === trimmed.toLowerCase());
      if (direct) {
        return {
          resolved_item_code: direct.item.item_code,
          is_new: false,
          confidence: 1.0,
          matched_item: direct.item,
          candidates: [{ item: direct.item, score: 1.0 }]
        };
      }
    }

    if (!description || !description.trim()) {
      return {
        resolved_item_code: 'NEW',
        is_new: true,
        confidence: 0,
        candidates: []
      };
    }

    const cleanInput = this.cleanText(description);
    const inputTokens = new Set(cleanInput.split(' ').filter(Boolean));
    const inputNumTokens = new Set([...inputTokens].filter((t) => /\d/.test(t)));

    if (inputTokens.size === 0) {
      return {
        resolved_item_code: 'NEW',
        is_new: true,
        confidence: 0,
        candidates: []
      };
    }

    const scoredCandidates: Array<{ item: Item; score: number }> = [];

    for (const entry of this.itemCatalog) {
      const commonTokens = new Set([...inputTokens].filter((t) => entry.tokens.has(t)));
      if (commonTokens.size === 0) continue;

      const unionTokens = new Set([...inputTokens, ...entry.tokens]);
      let score = commonTokens.size / unionTokens.size;

      // Substring bonus
      if (entry.cleanDesc.includes(cleanInput) || cleanInput.includes(entry.cleanDesc)) {
        score += 0.5;
      }

      // Check numeric/model token alignment
      if (inputNumTokens.size > 0) {
        const hasAllNum = [...inputNumTokens].every((nt) => entry.numTokens.has(nt));
        const hasSomeNum = [...inputNumTokens].some((nt) => entry.numTokens.has(nt));
        if (hasAllNum) {
          score += 0.4;
        } else if (!hasSomeNum) {
          score -= 0.5;
        }
      }

      if (score > 0.25) {
        scoredCandidates.push({ item: entry.item, score });
      }
    }

    scoredCandidates.sort((a, b) => b.score - a.score);

    if (scoredCandidates.length > 0 && scoredCandidates[0].score >= 0.45) {
      return {
        resolved_item_code: scoredCandidates[0].item.item_code,
        is_new: false,
        confidence: scoredCandidates[0].score,
        matched_item: scoredCandidates[0].item,
        candidates: scoredCandidates.slice(0, 5)
      };
    }

    return {
      resolved_item_code: 'NEW',
      is_new: true,
      confidence: scoredCandidates.length > 0 ? scoredCandidates[0].score : 0,
      candidates: scoredCandidates.slice(0, 5)
    };
  }
}
