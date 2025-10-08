import mongoose from 'mongoose';

const busSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  name: { type: String },
  seats: { type: Number, required: true },
  type: { type: String, enum: ['Intra-City','Inter-City'], required: false },
  routeName: { type: String },
  activeRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
  qrCodeValue: { type: String, index: true }, // single QR per bus for booking unlock
  createdAt: { type: Date, default: Date.now }
});

// Ensure qrCodeValue exists for legacy documents
busSchema.pre('save', function(next){
  if(!this.qrCodeValue){
    // random stable token embedded with bus number
    const rand = Math.random().toString(36).slice(2,10).toUpperCase();
    this.qrCodeValue = `BUSQR:${this.number}:${rand}`;
  }
  next();
});

export default mongoose.model('Bus', busSchema);
