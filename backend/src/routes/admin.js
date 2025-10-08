import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Bus from '../models/Bus.js';
import QRCode from 'qrcode';
import archiver from 'archiver';
import stream from 'stream';
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

// Create single conductor manually
router.post('/conductors', authRequired, role('admin'), async (req,res,next) => {
  try {
    const { name, email, phone, password } = req.body;
    if(!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const exists = await User.findOne({ email });
    if(exists) return res.status(409).json({ error: 'Email already exists' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, passwordHash, role: 'conductor', conductorId: uuid() });
    res.json({ conductor: { id: user._id, name: user.name, email: user.email } });
  } catch (e) { next(e); }
});

// Upload buses CSV (new format):
// bus_number,bus_name,total_seats,type,assigned_conductor,route_name
// Note: assigned_conductor column is ignored now (conductor picks bus when creating a ride)
router.post('/buses/import', authRequired, role('admin'), upload.single('file'), async (req,res,next) => {
  try {
    if(!req.file) return res.status(400).json({ error: 'No file'});
    const parser = parse(req.file.buffer, { columns: true, trim: true });
    let imported = 0; const skipped = [];
    for await (const rec of parser) {
      const number = rec.bus_number || rec.number;
      const name = rec.bus_name || rec.name;
      const seatsRaw = rec.total_seats || rec.seats;
      const type = rec.type; // Expect exactly 'Intra-City' or 'Inter-City'
      const routeName = rec.route_name;
  // Ignored: assignedConductorEmail (admin no longer assigns buses)
      if(!number || !seatsRaw) { skipped.push(number); continue; }
      const existing = await Bus.findOne({ number });
      if(existing) { skipped.push(number); continue; }
      const seatsNum = parseInt(seatsRaw);
      await Bus.create({ number, name, seats: seatsNum, type, routeName });
      imported++;
    }
    res.json({ imported, skipped });
  } catch (e) { next(e); }
});

router.get('/buses', authRequired, role('admin'), async (req,res,next) => {
  try {
    const buses = await Bus.find({}, 'number name seats type routeName activeRide qrCodeValue');
    res.json({ buses });
  } catch (e) { next(e); }
});

// Create single bus manually
router.post('/buses', authRequired, role('admin'), async (req,res,next) => {
  try {
    const { number, name, seats, type, routeName } = req.body; // assignedConductor removed
    if(!number || !seats) return res.status(400).json({ error: 'number and seats required' });
    const existing = await Bus.findOne({ number });
    if(existing) return res.status(409).json({ error: 'Bus number exists' });
    const seatsNum = parseInt(seats);
    const bus = await Bus.create({ number, name, seats: seatsNum, type, routeName });
    res.json({ bus });
  } catch (e) { next(e); }
});

// Download single bus QR (PNG). busId required now that only one QR per bus exists.
router.get('/buses/qr/download', authRequired, role('admin'), async (req,res,next) => {
  try {
    const { busId } = req.query;
    if(!busId) return res.status(400).json({ error: 'busId required'});
    const bus = await Bus.findById(busId);
    if(!bus) return res.status(404).json({ error: 'Bus not found'});
    const pngBuffer = await QRCode.toBuffer(bus.qrCodeValue || `BUSQR:${bus.number}`, { type: 'png', margin: 1, scale: 8 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="bus-${bus.number}-qr.png"`);
    res.end(pngBuffer);
  } catch (e) { next(e); }
});

export default router;
