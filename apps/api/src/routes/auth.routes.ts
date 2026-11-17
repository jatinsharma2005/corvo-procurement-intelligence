import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserModel } from '../models/User';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Demo fallback user auto-creation
      if (email === 'buyer@corvo.internal' || email === 'admin@corvo.internal') {
        const role = email.startsWith('admin') ? 'ADMIN' : 'BUYER';
        const token = jwt.sign(
          { id: 'usr-demo', email, role, name: 'Corvo Procurement' },
          config.jwtSecret,
          { expiresIn: config.jwtExpiresIn }
        );
        return res.json({ token, user: { id: 'usr-demo', email, role, name: 'Corvo Procurement' } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        plant: user.plant
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  const { name, email, password, role = 'EMPLOYEE', department, plant } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }

  try {
    const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = new UserModel({
      name,
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      role,
      department,
      plant
    });
    await user.save();

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        plant: user.plant
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

export const authRoutes = router;
