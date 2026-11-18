import { describe, it, expect, beforeAll } from 'vitest';
import { PolicyService } from '../../apps/api/src/services/policy.service';
import { BatchService } from '../../apps/api/src/services/batch.service';
import { DEFAULT_POLICY_V5, PolicyDocument } from '@corvo/policy-schema';

describe('Phase Three: Policy Amendment Workflow & Dynamic Alteration', () => {
  let policyService: PolicyService;
  let batchService: BatchService;

  beforeAll(() => {
    policyService = new PolicyService();
    batchService = new BatchService();
  });

  it('Step 1: Ingests Policy v5.0 as baseline', async () => {
    const active = await policyService.getActivePolicy('2026-11-01');
    expect(active.version).toBe('5.0');
    expect(active.status).toBe('ACTIVE');
  });

  it('Step 2: Proposes text-based amendment and extracts AST diff', async () => {
    const amendmentPrompt = 'Increase spot purchase threshold to INR 200,000 for Pune plant with immediate effect.';
    const result = await policyService.proposeAmendment({ text: amendmentPrompt });

    expect(result.draftPolicy).toBeDefined();
    expect(result.diff).toBeDefined();
    expect(result.diff.old_version).toBe('5.0');
    expect(result.proposal.amendment_summary).toBeTruthy();
  });

  it('Step 3: Verifies future-effective policies do NOT activate prematurely', async () => {
    // Create a future draft policy
    const futurePolicy: PolicyDocument = JSON.parse(JSON.stringify(DEFAULT_POLICY_V5));
    futurePolicy.version = 'v6.0-FUTURE';
    futurePolicy.effective_date = '2030-01-01'; // 4 years in the future
    futurePolicy.title = 'Corvo Future Policy';
    futurePolicy.status = 'DRAFT';

    policyService.addPolicy(futurePolicy);

    // Approve it
    const approved = await policyService.approvePolicy('v6.0-FUTURE');
    expect(approved.status).toBe('APPROVED'); // Scheduled for future

    // Check active policy as of 2026-11-01
    const activeIn2026 = await policyService.getActivePolicy('2026-11-01');
    expect(activeIn2026.version).toBe('5.0'); // MUST NOT be v6.0-FUTURE!

    // Check active policy as of 2030-01-02
    const activeIn2030 = await policyService.getActivePolicy('2030-01-02');
    expect(activeIn2030.version).toBe('v6.0-FUTURE'); // Activates on its effective date
  });

  it('Step 4: Amends policy rule dynamically and verifies altered decision routing without code changes', async () => {
    // 1. Process a PR under v5.0 where group value is between 2,00,000 and 5,00,000 INR
    // Under v5.0: Spot PO limit is < 2,00,000 INR. With 500 NOS of ITM-1022 @ 640 INR = 3,20,000 INR
    // Exceeds 2L threshold -> Routes to RFQ under Clause 5.5
    const sampleCsv = `pr_no,pr_line,created_at,requester,department,plant,item_code,description,quantity,uom,estimated_unit_price,need_by_date,urgency
PR-POLICY-TEST,1,2026-11-01 10:00,R. Test,Ops,CHK1,ITM-1022,Ball bearing 6308-ZZ,500,NOS,,2026-11-10,Normal`;

    const run1 = await batchService.processBatchCSV(sampleCsv, 'policy_test.csv', '5.0');
    expect(run1.decisions.length).toBe(1);
    const originalDec = run1.decisions[0];
    expect(originalDec.policy_version).toBe('5.0');
    expect(originalDec.decision).toBe('SOURCING_REQUEST');
    expect(originalDec.route).toBe('RFQ');

    // 2. Now amend Policy: create v5.2 which increases Spot PO threshold to 500,000 INR
    const amendedPolicy: PolicyDocument = JSON.parse(JSON.stringify(DEFAULT_POLICY_V5));
    amendedPolicy.version = 'v5.2';
    amendedPolicy.effective_date = '2026-11-01';
    amendedPolicy.title = 'Amended Policy v5.2 (Spot PO Limit increased to INR 5,00,000)';
    // Modify RULE_5_4_SPOT_PO condition to threshold 500,000
    const spotRule = amendedPolicy.rules.find((r) => r.rule_id === 'RULE_5_4_SPOT_PO');
    expect(spotRule).toBeDefined();
    if (spotRule && spotRule.conditions && (spotRule.conditions as any).all) {
      const cond = (spotRule.conditions as any).all.find((c: any) => c.field === 'requirement.value_inr');
      if (cond) cond.value = 500000;
    }

    // 3. Process the exact same PR under v5.2
    const run2 = await batchService.processBatchCSV(sampleCsv, 'policy_test.csv', amendedPolicy);
    expect(run2.decisions.length).toBe(1);
    const amendedDec = run2.decisions[0];
    expect(amendedDec.policy_version).toBe('v5.2');
    // In v5.2, 3,20,000 INR is strictly below 5,00,000 INR and ITM-1022 has 365d active history -> Routes to SPOT_PO!
    expect(amendedDec.decision).toBe('PO');
    expect(amendedDec.route).toBe('SPOT_PO');
    expect(amendedDec.supplier_id).toBe('S014'); // Assigned to 1st preferred supplier

    // 4. Verify historical run 1 decisions STILL reference original policy version '5.0' and original RFQ route
    expect(originalDec.policy_version).toBe('5.0');
    expect(originalDec.route).toBe('RFQ');
    expect(originalDec.decision).toBe('SOURCING_REQUEST');
  });
});
