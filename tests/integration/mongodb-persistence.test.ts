import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDatabase, mongoose } from '../../apps/api/src/models';
import { PurchaseRequestLineModel } from '../../apps/api/src/models/PurchaseRequest';
import { RequirementGroupModel } from '../../apps/api/src/models/RequirementGroup';
import { ProcurementDecisionModel } from '../../apps/api/src/models/ProcurementDecision';
import { BatchRunModel } from '../../apps/api/src/models/BatchRun';
import { UserModel } from '../../apps/api/src/models/User';
import { PolicyVersionModel } from '../../apps/api/src/models/PolicyVersion';
import { BatchService } from '../../apps/api/src/services/batch.service';
import fs from 'fs';
import path from 'path';

describe('Phase Two: Real MongoDB Data Persistence Test', () => {
  beforeAll(async () => {
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/corvo_procurement';
    await connectDatabase();
    await PolicyVersionModel.updateMany({ version: { $ne: '5.0' } }, { $set: { status: 'ARCHIVED' } });
    await PolicyVersionModel.updateOne({ version: '5.0' }, { $set: { status: 'ACTIVE' } });
  });

  afterAll(async () => {
    // Keep DB intact or disconnect
    await mongoose.disconnect();
  });

  it('verifies MongoDB connection state is active', () => {
    expect(mongoose.connection.readyState).toBe(1); // 1 = connected
  });

  it('verifies seeded collections (users, policy, master data)', async () => {
    const userCount = await UserModel.countDocuments();
    expect(userCount).toBeGreaterThanOrEqual(1);

    const activePolicy = await PolicyVersionModel.findOne({ status: 'ACTIVE' });
    expect(activePolicy).toBeDefined();
    expect(activePolicy?.version).toBe('5.0');
  });

  it('persists a new Purchase Request in MongoDB', async () => {
    const testPrNo = `PR-TEST-${Date.now()}`;
    const prLine = await PurchaseRequestLineModel.create({
      pr_no: testPrNo,
      pr_line: 1,
      created_at: new Date(),
      requester: 'Test Engineer',
      department: 'Maintenance',
      plant: 'PUN1',
      item_code: 'ITM-1011',
      description: 'Allen cap screw M8x25 test',
      quantity: 50,
      uom: 'NOS',
      estimated_unit_price: 6.2,
      need_by_date: new Date(Date.now() + 86400000 * 5),
      urgency: 'Normal',
      resolved_item_code: 'ITM-1011'
    });

    expect(prLine._id).toBeDefined();

    const retrieved = await PurchaseRequestLineModel.findOne({ pr_no: testPrNo }).lean();
    expect(retrieved).toBeDefined();
    expect(retrieved?.quantity).toBe(50);
    expect(retrieved?.plant).toBe('PUN1');
  });

  it('processes a batch and verifies persistence of BatchRun, Decisions, Groups, and Lines in MongoDB', async () => {
    const batchService = new BatchService();
    const testCsv = `pr_no,pr_line,created_at,requester,department,plant,item_code,description,quantity,uom,estimated_unit_price,need_by_date,urgency
PR-MONGO-001,1,2026-11-01 10:00,A. Sharma,Ops,PUN1,ITM-1011,Allen cap screw M8x25,100,NOS,6.2,2026-11-05,Normal
PR-MONGO-002,1,2026-11-02 11:00,B. Verma,Ops,PUN1,ITM-1011,Allen cap screw M8x25,150,NOS,6.2,2026-11-06,Normal`;

    const result = await batchService.processBatchCSV(testCsv, 'test_mongo_batch.csv');
    expect(result.batch_id).toBeDefined();

    // Verify BatchRun in MongoDB
    const batchDoc = await BatchRunModel.findOne({ batch_id: result.batch_id }).lean();
    expect(batchDoc).toBeDefined();
    expect(batchDoc?.total_lines).toBe(2);
    expect(batchDoc?.status).toBe('COMPLETED');

    // Verify RequirementGroup in MongoDB
    const groupDoc = await RequirementGroupModel.findOne({ batch_id: result.batch_id }).lean();
    expect(groupDoc).toBeDefined();
    expect(groupDoc?.resolved_item_code).toBe('ITM-1011');
    expect(groupDoc?.total_quantity).toBe(250);

    // Verify Decision in MongoDB
    const decDoc = await ProcurementDecisionModel.findOne({ batch_id: result.batch_id }).lean();
    expect(decDoc).toBeDefined();
    expect(decDoc?.decision).toBe('PO');
    expect(decDoc?.status).toBe('PENDING_APPROVAL');

    // Approve the decision in MongoDB
    await ProcurementDecisionModel.updateOne(
      { group_id: decDoc?.group_id },
      { $set: { status: 'APPROVED', approved_by: 'QA Lead', approved_at: new Date() } }
    );

    const approvedDoc = await ProcurementDecisionModel.findOne({ group_id: decDoc?.group_id }).lean();
    expect(approvedDoc?.status).toBe('APPROVED');
    expect(approvedDoc?.approved_by).toBe('QA Lead');

    // Verify lines persisted in MongoDB
    const lines = await PurchaseRequestLineModel.find({ batch_id: result.batch_id }).lean();
    expect(lines.length).toBe(2);
  });
});
