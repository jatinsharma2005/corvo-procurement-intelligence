import { describe, it, expect, beforeAll } from 'vitest';
import { ContractService } from '../../apps/api/src/services/contract.service';
import { findTaskKitDir } from '../../apps/api/src/services/data-store.service';
import fs from 'fs';
import path from 'path';

describe('Phase Eight: Contract PDF Extraction & Integration Test', () => {
  let contractService: ContractService;
  let taskKitDir: string;

  beforeAll(() => {
    contractService = new ContractService();
    taskKitDir = findTaskKitDir();
  });

  it('extracts real signed contract PDF RC-2026-031 (Pneumatic Point)', async () => {
    const pdfPath = path.join(taskKitDir, 'contracts/pdf/RC-2026-031.pdf');
    if (!fs.existsSync(pdfPath)) {
      console.warn('PDF file not found at path:', pdfPath);
      return;
    }

    const buffer = fs.readFileSync(pdfPath);
    const extracted = await contractService.extractContractFromPDF(buffer, 'RC-2026-031.pdf');

    expect(extracted.contract_id).toBe('RC-2026-031');
    expect(extracted.supplier_id).toBe('S021');
    expect(extracted.value_cap).toBe(2000000);
    expect(extracted.lines).toBeDefined();

    // Verify covered lines in RC-2026-031
    expect(extracted.lines!['ITM-1036']).toBeDefined();
    expect(extracted.lines!['ITM-1036'].rate).toBe(3537.76);
  });

  it('extracts real signed contract PDF RC-2026-033 (Infoline Systems)', async () => {
    const pdfPath = path.join(taskKitDir, 'contracts/pdf/RC-2026-033.pdf');
    if (!fs.existsSync(pdfPath)) return;

    const buffer = fs.readFileSync(pdfPath);
    const extracted = await contractService.extractContractFromPDF(buffer, 'RC-2026-033.pdf');

    expect(extracted.contract_id).toBe('RC-2026-033');
    expect(extracted.supplier_id).toBe('S035');
    expect(extracted.value_cap).toBe(5000000);
    expect(extracted.lines).toBeDefined();
    expect(extracted.lines!['ITM-1056']).toBeDefined();
  });

  it('gracefully handles malformed or non-PDF buffers without crashing', async () => {
    const invalidBuffer = Buffer.from('NOT A REAL PDF FILE HEADER');
    const result = await contractService.extractContractFromPDF(invalidBuffer, 'corrupt.pdf');
    expect(result).toBeDefined();
    expect(result.contract_id).toBeDefined();
  });
});
