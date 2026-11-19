import fs from 'fs';
import path from 'path';
import { BatchService } from '../apps/api/src/services/batch.service';
import { ExportService } from '../apps/api/src/services/export.service';
import { PolicyService } from '../apps/api/src/services/policy.service';
import { DataStore, findTaskKitDir } from '../apps/api/src/services/data-store.service';
import { DEFAULT_POLICY_V5 } from '@corvo/policy-schema';
import { connectDatabase } from '../apps/api/src/models';

async function main() {
  console.log('================================================================');
  console.log('  CORVO PROCUREMENT INTELLIGENCE — FINAL SUBMISSION VALIDATION  ');
  console.log('================================================================\n');

  // 0. Connect to MongoDB if available
  try {
    await connectDatabase();
  } catch (err: any) {
    console.warn(`[DB] Notice: ${err.message}`);
  }

  const taskKitDir = findTaskKitDir();
  const submissionDir = path.resolve(__dirname, '../submission');
  const rootSubmissionDir = path.resolve(taskKitDir, 'submission');

  if (!fs.existsSync(submissionDir)) {
    fs.mkdirSync(submissionDir, { recursive: true });
  }
  if (!fs.existsSync(rootSubmissionDir)) {
    fs.mkdirSync(rootSubmissionDir, { recursive: true });
  }

  const batchService = new BatchService();
  const exportService = new ExportService();
  const policyService = new PolicyService();

  // 1. Locate hidden_pr_batch.csv
  const hiddenBatchPath = path.join(taskKitDir, 'pr_batches/hidden_pr_batch.csv');
  if (!fs.existsSync(hiddenBatchPath)) {
    console.error(`[Error] Could not find blind-test dataset: ${hiddenBatchPath}`);
    process.exit(1);
  }

  const rawCsv = fs.readFileSync(hiddenBatchPath, 'utf-8');
  const rawLines = rawCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const dataLineCount = rawLines.length - 1; // Subtract header
  console.log(`[Batch Input] Loaded hidden_pr_batch.csv: ${dataLineCount} data rows (+ 1 header row).`);

  if (dataLineCount !== 190) {
    console.warn(`[Warning] Expected 190 data rows, found ${dataLineCount}.`);
  }

  // -------------------------------------------------------------
  // PART 1: Run 1 — Baseline Policy v5.0 Engine Execution
  // -------------------------------------------------------------
  console.log('\n--- [Part 1/3] Generating Run 1 (Corvo Policy v5.0 Baseline) ---');
  const policyV5 = (await policyService.getPolicyByVersion('5.0')) || DEFAULT_POLICY_V5;
  const run1Result = await batchService.processBatchCSV(rawCsv, 'hidden_pr_batch.csv', policyV5);

  console.log(`  Processed PR lines: ${run1Result.csv_rows.length}`);
  console.log(`  Total Requirement Groups: ${run1Result.total_requirements}`);
  console.log(`  Total POs created: ${run1Result.total_pos}`);
  console.log(`  Total Sourcing Requests: ${run1Result.total_sourcing_requests}`);
  console.log(`  Total Batch Value (INR): ₹${run1Result.total_value_inr.toLocaleString('en-IN')}`);

  const run1Csv = exportService.generateDecisionsCSV(run1Result.csv_rows);
  const run1Path = path.join(submissionDir, 'jatin__run1.csv');
  const rootRun1Path = path.join(rootSubmissionDir, 'jatin__run1.csv');
  fs.writeFileSync(run1Path, run1Csv, 'utf-8');
  fs.writeFileSync(rootRun1Path, run1Csv, 'utf-8');
  // Also preserve corvo__run1.csv for backwards compatibility
  fs.writeFileSync(path.join(submissionDir, 'corvo__run1.csv'), run1Csv, 'utf-8');
  fs.writeFileSync(path.join(rootSubmissionDir, 'corvo__run1.csv'), run1Csv, 'utf-8');
  console.log(`  ✅ Written Run 1 to ${run1Path} and ${rootRun1Path}`);

  // -------------------------------------------------------------
  // PART 2: Run 2 — Actual Policy Studio Amendment Workflow (v5.1)
  // -------------------------------------------------------------
  console.log('\n--- [Part 2/3] Generating Run 2 via Policy Studio Amendment Workflow ---');
  
  // Locate official Amendment PDF
  const candidatePdfPaths = [
    path.join(taskKitDir, 'Corvo_Policy_Amendment_1_v5.1.pdf'),
    path.resolve(__dirname, '../Corvo_Policy_Amendment_1_v5.1.pdf'),
    path.join(taskKitDir, 'contracts/Corvo_Policy_Amendment_1_v5.1.pdf')
  ];

  let amendmentPdfPath = candidatePdfPaths.find((p) => fs.existsSync(p));
  if (!amendmentPdfPath) {
    console.error('[Error] Could not find Corvo_Policy_Amendment_1_v5.1.pdf');
    process.exit(1);
  }

  console.log(`  Found Policy Amendment PDF: ${amendmentPdfPath}`);
  const amendmentBuffer = fs.readFileSync(amendmentPdfPath);

  // Step 2a: Propose Amendment through PolicyService (simulating UI PDF upload)
  console.log('  [2a] Proposing amendment via PolicyService.proposeAmendment()...');
  const proposeResult = await policyService.proposeAmendment({
    fileBuffer: amendmentBuffer,
    filename: 'Corvo_Policy_Amendment_1_v5.1.pdf'
  });

  console.log(`    Draft Version: ${proposeResult.draftPolicy.version}`);
  console.log(`    Effective Date: ${proposeResult.draftPolicy.effective_date}`);
  console.log(`    Title: ${proposeResult.draftPolicy.title}`);
  console.log(`    Validation Passed: ${proposeResult.validation.isValid}`);
  console.log(`    Detected Clauses: ${(proposeResult.proposal.clauses || []).map((c) => c.id).join(', ')}`);
  console.log(`    Summary: ${proposeResult.proposal.amendment_summary}`);

  // Step 2b: Approve Policy through PolicyService (simulating Admin/CFO Approval)
  console.log('  [2b] Approving amendment via PolicyService.approvePolicy()...');
  const approvedPolicy = await policyService.approvePolicy(
    proposeResult.draftPolicy.version,
    'CFO (Chief Financial Officer)'
  );
  console.log(`    Policy ${approvedPolicy.version} Status: ${approvedPolicy.status} (Approved by ${approvedPolicy.approved_by})`);

  // Step 2c: Execute Batch Processing under Approved Policy v5.1
  console.log('  [2c] Executing batch processing under newly activated Policy v5.1...');
  const run2Result = await batchService.processBatchCSV(rawCsv, 'hidden_pr_batch.csv', approvedPolicy);

  console.log(`  Processed PR lines: ${run2Result.csv_rows.length}`);
  console.log(`  Total Requirement Groups: ${run2Result.total_requirements}`);
  console.log(`  Total POs created: ${run2Result.total_pos}`);
  console.log(`  Total Sourcing Requests: ${run2Result.total_sourcing_requests}`);
  console.log(`  Total Batch Value (INR): ₹${run2Result.total_value_inr.toLocaleString('en-IN')}`);

  const run2Csv = exportService.generateDecisionsCSV(run2Result.csv_rows);
  const run2Path = path.join(submissionDir, 'jatin__run2.csv');
  const rootRun2Path = path.join(rootSubmissionDir, 'jatin__run2.csv');
  fs.writeFileSync(run2Path, run2Csv, 'utf-8');
  fs.writeFileSync(rootRun2Path, run2Csv, 'utf-8');
  // Also preserve corvo__run2.csv for backwards compatibility
  fs.writeFileSync(path.join(submissionDir, 'corvo__run2.csv'), run2Csv, 'utf-8');
  fs.writeFileSync(path.join(rootSubmissionDir, 'corvo__run2.csv'), run2Csv, 'utf-8');
  console.log(`  ✅ Written Run 2 to ${run2Path} and ${rootRun2Path}`);

  // -------------------------------------------------------------
  // PART 3: Preferred Suppliers Matrix as of 2026-12-01
  // -------------------------------------------------------------
  console.log('\n--- [Part 3/3] Generating Preferred Suppliers Matrix (as of 2026-12-01) ---');
  const preferredCsv = await exportService.generatePreferredSuppliersCSV('2026-12-01');
  const preferredRows = preferredCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  console.log(`  Preferred Supplier Matrix rows: ${preferredRows.length - 1} (+ 1 header row)`);

  const preferredPath = path.join(submissionDir, 'jatin__preferred.csv');
  const rootPreferredPath = path.join(rootSubmissionDir, 'jatin__preferred.csv');
  fs.writeFileSync(preferredPath, preferredCsv, 'utf-8');
  fs.writeFileSync(rootPreferredPath, preferredCsv, 'utf-8');
  // Also preserve corvo__preferred.csv for backwards compatibility
  fs.writeFileSync(path.join(submissionDir, 'corvo__preferred.csv'), preferredCsv, 'utf-8');
  fs.writeFileSync(path.join(rootSubmissionDir, 'corvo__preferred.csv'), preferredCsv, 'utf-8');
  console.log(`  ✅ Written Preferred Suppliers to ${preferredPath} and ${rootPreferredPath}`);

  // -------------------------------------------------------------
  // PART 4: Verification & Consistency Check
  // -------------------------------------------------------------
  console.log('\n--- [Part 4] Verification & Consistency Audit ---');

  // Verify Line Counts
  if (run1Result.csv_rows.length !== 190 || run2Result.csv_rows.length !== 190) {
    throw new Error(`Row count mismatch: Run 1 has ${run1Result.csv_rows.length}, Run 2 has ${run2Result.csv_rows.length}, expected 190.`);
  }
  console.log('  ✅ Exactly 190/190 input lines accounted for in both Run 1 and Run 2.');

  // Verify Line Keys Matching
  for (let i = 0; i < 190; i++) {
    const r1 = run1Result.csv_rows[i];
    const r2 = run2Result.csv_rows[i];
    if (r1.pr_no !== r2.pr_no || r1.pr_line !== r2.pr_line) {
      throw new Error(`Row alignment error at index ${i}: Run 1 is ${r1.pr_no}/${r1.pr_line}, Run 2 is ${r2.pr_no}/${r2.pr_line}`);
    }
  }
  console.log('  ✅ Identical PR line sequences preserved in Run 1 and Run 2.');

  // Check invalid PR lines (PR-26-00674/1)
  const inv1 = run1Result.csv_rows.find((r) => r.pr_no === 'PR-26-00674');
  const inv2 = run2Result.csv_rows.find((r) => r.pr_no === 'PR-26-00674');
  if (inv1 && inv2) {
    console.log(`  ✅ PR-26-00674 (quantity 0) properly handled without dropping:`);
    console.log(`     Decision: ${inv1.decision}, Route: ${inv1.route}, Reason: "${inv1.reason}"`);
  }

  // Count differences between Run 1 and Run 2
  let diffCount = 0;
  const changedPrs: Array<{ pr_no: string; item: string; run1_route: string; run2_route: string; reason: string }> = [];

  for (let i = 0; i < 190; i++) {
    const r1 = run1Result.csv_rows[i];
    const r2 = run2Result.csv_rows[i];
    if (r1.route !== r2.route || r1.decision !== r2.decision || r1.supplier_id !== r2.supplier_id) {
      diffCount++;
      changedPrs.push({
        pr_no: r1.pr_no,
        item: r1.resolved_item_code,
        run1_route: r1.route,
        run2_route: r2.route,
        reason: r2.reason
      });
    }
  }

  console.log(`\n  Policy Shift Analysis (Policy v5.0 -> Policy v5.1):`);
  console.log(`  Total PR lines with altered routing: ${diffCount} lines`);
  for (const c of changedPrs) {
    console.log(`   - ${c.pr_no} (${c.item}): [v5.0 ${c.run1_route}] -> [v5.1 ${c.run2_route}] | Reason: ${c.reason.slice(0, 80)}...`);
  }

  console.log('\n================================================================');
  console.log('  SUBMISSION VALIDATION COMPLETE: ALL 3 CSVs GENERATED & VERIFIED');
  console.log('================================================================');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Submission generation failed:', err);
  process.exit(1);
});
