import mongoose from 'mongoose';

const rideOTPSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  otp: { type: String, required: true },               // Consider hashing if high security is needed
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  isUsed: { type: Boolean, default: false },
}, { timestamps: true });

rideOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index to auto-delete expired OTPs

const RideOTP = mongoose.model('RideOTP', rideOTPSchema);
export default RideOTP;
