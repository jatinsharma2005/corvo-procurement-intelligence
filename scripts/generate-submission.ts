import fs from 'fs';
import path from 'path';
import { BatchService } from '../apps/api/src/services/batch.service';
import { ExportService } from '../apps/api/src/services/export.service';
import { PolicyService } from '../apps/api/src/services/policy.service';
import { DataStore, findTaskKitDir } from '../apps/api/src/services/data-store.service';
import { DEFAULT_POLICY_V5 } from '@corvo/policy-schema';

async function main() {
  console.log('--- Generating Official Blind Test Submission Artifacts ---');

  const submissionDir = path.resolve(__dirname, '../submission');
  if (!fs.existsSync(submissionDir)) {
    fs.mkdirSync(submissionDir, { recursive: true });
  }

  const batchService = new BatchService();
  const exportService = new ExportService();
  const policyService = new PolicyService();

  // Find sample_pr_batch.csv
  const taskKitDir = findTaskKitDir();
  const batchCsvPath = path.join(taskKitDir, 'pr_batches/sample_pr_batch.csv');
  if (!fs.existsSync(batchCsvPath)) {
    console.error(`Error: Could not find ${batchCsvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(batchCsvPath, 'utf-8');

  // 1. Run 1: Policy v5.0
  console.log('[1/3] Executing Run 1 (Corvo Policy v5.0)...');
  const run1Result = await batchService.processBatchCSV(csvContent, 'sample_pr_batch.csv', 'v5.0');
  const run1Csv = exportService.generateDecisionsCSV(run1Result.csv_rows);
  const run1Path = path.join(submissionDir, 'corvo__run1.csv');
  fs.writeFileSync(run1Path, run1Csv, 'utf-8');
  console.log(`  -> Generated ${run1Path} (${run1Result.csv_rows.length} rows)`);

  // 2. Run 2: Amended Policy v5.1 (e.g. Spot PO threshold increased to 1,00,000 INR)
  console.log('[2/3] Executing Run 2 (Amended Policy v5.1)...');
  const amendedPolicy = JSON.parse(JSON.stringify(DEFAULT_POLICY_V5));
  amendedPolicy.version = 'v5.1';
  amendedPolicy.title = 'Corvo Procurement Policy v5.1 (Amended Spot Threshold)';
  // Update spot rule threshold to 100000
  const spotRule = amendedPolicy.rules.find((r: any) => r.rule_id === 'RULE-002');
  if (spotRule && spotRule.condition.all) {
    const valCond = spotRule.condition.all.find((c: any) => c.field === 'group_value_inr');
    if (valCond) valCond.value = 100000;
  }

  const run2Result = await batchService.processBatchCSV(csvContent, 'sample_pr_batch.csv', amendedPolicy);
  const run2Csv = exportService.generateDecisionsCSV(run2Result.csv_rows);
  const run2Path = path.join(submissionDir, 'corvo__run2.csv');
  fs.writeFileSync(run2Path, run2Csv, 'utf-8');
  console.log(`  -> Generated ${run2Path} (${run2Result.csv_rows.length} rows)`);

  // 3. Preferred Suppliers Ranking CSV as of 2026-11-01
  console.log('[3/3] Generating Preferred Suppliers Matrix (as of 2026-11-01)...');
  const preferredCsv = await exportService.generatePreferredSuppliersCSV('2026-11-01');
  const preferredPath = path.join(submissionDir, 'corvo__preferred.csv');
  fs.writeFileSync(preferredPath, preferredCsv, 'utf-8');
  console.log(`  -> Generated ${preferredPath}`);

  console.log('\n--- All Submission Artifacts Successfully Generated ---');
}

main().catch((err) => {
  console.error('Submission generation error:', err);
  process.exit(1);
});
