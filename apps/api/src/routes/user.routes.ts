import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();
const audit = new AuditService();

// Enforce ADMIN role across all /api/users endpoints
router.use(authMiddleware, requireRole('ADMIN'));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/users
router.get('/', async (req, res) => {
  const { search, role, status } = req.query;
  const query: any = {};
  if (search) {
    query.$or = [
      { name: { $regex: String(search), $options: 'i' } },
      { email: { $regex: String(search), $options: 'i' } }
    ];
  }
  if (role === 'ADMIN' || role === 'BUYER') query.role = role;
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  const users = await UserModel.find(query).select('-passwordHash').sort({ createdAt: -1 }).lean();
  res.json({ users });
});

// POST /api/users (Admin-only creation)
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password, role = 'BUYER', department, plant } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Full name must be at least 2 characters' });
  }
  const normalizedEmail = String(email).toLowerCase().trim();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }
  if (!['ADMIN', 'BUYER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be ADMIN or BUYER' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (await UserModel.exists({ email: normalizedEmail })) {
    return res.status(409).json({ error: 'A user with this email address already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await UserModel.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    department: department ? String(department).trim() : undefined,
    plant: plant ? String(plant).trim() : undefined,
    isActive: true,
    createdBy: req.user!.id
  });

  await audit.log({
    entity_type: 'USER',
    entity_id: user.id,
    action: 'CREATE',
    actor: { user_id: req.user!.id, name: req.user!.name, role: req.user!.role },
    details: { email: user.email, role, isActive: true, createdBy: req.user!.id }
  });

  res.status(201).json({ user: await UserModel.findById(user._id).select('-passwordHash').lean() });
});

// PATCH /api/users/:id (Admin-only update)
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  const target = await UserModel.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const allowed: any = {};
  if (typeof req.body.name === 'string') {
    if (req.body.name.trim().length < 2) return res.status(400).json({ error: 'Full name must be at least 2 characters' });
    allowed.name = req.body.name.trim();
  }
  if (typeof req.body.email === 'string') {
    const newEmail = req.body.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(newEmail)) return res.status(400).json({ error: 'Invalid email format' });
    if (newEmail !== target.email) {
      const exists = await UserModel.findOne({ email: newEmail, _id: { $ne: target._id } });
      if (exists) return res.status(409).json({ error: 'A user with this email already exists' });
      allowed.email = newEmail;
    }
  }
  if (['ADMIN', 'BUYER'].includes(req.body.role)) allowed.role = req.body.role;
  if (typeof req.body.department === 'string') allowed.department = req.body.department.trim();
  if (typeof req.body.plant === 'string') allowed.plant = req.body.plant.trim();
  if (typeof req.body.isActive === 'boolean') allowed.isActive = req.body.isActive;
  if (req.body.password) {
    if (String(req.body.password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    allowed.passwordHash = await bcrypt.hash(req.body.password, 12);
  }

  // Last Admin Protections
  if (target.role === 'ADMIN' && target.isActive && allowed.isActive === false) {
    const activeAdmins = await UserModel.countDocuments({ role: 'ADMIN', isActive: true });
    if (activeAdmins <= 1) return res.status(400).json({ error: 'Cannot deactivate the last active administrator' });
  }
  if (target.role === 'ADMIN' && target.isActive && allowed.role === 'BUYER') {
    const activeAdmins = await UserModel.countDocuments({ role: 'ADMIN', isActive: true });
    if (activeAdmins <= 1) return res.status(400).json({ error: 'Cannot demote the last active administrator' });
  }

  Object.assign(target, allowed);
  await target.save();

  await audit.log({
    entity_type: 'USER',
    entity_id: target.id,
    action: allowed.passwordHash ? 'PASSWORD_RESET' : 'UPDATE',
    actor: { user_id: req.user!.id, name: req.user!.name, role: req.user!.role },
    details: allowed.passwordHash
      ? { passwordReset: true, email: target.email }
      : { ...allowed, passwordHash: undefined, email: target.email }
  });

  res.json({ user: await UserModel.findById(target._id).select('-passwordHash').lean() });
});

// POST /api/users/:id/reset-password (Admin-only password reset)
router.post('/:id/reset-password', async (req: AuthenticatedRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  const { password } = req.body;
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const target = await UserModel.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  target.passwordHash = await bcrypt.hash(password, 12);
  await target.save();

  await audit.log({
    entity_type: 'USER',
    entity_id: target.id,
    action: 'PASSWORD_RESET',
    actor: { user_id: req.user!.id, name: req.user!.name, role: req.user!.role },
    details: { email: target.email, role: target.role }
  });

  return res.json({ success: true, message: 'Password reset successfully' });
});

// DELETE /api/users/:id (Admin-only deletion with last-admin guard)
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  const target = await UserModel.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.role === 'ADMIN' && target.isActive) {
    const activeAdmins = await UserModel.countDocuments({ role: 'ADMIN', isActive: true });
    if (activeAdmins <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last active administrator' });
    }
  }

  await UserModel.findByIdAndDelete(req.params.id);
  await audit.log({
    entity_type: 'USER',
    entity_id: target.id,
    action: 'DELETE',
    actor: { user_id: req.user!.id, name: req.user!.name, role: req.user!.role },
    details: { email: target.email, role: target.role }
  });

  return res.json({ success: true, message: 'User deleted successfully' });
});

export const userRoutes = router;
