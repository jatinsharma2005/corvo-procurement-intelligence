import mongoose from 'mongoose';
import { ContractModel, IContract } from '../models/Contract';
import { Contract } from '@corvo/shared-types';
import { DataStore } from './data-store.service';
import pdfParse from 'pdf-parse';

export class ContractService {
  public async getAllContracts(): Promise<Contract[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await ContractModel.find().lean();
        if (docs.length > 0) {
          return docs.map((d: any) => ({
            contract_id: d.contract_id,
            supplier_id: d.supplier_id,
            supplier_name: d.supplier_name,
            start_date: typeof d.start_date === 'string' ? d.start_date : d.start_date.toISOString().split('T')[0],
            end_date: typeof d.end_date === 'string' ? d.end_date : d.end_date.toISOString().split('T')[0],
            value_cap: d.value_cap,
            consumed_value: d.consumed_value,
            lines: d.lines instanceof Map ? Object.fromEntries(d.lines) : d.lines || {},
            is_pdf_only: d.is_pdf_only,
            document_url: d.document_url
          }));
        }
      } catch (err: any) {
        console.warn(`[ContractService] DB read error: ${err.message}`);
      }
    }
    const dataStore = DataStore.getInstance();
    await dataStore.loadData();
    return dataStore.getContracts();
  }

  public async getContractById(contractId: string): Promise<Contract | null> {
    const contracts = await this.getAllContracts();
    return contracts.find((c) => c.contract_id === contractId) || null;
  }

  public async registerContract(contract: Contract): Promise<Contract> {
    if (mongoose.connection.readyState === 1) {
      try {
        const existing = await ContractModel.findOne({ contract_id: contract.contract_id });
        if (existing) {
          existing.supplier_id = contract.supplier_id;
          existing.supplier_name = contract.supplier_name;
          existing.start_date = new Date(contract.start_date);
          existing.end_date = new Date(contract.end_date);
          existing.value_cap = contract.value_cap;
          existing.consumed_value = contract.consumed_value;
          existing.lines = new Map(Object.entries(contract.lines));
          existing.is_pdf_only = contract.is_pdf_only || false;
          existing.document_url = contract.document_url;
          await existing.save();
          return contract;
        }

        const doc = new ContractModel({
          contract_id: contract.contract_id,
          supplier_id: contract.supplier_id,
          supplier_name: contract.supplier_name,
          start_date: new Date(contract.start_date),
          end_date: new Date(contract.end_date),
          value_cap: contract.value_cap,
          consumed_value: contract.consumed_value,
          lines: new Map(Object.entries(contract.lines)),
          is_pdf_only: contract.is_pdf_only || false,
          document_url: contract.document_url
        });
        await doc.save();
      } catch (err: any) {
        console.warn(`[ContractService] DB register error: ${err.message}`);
      }
    }
    return contract;
  }

  public async extractContractFromPDF(buffer: Buffer, filename: string): Promise<Partial<Contract>> {
    let text = '';
    try {
      const data = await pdfParse(buffer);
      text = data.text;
    } catch (err: any) {
      console.warn(`[ContractService] pdf-parse error: ${err.message}`);
    }

    const contractNoMatch = text.match(/Contract\s+No\.?\s*:\s*([A-Z0-9\-]+)/i) || filename.match(/(RC-202\d-\d{3})/i);
    const contractId = contractNoMatch ? contractNoMatch[1] : `RC-PDF-${Date.now().toString().slice(-4)}`;

    const sIdMatch = text.match(/Supplier\s+ID\s*[:\s]?\s*([A-Z0-9]+)/i);
    const supplierId = sIdMatch ? sIdMatch[1].trim() : 'S001';

    const sNameMatch = text.match(/and\s+([A-Za-z0-9\s]+?)(?:,\s*[A-Za-z\s]+)?\s*\(Supplier ID/i) ||
      text.match(/(?:between.*?and)\s+([A-Za-z0-9\s,\.]+?)\s*\(/i);
    const supplierName = sNameMatch ? sNameMatch[1].trim() : 'Extracted Supplier';

    const termMatch = text.match(/valid\s+from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
    const startDate = termMatch ? termMatch[1] : '2026-11-01';
    const endDate = termMatch ? termMatch[2] : '2027-10-31';

    const ceilingMatch = text.match(/not\s+exceed\s+INR\s+([\d,]+)/i);
    const valueCap = ceilingMatch ? parseFloat(ceilingMatch[1].replace(/,/g, '')) : 2000000;

    const lines: Record<string, import('@corvo/shared-types').ContractLine> = {};
    const lineMatches = text.matchAll(/(ITM-\d{4})\s*([A-Za-z0-9\s\-\/\.]+?)\s*(NOS|KG|LTR|MTR|PAIR|BKT|BRL|MON|QTR|JOB)\s*([\d,]+\.?\d*)/g);
    for (const m of lineMatches) {
      lines[m[1]] = {
        item_code: m[1],
        rate: parseFloat(m[4].replace(/,/g, '')),
        description: m[2].trim(),
        uom: m[3].trim()
      };
    }

    return {
      contract_id: contractId,
      supplier_id: supplierId,
      supplier_name: supplierName,
      start_date: startDate,
      end_date: endDate,
      value_cap: valueCap,
      consumed_value: 0,
      lines,
      is_pdf_only: true
    };
  }
}
