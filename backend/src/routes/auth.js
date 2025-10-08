import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { signToken, authRequired } from '../utils/auth.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    if(!name || !email || !password) return res.status(400).json({ error: 'Missing fields'});
    const existing = await User.findOne({ email });
    if(existing) return res.status(409).json({ error: 'Email in use'});
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, passwordHash, role: 'user' });
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
    res.json({ user: { id: user._id, name: user.name, role: user.role }, token });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if(!user) return res.status(401).json({ error: 'Invalid credentials'});
    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(401).json({ error: 'Invalid credentials'});
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
    res.json({ user: { id: user._id, name: user.name, role: user.role }, token });
  } catch (e) { next(e); }
});

router.post('/logout', (req,res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', authRequired, (req,res) => {
  res.json({ user: { id: req.user._id, name: req.user.name, role: req.user.role } });
});

export default router;
