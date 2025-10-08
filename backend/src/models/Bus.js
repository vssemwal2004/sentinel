import mongoose from 'mongoose';

const busSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  name: { type: String },
  seats: { type: Number, required: true },
  type: { type: String, enum: ['Intra-City','Inter-City'], required: false },
  routeName: { type: String },
  activeRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Bus', busSchema);
