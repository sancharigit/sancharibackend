import mongoose from 'mongoose';

const passengerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  rating: { type: Number, default: 5.0, min: 1, max: 5 },
  totalRides: { type: Number, default: 0 },
  savedLocations: [{
    label: String,
    address: String,
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number], // [lng, lat]
    },
  }],
  preferredPaymentMethod: { type: String, enum: ['cash', 'card', 'wallet'], default: 'cash' },
}, { timestamps: true });

const Passenger = mongoose.model('Passenger', passengerSchema);
export default Passenger;
