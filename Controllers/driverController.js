import User from '../Models/User.js';
import Driver from '../Models/Driver.js';
import Vehicle from '../Models/Vehicle.js';
import DriverOffer from '../Models/DriverOffer.js';

// @desc    Get driver profile (with driverDetails)
// @route   GET /api/driver/profile
// @access  Private (Driver)
export const getDriverProfile = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update driver details (Vehicle, License, etc.)
// @route   PATCH /api/driver/profile
// @access  Private (Driver)
export const updateDriverProfile = async (req, res) => {
  try {
    const { name, phone, email, vehicle, licenseNumber, documents, bankDetails } = req.body || {};
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update Basic Info
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (email) user.email = email;

    // Update driverDetails fields if provided
    if (licenseNumber) user.driverDetails.licenseNumber = licenseNumber;

    // Handle boolean isOnline separately
    if (typeof req.body.isOnline !== 'undefined') {
      user.driverDetails.isOnline = req.body.isOnline;
    }

    if (vehicle) {
      user.driverDetails.vehicle = {
        ...user.driverDetails.vehicle,
        ...vehicle
      };
    }

    if (documents) {
      user.driverDetails.documents = {
        ...user.driverDetails.documents,
        ...documents
      };
    }

    if (bankDetails) {
      user.driverDetails.bankDetails = {
        ...user.driverDetails.bankDetails,
        ...bankDetails
      };
    }

    await user.save();

    res.json({ success: true, message: 'Driver profile updated', data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Toggle Online/Offline status
// @route   PATCH /api/driver/toggle-status
// @access  Private (Driver)
export const toggleOnline = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { isOnline } = req.body || {}; // Expect boolean

    if (isOnline !== undefined) {
      user.driverDetails.isOnline = isOnline;
    } else {
      // Toggle if not specified
      user.driverDetails.isOnline = !user.driverDetails.isOnline;
    }

    await user.save();

    res.json({
      success: true,
      message: `You are now ${user.driverDetails.isOnline ? 'Online' : 'Offline'}`,
      data: { isOnline: user.driverDetails.isOnline }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update driver GPS location
// @route   PATCH /api/driver/location
// @access  Private (Driver)
export const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.driverDetails.currentLocation = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };

    await user.save();

    res.json({ success: true, message: 'Location updated successfully', data: user.driverDetails.currentLocation });
  } catch (error) {
    console.error('updateLocation error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


// @desc    Handle Document Upload
// @route   POST /api/driver/upload
// @access  Private
export const uploadDocument = async (req, res) => {
  try {
    console.log("DEBUG: Upload Request Body:", req.body);
    console.log("DEBUG: Upload File:", req.file);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { docType } = req.body;
    const isDriver = req.user.role === 'driver';
    const validDocTypes = ['licenseFront', 'licenseBack', 'registration', 'insurance', 'aadharFront', 'aadharBack', 'panCard', 'permit', 'fitness', 'rc', 'profileImage'];

    if (!docType || !validDocTypes.includes(docType)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing docType' });
    }

    // Security: Non-drivers can ONLY upload profileImage
    if (!isDriver && docType !== 'profileImage') {
      return res.status(403).json({ success: false, message: 'Passengers can only upload profile images' });
    }

    // Store as /uploads/filename for web-friendly access
    const filePath = `/uploads/${req.file.filename}`;

    let updateQuery = {};
    if (docType === 'profileImage') {
      updateQuery = { $set: { profileImage: filePath } };
    } else {
      const updateField = `driverDetails.documents.${docType}`;
      updateQuery = {
        $set: {
          [updateField]: filePath,
          driverApprovalStatus: 'pending' // Reset to pending for admin review
        }
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateQuery,
      { new: true, runValidators: true }
    );

    res.json({ success: true, message: 'File uploaded and saved', filePath, docType });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    res.status(500).json({ success: false, message: 'Upload Failed', error: error.message });
  }
};

// @desc    Get all online drivers
// @route   GET /api/driver/online
// @access  Private
export const getOnlineDrivers = async (req, res) => {
  try {
    const drivers = await User.find({
      role: 'driver',
      'driverDetails.isOnline': true
    }).select('-password');

    res.json({ success: true, data: drivers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get dynamic earnings for the driver
// @route   GET /api/driver/earnings
// @access  Private (Driver)
import Booking from '../Models/Booking.js';

export const getEarnings = async (req, res) => {
  try {
    const driverId = req.user._id;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const bookings = await Booking.find({
      driver: driverId,
      status: 'completed'
    });

    let today = 0;
    let week = 0;
    let month = 0;
    let total = 0;
    let todayRides = 0;
    let totalRides = 0;

    bookings.forEach(b => {
      const date = new Date(b.completedAt || b.createdAt);
      const amount = b.finalFare || 0;
      total += amount;
      totalRides += 1;

      if (date >= startOfToday) {
        today += amount;
        todayRides += 1;
      }
      if (date >= startOfWeek) week += amount;
      if (date >= startOfMonth) month += amount;
    });

    res.json({
      success: true,
      data: { today, week, month, total, currentBalance: total, todayRides, totalRides }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error fetching earnings' });
  }
};

/**
 * @desc    Add or update vehicle for driver
 * @route   POST /api/driver/vehicle
 */
export const addVehicle = async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const vehicle = await Vehicle.create({ ...req.body, driverId: driver._id });
    await Driver.findByIdAndUpdate(driver._id, { vehicleId: vehicle._id });

    res.status(201).json({ success: true, data: { vehicle } });
  } catch (err) {
    // If using next(err) for global error handling
    if (typeof next === 'function') {
      next(err);
    } else {
      res.status(500).json({ success: false, message: 'Server Error adding vehicle' });
    }
  }
};

/**
 * @desc    Get active driver offers
 * @route   GET /api/driver/offers
 */
export const getActiveDriverOffers = async (req, res) => {
  try {
    const offers = await DriverOffer.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, count: offers.length, data: offers });
  } catch (error) {
    console.error('getActiveDriverOffers error:', error);
    res.status(500).json({ success: false, message: 'Server Error fetching driver offers' });
  }
};

/**
 * @desc    Get trip modes statistics
 * @route   GET /api/driver/trip-modes
 */
export const getTripModeStats = async (req, res) => {
  try {
    const cityDemand = await Booking.countDocuments({ status: 'pending', rideType: { $ne: 'outstation' } });
    const outstationDemand = await Booking.countDocuments({ status: 'pending', rideType: 'outstation' });
    
    const cityDemandCalc = cityDemand > 0 ? cityDemand + 3 : 12; // Example fallback logic
    const outstationDemandCalc = outstationDemand > 0 ? outstationDemand + 1 : 5;
    const rentalDemandCalc = 2; // Fixed fallback for rental if not tracked separately

    res.json({
      success: true,
      data: {
        cityPool: {
          earn: '₹150-₹300',
          time: '~45 min',
          demand: cityDemandCalc
        },
        outstationPool: {
          earn: '₹1,200-₹2,500',
          time: '3-5 hrs',
          demand: outstationDemandCalc
        },
        outstationRental: {
          earn: '₹3,500-₹8K+',
          time: 'Full day',
          demand: rentalDemandCalc
        }
      }
    });
  } catch (error) {
    console.error('getTripModeStats error:', error);
    res.status(500).json({ success: false, message: 'Server Error fetching trip stats' });
  }
};
