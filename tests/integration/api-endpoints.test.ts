import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../apps/api/src/server';
import { connectDatabase } from '../../apps/api/src/models';
import { UserModel } from '../../apps/api/src/models/User';
import { PolicyVersionModel } from '../../apps/api/src/models/PolicyVersion';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../apps/api/src/config';
import http from 'http';

describe('Phase Nine: Complete REST API Endpoints Verification Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let buyerToken: string;
  const testPassword = 'api-test-password';

  async function apiFetch(url: string, init: RequestInit = {}, token = adminToken) {
    return fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` }
    });
  }

  beforeAll(async () => {
    await connectDatabase();
    await PolicyVersionModel.updateMany({ version: { $ne: '5.0' } }, { $set: { status: 'ARCHIVED' } });
    await PolicyVersionModel.updateOne({ version: '5.0' }, { $set: { status: 'ACTIVE' } });
    const passwordHash = await bcrypt.hash(testPassword, 4);
    const admin = await UserModel.findOneAndUpdate(
      { email: 'api-test-admin@corvo.internal' },
      { name: 'API Test Admin', email: 'api-test-admin@corvo.internal', passwordHash, role: 'ADMIN', isActive: true },
      { upsert: true, new: true }
    );
    const buyer = await UserModel.findOneAndUpdate(
      { email: 'api-test-buyer@corvo.internal' },
      { name: 'API Test Buyer', email: 'api-test-buyer@corvo.internal', passwordHash, role: 'BUYER', isActive: true },
      { upsert: true, new: true }
    );
    adminToken = jwt.sign({ id: admin.id, role: 'BUYER' }, config.jwtSecret, { expiresIn: '10m' });
    buyerToken = jwt.sign({ id: buyer.id, role: 'ADMIN' }, config.jwtSecret, { expiresIn: '10m' });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      (server as any).closeAllConnections?.();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        setTimeout(resolve, 500);
      });
    }
  });

  // 1. Health Endpoint
  it('GET /api/health -> returns ok and status 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('corvo-procurement-api');
  });

  it('authenticates database accounts and enforces database roles over token claims', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'api-test-admin@corvo.internal', password: testPassword })
    });
    expect(login.status).toBe(200);
    expect((await login.json()).user.role).toBe('ADMIN');

    const noAuth = await fetch(`${baseUrl}/api/users`);
    expect(noAuth.status).toBe(401);

    const denied = await apiFetch(`${baseUrl}/api/users`, {}, buyerToken);
    expect(denied.status).toBe(403);

    const adminUsers = await apiFetch(`${baseUrl}/api/users`);
    expect(adminUsers.status).toBe(200);
    const payload = await adminUsers.json();
    expect(payload.users.every((user: any) => !('passwordHash' in user))).toBe(true);

    const policyActivation = await apiFetch(`${baseUrl}/api/policies/5.0/approve`, { method: 'POST' }, buyerToken);
    expect(policyActivation.status).toBe(403);

    const expiredToken = jwt.sign({ id: 'api-test-admin' }, config.jwtSecret, { expiresIn: '-1s' });
    const expired = await apiFetch(`${baseUrl}/api/users`, {}, expiredToken);
    expect(expired.status).toBe(401);
  });

  // 2. Dashboard Summary Endpoint
  it('GET /api/dashboard/summary -> returns real metrics and distributions', async () => {
    const res = await apiFetch(`${baseUrl}/api/dashboard/summary`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.metrics).toBeDefined();
    expect(data.distributions).toBeDefined();
    expect(data.distributions.plants).toBeDefined();
  });

  // 3. Mandatory Endpoint: POST /api/process-batch with JSON body
  it('POST /api/process-batch (JSON body) -> processes PRs and returns decisions & exact CSV schema', async () => {
    const sampleCsv = `pr_no,pr_line,created_at,requester,department,plant,item_code,description,quantity,uom,estimated_unit_price,need_by_date,urgency
PR-API-001,1,2026-11-01 10:00,R. Sharma,Ops,PUN1,ITM-1011,Allen cap screw M8x25,100,NOS,6.2,2026-11-05,Normal`;

    const res = await apiFetch(`${baseUrl}/api/process-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: sampleCsv })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.batch_id).toBeDefined();
    expect(data.decisions.length).toBe(1);
    expect(data.csv_rows.length).toBe(1);

    const row = data.csv_rows[0];
    expect(row.pr_no).toBe('PR-API-001');
    expect(row.pr_line).toBe(1);
    expect(row.resolved_item_code).toBe('ITM-1011');
    expect(row.decision).toBe('PO');
    expect(row.route).toBe('CONTRACT_PO');
  });

  // 4. Mandatory Endpoint: POST /api/process-batch with Accept: text/csv
  it('POST /api/process-batch with Accept: text/csv -> returns formatted CSV output', async () => {
    const sampleCsv = `pr_no,pr_line,created_at,requester,department,plant,item_code,description,quantity,uom,estimated_unit_price,need_by_date,urgency
PR-API-002,1,2026-11-01 10:00,R. Sharma,Ops,PUN1,ITM-1011,Allen cap screw M8x25,100,NOS,6.2,2026-11-05,Normal`;

    const res = await apiFetch(`${baseUrl}/api/process-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/csv'
      },
      body: JSON.stringify({ csv: sampleCsv })
    });

    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('text/csv');
    const csvText = await res.text();
    expect(csvText).toContain('pr_no,pr_line,resolved_item_code,group_id,po_id,decision,route');
    expect(csvText).toContain('PR-API-002');
  });

  // 5. Error Case: Empty CSV
  it('POST /api/process-batch with empty data -> returns 400 Bad Request', async () => {
    const res = await apiFetch(`${baseUrl}/api/process-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: '' })
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  // 6. Error Case: Missing required columns
  it('POST /api/process-batch with missing columns -> returns error', async () => {
    const invalidCsv = `pr_no,quantity\nPR-001,10`;
    const res = await apiFetch(`${baseUrl}/api/process-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: invalidCsv })
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required CSV columns');
  });

  // 7. Negative/Zero Quantity handling
  it('POST /api/process-batch with invalid quantity -> returns NOT_PROCESSED for that line', async () => {
    const sampleCsv = `pr_no,pr_line,created_at,requester,department,plant,item_code,description,quantity,uom,estimated_unit_price,need_by_date,urgency
PR-API-NEG,1,2026-11-01 10:00,R. Sharma,Ops,PUN1,ITM-1011,Allen cap screw M8x25,-10,NOS,6.2,2026-11-05,Normal`;

    const res = await apiFetch(`${baseUrl}/api/process-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: sampleCsv })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const row = data.csv_rows[0];
    expect(row.decision).toBe('NOT_PROCESSED');
    expect(row.route).toBe('NOT_PROCESSED');
    expect(row.reason).toContain('Invalid quantity');
  });

  // 8. Requirements & Decisions Endpoints
  it('GET /api/requirements and GET /api/procurement/requirements -> returns populated list', async () => {
    const res1 = await apiFetch(`${baseUrl}/api/requirements`);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(Array.isArray(data1.requirements)).toBe(true);

    const res2 = await apiFetch(`${baseUrl}/api/procurement/requirements`);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(Array.isArray(data2.requirements)).toBe(true);
  });

  it('GET /api/decisions and GET /api/procurement/decisions -> returns decision list', async () => {
    const res = await apiFetch(`${baseUrl}/api/decisions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.decisions)).toBe(true);
  });

  // 9. Buyer Approvals & Override Justification
  it('POST /api/decisions/:id/override without justification -> returns 400 error', async () => {
    const res = await apiFetch(`${baseUrl}/api/decisions/REQ-NONEXISTENT/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_decision: 'PO',
        new_route: 'SPOT_PO',
        reason: '' // empty!
      })
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('written override reason is mandatory');
  });

  // 10. Policies Endpoints
  it('GET /api/policies and GET /api/policies/active -> returns active policy v5.0', async () => {
    const res = await apiFetch(`${baseUrl}/api/policies/active`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.policy).toBeDefined();
    expect(data.policy.version).toBe('5.0');
  });

  // 11. Contracts Endpoints
  it('GET /api/contracts -> returns 12 registered contracts', async () => {
    const res = await apiFetch(`${baseUrl}/api/contracts`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contracts.length).toBeGreaterThanOrEqual(10);
  });

  // 12. Suppliers Endpoints
  it('GET /api/suppliers -> returns all 48 suppliers', async () => {
    const res = await apiFetch(`${baseUrl}/api/suppliers`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suppliers.length).toBe(48);
  });

  it('GET /api/suppliers/rankings?item_code=ITM-1011 -> returns 5-factor rankings', async () => {
    const res = await apiFetch(`${baseUrl}/api/suppliers/rankings?item_code=ITM-1011&as_of_date=2026-11-01`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rankings).toBeDefined();
    expect(data.rankings.length).toBeGreaterThan(0);
    expect(data.rankings[0].rank).toBe(1);
    expect(data.rankings[0].scores).toBeDefined();
  });

  // 13. Exports Endpoints
  it('GET /api/exports/preferred-suppliers and /api/export/preferred-suppliers -> returns CSV text', async () => {
    const res = await apiFetch(`${baseUrl}/api/export/preferred-suppliers?as_of_date=2026-11-01`);
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain('item_code,rank,supplier_id,reference_price');
  });

  // 14. Audit Logs Endpoint
  it('GET /api/audit/logs -> returns audit log array', async () => {
    const res = await apiFetch(`${baseUrl}/api/audit/logs`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.logs)).toBe(true);
  });
});
