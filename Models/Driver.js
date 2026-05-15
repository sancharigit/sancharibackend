import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true }, // false when on a ride
  rating: { type: Number, default: 5.0, min: 1, max: 5 },
  totalRides: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  licenseNumber: { type: String, required: true, unique: true },
  isVerified: { type: Boolean, default: false },
  currentRideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
}, { timestamps: true });

const Driver = mongoose.model('Driver', driverSchema);
export default Driver;
