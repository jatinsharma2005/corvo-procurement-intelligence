import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { UserModel } from '../models/User';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();
const audit = new AuditService();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ error: 'Account is inactive. Please contact your administrator.' });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] }
    );

    await audit.log({
      entity_type: 'AUTH',
      entity_id: user._id.toString(),
      action: 'LOGIN',
      actor: {
        user_id: user._id.toString(),
        name: user.name,
        role: user.role
      },
      details: { email: user.email }
    });

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        department: user.department,
        plant: user.plant
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user) {
      await audit.log({
        entity_type: 'AUTH',
        entity_id: req.user.id,
        action: 'LOGOUT',
        actor: {
          user_id: req.user.id,
          name: req.user.name,
          role: req.user.role
        },
        details: { email: req.user.email }
      });
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user!.id).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const authRoutes = router;
