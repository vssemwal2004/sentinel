import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import ConductorImport from '../models/ConductorImport.js';
import { authRequired, role } from '../utils/auth.js';
import { v4 as uuid } from 'uuid';

const upload = multer();
const router = express.Router();

// Upload CSV with columns: name,email,phone,conductorId,password (password optional -> auto gen)
router.post('/conductors/import', authRequired, role('admin'), upload.single('file'), async (req,res,next) => {
  try {
    if(!req.file) return res.status(400).json({ error: 'No file'});
    const records = [];
    const parser = parse(req.file.buffer, { columns: true, trim: true });
    for await (const rec of parser) {
      if(!rec.email) continue;
      let user = await User.findOne({ email: rec.email });
      if(user) continue;
      const passwordPlain = rec.password || uuid().slice(0,8);
      const passwordHash = await bcrypt.hash(passwordPlain, 10);
      user = await User.create({
        name: rec.name || 'Conductor',
        email: rec.email,
        phone: rec.phone,
        conductorId: rec.conductorId || rec.id || uuid(),
        passwordHash,
        role: 'conductor'
      });
      records.push({ email: rec.email, password: passwordPlain });
    }
    await ConductorImport.create({ originalFilename: req.file.originalname, uploadedBy: req.user._id, count: records.length });
    res.json({ imported: records.length, credentials: records });
  } catch (e) { next(e); }
});

router.get('/conductors', authRequired, role('admin'), async (req,res,next) => {
  try {
    const conductors = await User.find({ role: 'conductor' }, 'name email phone conductorId');
    res.json({ conductors });
  } catch (e) { next(e); }
});

export default router;
