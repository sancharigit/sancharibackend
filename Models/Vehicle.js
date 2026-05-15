import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  color: { type: String, required: true },
  licensePlate: { type: String, required: true, unique: true, uppercase: true },
  vehicleType: { type: String, enum: ['bike', 'auto', 'mini', 'sedan', 'suv'], default: 'sedan' },
  capacity: { type: Number, default: 4 },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;
