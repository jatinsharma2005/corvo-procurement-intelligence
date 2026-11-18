import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../apps/api/src/server';
import { connectDatabase } from '../../apps/api/src/models';
import { UserModel } from '../../apps/api/src/models/User';
import { AuditLogModel } from '../../apps/api/src/models/AuditLog';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../apps/api/src/config';
import http from 'http';

describe('Option B: Admin-Controlled User Management & RBAC Security Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const adminPassword = 'AdminSecret2026!';
  const buyerPassword = 'BuyerSecret2026!';
  const inactivePassword = 'InactiveSecret2026!';

  let adminUser: any;
  let buyerUser: any;
  let inactiveUser: any;

  let adminToken: string;
  let buyerToken: string;

  async function apiFetch(endpoint: string, options: RequestInit = {}, token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers
    });
  }

  beforeAll(async () => {
    await connectDatabase();

    await UserModel.deleteMany({
      email: {
        $in: [
          'rbac-admin@corvo.internal',
          'rbac-buyer@corvo.internal',
          'rbac-inactive@corvo.internal',
          'kavita.nair@corvo.internal',
          'shortpass@corvo.internal',
          'solitary-admin@corvo.internal'
        ]
      }
    });

    const adminHash = await bcrypt.hash(adminPassword, 6);
    const buyerHash = await bcrypt.hash(buyerPassword, 6);
    const inactiveHash = await bcrypt.hash(inactivePassword, 6);

    adminUser = await UserModel.findOneAndUpdate(
      { email: 'rbac-admin@corvo.internal' },
      {
        name: 'Chief Administrator',
        email: 'rbac-admin@corvo.internal',
        passwordHash: adminHash,
        role: 'ADMIN',
        isActive: true,
        department: 'Governance',
        plant: 'PUN1'
      },
      { upsert: true, new: true }
    );

    buyerUser = await UserModel.findOneAndUpdate(
      { email: 'rbac-buyer@corvo.internal' },
      {
        name: 'Lead Buyer',
        email: 'rbac-buyer@corvo.internal',
        passwordHash: buyerHash,
        role: 'BUYER',
        isActive: true,
        department: 'Procurement',
        plant: 'PUN1'
      },
      { upsert: true, new: true }
    );

    inactiveUser = await UserModel.findOneAndUpdate(
      { email: 'rbac-inactive@corvo.internal' },
      {
        name: 'Disabled User',
        email: 'rbac-inactive@corvo.internal',
        passwordHash: inactiveHash,
        role: 'BUYER',
        isActive: false,
        department: 'Former'
      },
      { upsert: true, new: true }
    );

    // Initial tokens directly for API calls
    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'ADMIN', name: adminUser.name },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    buyerToken = jwt.sign(
      { id: buyerUser.id, email: buyerUser.email, role: 'BUYER', name: buyerUser.name },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Start ephemeral test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Clean up created test users
    await UserModel.deleteMany({
      email: { $in: ['rbac-admin@corvo.internal', 'rbac-buyer@corvo.internal', 'rbac-inactive@corvo.internal', 'kavita.nair@corvo.internal'] }
    });
    if (server) {
      (server as any).closeAllConnections?.();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        setTimeout(resolve, 500);
      });
    }
  });

  describe('1. Authentication Workflow', () => {
    it('Admin login succeeds and returns valid JWT with verified role', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'rbac-admin@corvo.internal',
          password: adminPassword
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.role).toBe('ADMIN');
      expect(data.user.email).toBe('rbac-admin@corvo.internal');
      expect(data.user.passwordHash).toBeUndefined();
    });

    it('Buyer login succeeds and returns valid JWT with verified role', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'rbac-buyer@corvo.internal',
          password: buyerPassword
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.role).toBe('BUYER');
      expect(data.user.passwordHash).toBeUndefined();
    });

    it('Rejects invalid password with 401', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'rbac-admin@corvo.internal',
          password: 'CompletelyWrongPassword'
        })
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Invalid credentials');
    });

    it('Rejects inactive user with 403', async () => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'rbac-inactive@corvo.internal',
          password: inactivePassword
        })
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('inactive');
    });

    it('Rejects expired JWT with 401 on protected endpoint', async () => {
      const expiredToken = jwt.sign(
        { id: adminUser.id, email: adminUser.email, role: 'ADMIN' },
        config.jwtSecret,
        { expiresIn: '-10s' }
      );
      const res = await apiFetch('/api/auth/me', {}, expiredToken);
      expect(res.status).toBe(401);
    });

    it('Session persists and GET /api/auth/me returns database-verified user', async () => {
      const res = await apiFetch('/api/auth/me', {}, adminToken);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe('rbac-admin@corvo.internal');
      expect(data.user.role).toBe('ADMIN');
      expect(data.user.passwordHash).toBeUndefined();
    });

    it('POST /api/auth/logout logs audit trail and returns success', async () => {
      const res = await apiFetch('/api/auth/logout', { method: 'POST' }, adminToken);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const log = await AuditLogModel.findOne({
        entity_type: 'AUTH',
        action: 'LOGOUT',
        entity_id: adminUser.id
      }).lean();
      expect(log).toBeDefined();
    });
  });

  describe('2. Authorization & RBAC Permissions', () => {
    it('Unauthenticated requests to protected endpoints return 401', async () => {
      const res = await apiFetch('/api/users');
      expect(res.status).toBe(401);
    });

    it('Admin can access GET /api/users with 200', async () => {
      const res = await apiFetch('/api/users', {}, adminToken);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.users)).toBe(true);
    });

    it('Buyer receives 403 on user management APIs', async () => {
      const getRes = await apiFetch('/api/users', {}, buyerToken);
      expect(getRes.status).toBe(403);

      const postRes = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Unauthorized User',
          email: 'unauth@corvo.internal',
          password: 'Password123!',
          role: 'BUYER'
        })
      }, buyerToken);
      expect(postRes.status).toBe(403);
    });

    it('Forged frontend token role (JWT role: ADMIN, but DB role: BUYER) is strictly rejected with 403', async () => {
      // Craft a forged token claiming role: 'ADMIN' for the BUYER user ID
      const forgedToken = jwt.sign(
        { id: buyerUser.id, email: buyerUser.email, role: 'ADMIN', name: buyerUser.name },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await apiFetch('/api/users', {}, forgedToken);
      // Because backend queries database for the user role, it detects BUYER and rejects!
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden');
    });

    it('Policy activation is strictly restricted to ADMIN (Buyer gets 403)', async () => {
      const res = await apiFetch('/api/policies/5.0/approve', { method: 'POST' }, buyerToken);
      expect(res.status).toBe(403);
    });
  });

  describe('3. User Management CRUD & Validation', () => {
    let createdBuyerId: string;

    it('Admin can create a new Buyer with valid data', async () => {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Kavita Nair',
          email: 'kavita.nair@corvo.internal',
          password: 'StrongPassword2026!',
          role: 'BUYER',
          department: 'Procurement',
          plant: 'CHK1'
        })
      }, adminToken);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.name).toBe('Kavita Nair');
      expect(data.user.email).toBe('kavita.nair@corvo.internal');
      expect(data.user.role).toBe('BUYER');
      expect(data.user.isActive).toBe(true);
      expect(data.user.passwordHash).toBeUndefined(); // Never exposed!

      createdBuyerId = data.user._id;

      // Verify password stored in DB is hashed with bcrypt
      const dbUser = await UserModel.findById(createdBuyerId);
      expect(dbUser).toBeDefined();
      expect(dbUser!.passwordHash).not.toBe('StrongPassword2026!');
      expect(dbUser!.passwordHash.startsWith('$2')).toBe(true);
      expect(await bcrypt.compare('StrongPassword2026!', dbUser!.passwordHash)).toBe(true);
    });

    it('Duplicate email registration is rejected with 409 Conflict', async () => {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Duplicate Kavita',
          email: 'kavita.nair@corvo.internal',
          password: 'AnotherPassword2026!',
          role: 'BUYER'
        })
      }, adminToken);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('already exists');
    });

    it('Invalid email format is rejected with 400', async () => {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Email User',
          email: 'not-an-email-address',
          password: 'Password123!',
          role: 'BUYER'
        })
      }, adminToken);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid email');
    });

    it('Password shorter than 8 characters is rejected with 400', async () => {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Short Pass User',
          email: 'shortpass@corvo.internal',
          password: 'short',
          role: 'BUYER'
        })
      }, adminToken);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('at least 8 characters');
    });

    it('Admin can edit user details and change role', async () => {
      const res = await apiFetch(`/api/users/${createdBuyerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Kavita N. Sen',
          role: 'ADMIN',
          department: 'Strategic Sourcing'
        })
      }, adminToken);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.name).toBe('Kavita N. Sen');
      expect(data.user.role).toBe('ADMIN');
      expect(data.user.department).toBe('Strategic Sourcing');
    });

    it('Admin can deactivate and reactivate an account', async () => {
      // Deactivate
      const deactRes = await apiFetch(`/api/users/${createdBuyerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false })
      }, adminToken);
      expect(deactRes.status).toBe(200);
      expect((await deactRes.json()).user.isActive).toBe(false);

      // Reactivate
      const reactRes = await apiFetch(`/api/users/${createdBuyerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true })
      }, adminToken);
      expect(reactRes.status).toBe(200);
      expect((await reactRes.json()).user.isActive).toBe(true);
    });

    it('Admin can reset a user password through POST /api/users/:id/reset-password', async () => {
      const res = await apiFetch(`/api/users/${createdBuyerId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: 'BrandNewPassword2026!' })
      }, adminToken);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify the new password works for login
      const loginRes = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'kavita.nair@corvo.internal',
          password: 'BrandNewPassword2026!'
        })
      });
      expect(loginRes.status).toBe(200);
    });

    it('Prevents deactivating or demoting the last active administrator', async () => {
      // Create a temporary solitary admin user
      const solitaryAdmin = await UserModel.create({
        name: 'Solitary Admin',
        email: 'solitary-admin@corvo.internal',
        passwordHash: await bcrypt.hash('Password123!', 4),
        role: 'ADMIN',
        isActive: true
      });

      // Temporarily mark all other admins as inactive in one quick updateMany
      await UserModel.updateMany({ _id: { $ne: solitaryAdmin._id } }, { isActive: false });

      const solitaryToken = jwt.sign(
        { id: solitaryAdmin.id, email: solitaryAdmin.email, role: 'ADMIN', name: solitaryAdmin.name },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      // Attempt to deactivate the last remaining admin
      const res = await apiFetch(`/api/users/${solitaryAdmin._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false })
      }, solitaryToken);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cannot deactivate the last active administrator');

      // Attempt to demote the last remaining admin to BUYER
      const demoteRes = await apiFetch(`/api/users/${solitaryAdmin._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: 'BUYER' })
      }, solitaryToken);
      expect(demoteRes.status).toBe(400);
      expect((await demoteRes.json()).error).toContain('Cannot demote the last active administrator');

      // Restore all other accounts and delete solitary admin
      await UserModel.updateMany({ _id: { $ne: solitaryAdmin._id } }, { isActive: true });
      await UserModel.findByIdAndDelete(solitaryAdmin._id);
    });

    it('Records administrative changes in AuditLog with actor details', async () => {
      const auditEntry = await AuditLogModel.findOne({
        entity_type: 'USER',
        entity_id: createdBuyerId,
        action: 'PASSWORD_RESET'
      }).lean();

      expect(auditEntry).toBeDefined();
      expect(auditEntry!.actor.user_id).toBe(adminUser.id);
      expect(auditEntry!.actor.role).toBe('ADMIN');
      expect(auditEntry!.details.email).toBe('kavita.nair@corvo.internal');
      expect(auditEntry!.details.password).toBeUndefined(); // Never log secrets!
      expect(auditEntry!.details.passwordHash).toBeUndefined();
    });
  });
});
