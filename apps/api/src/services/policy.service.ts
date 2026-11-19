import mongoose from 'mongoose';
import { PolicyVersionModel, IPolicyVersion } from '../models/PolicyVersion';
import {
  PolicyDocument,
  DEFAULT_POLICY_V5,
  DEFAULT_POLICY_V5_1,
  PolicyDocumentSchema,
  PolicyRule
} from '@corvo/policy-schema';
import { AIService, PolicyAmendmentProposal } from './ai.service';
import pdfParse from 'pdf-parse';

// Disable mongoose buffering when not connected
mongoose.set('bufferCommands', false);

export interface PolicyDiff {
  old_version: string;
  new_version: string;
  parameter_changes: Array<{
    parameter: string;
    old_value: any;
    new_value: any;
  }>;
  added_rules: PolicyRule[];
  modified_rules: Array<{
    rule_id: string;
    old_rule: PolicyRule;
    new_rule: PolicyRule;
    changes: string[];
  }>;
  removed_rules: PolicyRule[];
}

export class PolicyService {
  private aiService: AIService;
  private inMemoryPolicies: Map<string, PolicyDocument> = new Map();

  constructor() {
    this.aiService = new AIService();
    this.inMemoryPolicies.set('5.0', DEFAULT_POLICY_V5);
    this.inMemoryPolicies.set('5.1', DEFAULT_POLICY_V5_1);
  }

  public addPolicy(policy: PolicyDocument): void {
    this.inMemoryPolicies.set(policy.version, policy);
  }

