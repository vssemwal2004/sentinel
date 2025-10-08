import mongoose from 'mongoose';

const conductorImportSchema = new mongoose.Schema({
  originalFilename: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  count: Number,
  processedAt: { type: Date, default: Date.now }
});

export default mongoose.model('ConductorImport', conductorImportSchema);
