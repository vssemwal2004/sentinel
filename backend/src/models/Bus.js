import mongoose from 'mongoose';

const busSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  name: { type: String },
  seats: { type: Number, required: true },
  type: { type: String, enum: ['Intra-City','Inter-City'], required: false },
  routeName: { type: String },
  activeRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
  seatsQr: [{
    seatNumber: Number,
    code: String, // e.g., BUS101-Seat1
    // we can dynamically generate PNG on download; store base64 optionally later
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Bus', busSchema);