  public async getActivePolicy(asOfDate: string | Date = new Date()): Promise<PolicyDocument> {
    const asOf = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await PolicyVersionModel.findOne({
          status: { $in: ['ACTIVE', 'APPROVED'] },
          effective_date: { $lte: asOf }
        })
          .sort({ effective_date: -1 })
          .lean();
        if (doc) {
          return this.mapDocToPolicy(doc);
        }
      } catch (err: any) {
        console.warn(`[PolicyService] DB active policy error: ${err.message}`);
      }
    }
    // Return active from memory with effective date filtering
    const eligible = Array.from(this.inMemoryPolicies.values())
      .filter(
        (p) =>
          (p.status === 'ACTIVE' || p.status === 'APPROVED') &&
          new Date(p.effective_date).getTime() <= asOf.getTime()
      )
      .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());

    if (eligible.length > 0) return eligible[0];
    return DEFAULT_POLICY_V5;
  }

  public async getAllPolicies(): Promise<PolicyDocument[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await PolicyVersionModel.find().sort({ effective_date: -1 }).lean();
        if (docs.length > 0) {
          return docs.map(this.mapDocToPolicy);
        }
      } catch (err: any) {
        console.warn(`[PolicyService] DB all policies error: ${err.message}`);
      }
    }
    return Array.from(this.inMemoryPolicies.values());
  }

  public async getPolicyByVersion(version: string): Promise<PolicyDocument | null> {
    const norm = version.replace(/^v/i, '');
    const variants = [version, norm, `v${norm}`];

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await PolicyVersionModel.findOne({ version: { $in: variants } }).lean();
        if (doc) return this.mapDocToPolicy(doc);
      } catch (err: any) {
        console.warn(`[PolicyService] DB policy by version error: ${err.message}`);
      }
    }
    for (const v of variants) {
      if (this.inMemoryPolicies.has(v)) {
        return this.inMemoryPolicies.get(v)!;
      }
    }
    if (norm === '5.0') return DEFAULT_POLICY_V5;
    if (norm === '5.1') return DEFAULT_POLICY_V5_1;
    return null;
  }

  public async proposeAmendment(
    input: { text?: string; fileBuffer?: Buffer; filename?: string }
  ): Promise<{
    draftPolicy: PolicyDocument;
    proposal: PolicyAmendmentProposal;
    diff: PolicyDiff;
    validation: { isValid: boolean; errors?: string[] };
  }> {
    let documentText = input.text || '';
    if (input.fileBuffer) {
      try {
        const parsed = await pdfParse(input.fileBuffer);
        documentText = parsed.text;
      } catch (err: any) {
        console.warn(`[PolicyService] Failed to parse PDF: ${err.message}`);
      }
    }

    const currentPolicy = await this.getActivePolicy();
    const proposal = await this.aiService.parsePolicyAmendment(documentText, currentPolicy);

    if (proposal.is_valid_amendment === false) {
      const errorMsg = proposal.validation_errors?.join('; ') || 'Invalid policy amendment document: not recognized as an authorized Corvo policy amendment.';
      throw new Error(errorMsg);
    }

    const newVersion = proposal.version || `5.${parseInt(currentPolicy.version.split('.')[1] || '0', 10) + 1}`;
    const newRules: PolicyRule[] = [];

    for (const rule of currentPolicy.rules) {
      if (proposal.removed_rule_ids?.includes(rule.rule_id)) continue;
      const mod = proposal.modified_rules?.find((m) => m.rule_id === rule.rule_id);
      if (mod) {
        newRules.push(mod);
      } else {
        newRules.push(rule);
      }
    }

    if (proposal.added_rules) {
      for (const ar of proposal.added_rules) {
        if (!newRules.some((r) => r.rule_id === ar.rule_id)) {
          newRules.push(ar);
        }
      }
    }

    newRules.sort((a, b) => a.priority - b.priority);

    const draftPolicy: PolicyDocument = {
      version: newVersion,
      document_number: proposal.document_reference || currentPolicy.document_number,
      title: proposal.title || `${currentPolicy.title} (Amended)`,
      effective_date: proposal.effective_date || new Date().toISOString().split('T')[0],
      status: 'DRAFT',
      parameters: {
        ...currentPolicy.parameters,
        ...(proposal.modified_parameters || {})
      },
      rules: newRules,
      created_at: new Date().toISOString(),
      amendment_summary: proposal.amendment_summary
    };

    const validationResult = PolicyDocumentSchema.safeParse(draftPolicy);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Policy validation failed: ${errorMsg}`);
    }

    // Save in memory
    this.inMemoryPolicies.set(newVersion, draftPolicy);

    // Save in DB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await PolicyVersionModel.findOneAndUpdate(
          { version: newVersion },
          {
            version: newVersion,
            document_number: draftPolicy.document_number,
            title: draftPolicy.title,
            effective_date: new Date(draftPolicy.effective_date),
            status: 'DRAFT',
            parameters: draftPolicy.parameters,
            rules: draftPolicy.rules,
            amendment_summary: draftPolicy.amendment_summary,
            created_at: new Date()
          },
          { upsert: true, new: true }
        );
      } catch (err: any) {
        console.warn(`[PolicyService] DB save draft error: ${err.message}`);
      }
    }

    const diff = this.computeDiff(currentPolicy, draftPolicy);
    return {
      draftPolicy,
      proposal,
      diff,
      validation: { isValid: true }
    };
  }

  public async rejectPolicyDraft(version: string): Promise<boolean> {
    const policy = await this.getPolicyByVersion(version);
    if (!policy) throw new Error(`Policy version ${version} not found`);
    if (policy.status !== 'DRAFT') {
      throw new Error(`Cannot reject policy with status '${policy.status}'. Only DRAFT policies can be rejected.`);
    }

    this.inMemoryPolicies.delete(version);

    if (mongoose.connection.readyState === 1) {
      try {
        await PolicyVersionModel.deleteOne({ version, status: 'DRAFT' });
      } catch (err: any) {
        console.warn(`[PolicyService] DB delete draft error: ${err.message}`);
      }
    }

    return true;
  }

  public computeDiff(oldPolicy: PolicyDocument, newPolicy: PolicyDocument): PolicyDiff {
    const paramChanges: Array<{ parameter: string; old_value: any; new_value: any }> = [];
    for (const key of Object.keys(newPolicy.parameters) as Array<keyof typeof newPolicy.parameters>) {
      if (oldPolicy.parameters[key] !== newPolicy.parameters[key]) {
        paramChanges.push({
          parameter: key,
          old_value: oldPolicy.parameters[key],
          new_value: newPolicy.parameters[key]
        });
      }
    }

    const oldRulesMap = new Map(oldPolicy.rules.map((r) => [r.rule_id, r]));
    const newRulesMap = new Map(newPolicy.rules.map((r) => [r.rule_id, r]));

    const addedRules = newPolicy.rules.filter((r) => !oldRulesMap.has(r.rule_id));
    const removedRules = oldPolicy.rules.filter((r) => !newRulesMap.has(r.rule_id));
    const modifiedRules: PolicyDiff['modified_rules'] = [];

    for (const [rid, newRule] of newRulesMap.entries()) {
      if (oldRulesMap.has(rid)) {
        const oldRule = oldRulesMap.get(rid)!;
        const changes: string[] = [];
        if (oldRule.priority !== newRule.priority) changes.push(`Priority changed: ${oldRule.priority} -> ${newRule.priority}`);
        if (oldRule.clause !== newRule.clause) changes.push(`Clause changed: ${oldRule.clause} -> ${newRule.clause}`);
        if (oldRule.description !== newRule.description) changes.push(`Description changed: "${oldRule.description}" -> "${newRule.description}"`);
        if (JSON.stringify(oldRule.conditions) !== JSON.stringify(newRule.conditions)) changes.push('Conditions updated');
        if (JSON.stringify(oldRule.outcome) !== JSON.stringify(newRule.outcome)) changes.push('Outcome / Route updated');

        if (changes.length > 0) {
          modifiedRules.push({ rule_id: rid, old_rule: oldRule, new_rule: newRule, changes });
        }
      }
    }

    return {
      old_version: oldPolicy.version,
      new_version: newPolicy.version,
      parameter_changes: paramChanges,
      added_rules: addedRules,
      modified_rules: modifiedRules,
      removed_rules: removedRules
    };
  }

  public async approvePolicy(
    version: string,
    approvedBy: string = 'Head of Procurement'
  ): Promise<PolicyDocument> {
    const policy = await this.getPolicyByVersion(version);
    if (!policy) throw new Error(`Policy version ${version} not found`);

    const isFuture = new Date(policy.effective_date).getTime() > Date.now();
    const newStatus = isFuture ? 'APPROVED' : 'ACTIVE';

    // In memory update
    if (!isFuture) {
      for (const p of this.inMemoryPolicies.values()) {
        if (p.status === 'ACTIVE' && p.version !== version) {
          p.status = 'ARCHIVED';
        }
      }
    }
    policy.status = newStatus;
    policy.approved_at = new Date().toISOString();
    policy.approved_by = approvedBy;
    this.inMemoryPolicies.set(version, policy);

    // In DB update if connected
    if (mongoose.connection.readyState === 1) {
      try {
        if (!isFuture) {
          await PolicyVersionModel.updateMany(
            { status: 'ACTIVE', version: { $ne: version } },
            { $set: { status: 'ARCHIVED' } }
          );
        }
        await PolicyVersionModel.findOneAndUpdate(
          { version },
          {
            $set: {
              status: newStatus,
              approved_at: new Date(),
              approved_by: approvedBy
            }
          },
          { upsert: true }
        );
      } catch (err: any) {
        console.warn(`[PolicyService] DB approve policy error: ${err.message}`);
      }
    }

    return policy;
  }

  private mapDocToPolicy(doc: any): PolicyDocument {
    return {
      version: doc.version,
      document_number: doc.document_number,
      title: doc.title,
      effective_date: typeof doc.effective_date === 'string' ? doc.effective_date : doc.effective_date.toISOString().split('T')[0],
      status: doc.status,
      parameters: doc.parameters,
      rules: doc.rules,
      created_at: typeof doc.created_at === 'string' ? doc.created_at : doc.created_at?.toISOString() || new Date().toISOString(),
      approved_at: doc.approved_at ? (typeof doc.approved_at === 'string' ? doc.approved_at : doc.approved_at.toISOString()) : undefined,
      approved_by: doc.approved_by,
      amendment_summary: doc.amendment_summary
    };
  }
}
