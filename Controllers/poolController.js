import Ride from '../Models/Ride.js';
import User from '../Models/User.js';
import Wallet from '../Models/Wallet.js';
import PromotedRoute from '../Models/PromotedRoute.js';
import Offer from '../Models/Offer.js';
import Message from '../Models/Message.js';

// ─── 9. GET /api/pools/:id/messages ─────────────────────
// Get chat messages for a specific pool trip
export const getPoolMessages = async (req, res) => {
    try {
        const pool = await Ride.findById(req.params.id);
        if (!pool) return res.status(404).json({ success: false, message: 'Pool ride not found' });

        // Verify user is either host or passenger
        const isPassenger = pool.passengers.some(p => p.user.toString() === req.user._id.toString());
        const isHost = pool.host.toString() === req.user._id.toString();

        if (!isPassenger && !isHost) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const messages = await Message.find({ pool: req.params.id }).sort({ createdAt: 1 });
        return res.json({ success: true, data: messages });
    } catch (error) {
        console.error('getPoolMessages error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
};

// ─── 10. POST /api/pools/:id/messages ────────────────────
// Send a chat message for a specific pool trip
export const sendPoolMessage = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Message text is required' });
        }

        const pool = await Ride.findById(req.params.id);
        if (!pool) return res.status(404).json({ success: false, message: 'Pool ride not found' });

        const isPassenger = pool.passengers.some(p => p.user.toString() === req.user._id.toString());
        const isHost = pool.host.toString() === req.user._id.toString();

        if (!isPassenger && !isHost) {
            return res.status(403).json({ success: false, message: 'Not authorized to send messages' });
        }

        const message = await Message.create({
            pool: req.params.id,
            sender: req.user._id,
            text: text.trim(),
        });

        return res.status(201).json({ success: true, data: message });
    } catch (error) {
        console.error('sendPoolMessage error:', error);
        return res.status(500).json({ success: false, message: 'Failed to send message' });
    }
};

// ─── 8. GET /api/pools/promoted ─────────────────────────
// Get promoted routes for weekend escapes, etc.
// @access Public
export const getPromotedRoutes = async (req, res) => {
    try {
        const { category } = req.query;
        let query = { isActive: true };
        if (category) query.category = category;

        const routes = await PromotedRoute.find(query).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: routes.length, data: routes });
    } catch (error) {
        console.error('getPromotedRoutes error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch promoted routes' });
    }
};

// GET /api/pools/offers
// Get active recommended offers
// @access Private (Passenger)
export const getOffers = async (req, res) => {
    try {
        const offers = await Offer.find({ isActive: true }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: offers.length, data: offers });
    } catch (error) {
        console.error('getOffers error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch offers' });
    }
};

// ─── 1. POST /api/pools/publish ─────────────────────────
// Driver publishes a new pool (City, Outstation, Rental)
// @access Private (Driver)
export const publishRide = async (req, res) => {
    try {
        const {
            type, // "City" | "Outstation" | "Rental"
            originName, originCoords,
            destinationName, destinationCoords,
            scheduledTime,
            vehicle,
            vehicleType, // "CAR" | "BIKE" | "TRAVELER"
            totalSeats,
            pricePerSeat,
            seatPricing,
            preferences
        } = req.body;

        if (!originName || !destinationName || !scheduledTime || !totalSeats || !pricePerSeat) {
            return res.status(400).json({ success: false, message: 'All ride details (origin, destination, time, seats, price) are required' });
        }

        // ─── Vehicle eligibility for pool type ───────────────────────────────────────────────────────────────────────
        // BIKE and AUTO are city-only vehicles (max 100 km, local roads only).
        // They cannot offer outstation or rental pools — just like Rapido/Ola rules.
        const driverUser = await User.findById(req.user._id).select('driverDetails');
        const driverVehicleType = driverUser?.driverDetails?.vehicle?.type?.toUpperCase() || '';
        const rideTypeLower = (type || '').toLowerCase();
        const isBikeOrAuto = driverVehicleType === 'BIKE' || driverVehicleType === 'AUTO';
        const isLongDistancePool = rideTypeLower === 'outstation' || rideTypeLower === 'rental';

        if (isBikeOrAuto && isLongDistancePool) {
            return res.status(403).json({
                success: false,
                message: `${driverVehicleType === 'BIKE' ? 'Bikes' : 'Autos'} can only offer City Pools (local routes under 100 km). Outstation and Rental pools require a Car or Traveller.`
            });
        }
        // ──────────────────────────────────────────────────────────────────────────────

        // Rentals enforce "All Seats Booked" pricing structure automatically via frontend mapping,
        // but backend creates it as a single pool block.
        const newRide = await Ride.create({
            host: req.user._id,
            type: type || 'local', // Mapping 'City' -> 'local', 'Outstation' -> 'outstation'
            origin: {
                name: originName,
                location: { type: 'Point', coordinates: originCoords || [0, 0] }
            },
            destination: {
                name: destinationName,
                location: { type: 'Point', coordinates: destinationCoords || [0, 0] }
            },
            scheduledTime: new Date(scheduledTime),
            vehicle: vehicle || 'Standard Vehicle',
            vehicleType: (vehicleType?.toUpperCase() === 'SEDAN' || !vehicleType) ? 'CAR' : vehicleType.toUpperCase(),
            totalSeats: Number(totalSeats),
            availableSeats: Number(totalSeats),
            pricePerSeat: Number(pricePerSeat),
            seatPricing: seatPricing || {},
            preferences: preferences || {}
        });

        // Populate driver details immediately to return
        const populatedRide = await newRide.populate('host', 'name phone profileImage driverDetails');

        return res.status(201).json({ success: true, message: 'Pool ride published successfully', data: populatedRide });
    } catch (error) {
        console.error('publishRide error:', error);
        return res.status(500).json({ success: false, message: 'Failed to publish ride' });
    }
};

// ─── 2. GET /api/pools/search ───────────────────────────
// Passenger searches for upcoming pools
// @access Private (Passenger)
export const searchRides = async (req, res) => {
    try {
        const { type, date, fromCoords, toCoords, fromName, toName } = req.query; // 'local', 'outstation', 'intercity', 'date'

        // Find rides that are upcoming, have seats, and optionally match the type filter
        let query = {
            status: 'scheduled',
            availableSeats: { $gt: 0 }
        };

        if (date) {
            const searchDate = new Date(date);
            const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
            query.scheduledTime = { $gte: startOfDay, $lte: endOfDay };
        } else {
            // Default: Upcoming rides from now
            query.scheduledTime = { $gte: new Date() };
        }

        if (fromCoords && fromCoords.includes(',')) {
            const [lng, lat] = fromCoords.split(',').map(Number);
            query["origin.location"] = {
                $geoWithin: {
                    $centerSphere: [[lng, lat], 10 / 6378.1] // 10km radius
                }
            };
        } else if (fromName) {
            query["origin.name"] = { $regex: fromName, $options: 'i' };
        }

        if (toCoords && toCoords.includes(',')) {
            const [lng, lat] = toCoords.split(',').map(Number);
            query["destination.location"] = {
                $geoWithin: {
                    $centerSphere: [[lng, lat], 20 / 6378.1] // 20km radius
                }
            };
        } else if (toName) {
            query["destination.name"] = { $regex: toName, $options: 'i' };
        }

        const normalizedType = type ? type.toLowerCase() : null;

        if (normalizedType) {
            query.type = normalizedType;
        }

        // ─── Vehicle Eligibility Rules ─────────────────────────────────────────
        // TRAVELER vehicles are large multi-seaters meant for outstation/rental only.
        // They must NOT appear in city (local) pool searches — just like Rapido/Ola.
        if (normalizedType === 'local') {
            query.vehicleType = { $ne: 'TRAVELER' };
        }
        // For outstation/rental: all vehicle types (CAR, BIKE, TRAVELER) are allowed.
        // ───────────────────────────────────────────────────────────────────────

        const rides = await Ride.find(query)
            .populate('host', 'name phone profileImage driverDetails')
            .sort({ scheduledTime: 1 }) // Soonest first
            .limit(50); // Hard cap

        return res.status(200).json({ success: true, count: rides.length, data: rides });
    } catch (error) {
        console.error('searchRides error:', error);
        return res.status(500).json({ success: false, message: 'Failed to search rides' });
    }
};

// ─── 3. POST /api/pools/:id/book ─────────────────────────
// Passenger books seats
// @access Private (Passenger)
export const bookSeat = async (req, res) => {
    try {
        const { seats = 1, paymentMethod = 'razorpay' } = req.body;
        const rideId = req.params.id;
        console.log("ssss", seats, paymentMethod, rideId)

        // ── Cash NOT allowed for pooling ──────────────────────────────────────────────────────────
        // Outstation pooling and all Ride pools require Razorpay payment.
        // The frontend handles the Razorpay checkout BEFORE calling this endpoint.
        if (paymentMethod === 'cash') {
            return res.status(400).json({
                success: false,
                message: 'Cash is not accepted for pool bookings. Please pay via Razorpay.'
            });
        }
        // ──────────────────────────────────────────────────────────────────────

        const ride = await Ride.findById(rideId);
        console.log("ride", ride)
        if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

        if (ride.availableSeats < seats) {
            return res.status(400).json({ success: false, message: `Only ${ride.availableSeats} seats available` });
        }

        if (ride.host.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot book your own published ride' });
        }

        // Check if user already booked this ride
        const existingPassenger = ride.passengers.find(p => p.user.toString() === req.user._id.toString());
        if (existingPassenger && existingPassenger.bookingStatus !== 'cancelled') {
            return res.status(400).json({ success: false, message: 'You have already booked a seat on this ride' });
        }

        // ── Wallet balance deduction (Immediate) ──────────────────────────────
        const totalAmount = seats * ride.pricePerSeat;
        const passengerUser = await User.findById(req.user._id);
        if (!passengerUser) return res.status(404).json({ success: false, message: 'Passenger not found' });

        if (paymentMethod === 'wallet') {
            if ((passengerUser.walletBalance || 0) < totalAmount) {
                return res.status(402).json({
                    success: false,
                    message: `Insufficient wallet balance. You need ₹${totalAmount} but have ₹${passengerUser.walletBalance || 0}.`
                });
            }

            // Deduct immediately
            passengerUser.walletBalance -= totalAmount;
            await passengerUser.save();
        }
        // ────────────────────────────────────────────────────────────────────────────

        // Deduct seats and push to manifest
        ride.availableSeats -= seats;

        // No OTP for any pooling types (local, outstation, rental) per user request
        const pickupOtp = null;

        ride.passengers.push({
            user: req.user._id,
            seatsBooked: seats,
            otp: pickupOtp,
            paymentMethod: paymentMethod,
            bookingStatus: 'confirmed',
            paymentStatus: paymentMethod === 'wallet' ? 'paid' : 'pending',
        });
        await ride.save();

        const updatedRide = await ride.populate([
            { path: 'host', select: 'name phone profileImage driverDetails' },
            { path: 'passengers.user', select: 'name phone profileImage' }
        ]);

        return res.status(200).json({
            success: true,
            message: paymentMethod === 'wallet' ? 'Booking confirmed and payment deducted from wallet.' : 'Seat reserved successfully.',
            otp: pickupOtp,
            estimatedFare: totalAmount,
            walletBalance: passengerUser.walletBalance,
            data: updatedRide,
        });

    } catch (error) {
        console.error('bookSeat error:', error);
        return res.status(500).json({ success: false, message: 'Failed to book seat' });
    }
};

// ─── 4. GET /api/pools/driver-history ────────────────────
// Driver fetches all trips they have hosted
// @access Private (Driver)
export const getDriverPools = async (req, res) => {
    try {
        const rides = await Ride.find({ host: req.user._id })
            .populate('passengers.user', 'name phone profileImage')
            .sort({ scheduledTime: -1 });

        return res.status(200).json({ success: true, count: rides.length, data: rides });
    } catch (error) {
        console.error('getDriverPools error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch driver history' });
    }
};

// ─── 5. GET /api/pools/history ───────────────────────────
// Passenger fetches trips they have joined
// @access Private (Passenger)
export const getPassengerPools = async (req, res) => {
    try {
        // Query rides where this user ID is inside the passengers array AND their booking is not cancelled
        const rides = await Ride.find({
            passengers: {
                $elemMatch: {
                    user: req.user._id,
                    bookingStatus: { $ne: 'cancelled' }
                }
            }
        })
            .populate('host', 'name phone profileImage driverDetails')
            .sort({ scheduledTime: -1 });

        return res.status(200).json({ success: true, count: rides.length, data: rides });
    } catch (error) {
        console.error('getPassengerPools error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch passenger history' });
    }
};

// ─── 6. PUT /api/pools/:id/status ──────────────────────────
// Driver updates the status of their pool (e.g. 'ongoing', 'cancelled')
// @access Private (Driver)
export const updatePoolStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['scheduled', 'ongoing', 'completed', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({ success: false, message: 'Ride not found' });
        }

        // Ensure only the host can update the status
        if (ride.host.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this ride' });
        }

        if (status === 'completed') {
            const now = new Date();
            if (new Date(ride.scheduledTime) > now) {
                return res.status(400).json({ success: false, message: 'Cannot complete a trip before its scheduled time' });
            }
        }

        ride.status = status;
        if (req.body.cancellationReason) {
            ride.cancellationReason = req.body.cancellationReason;
        }

        // Process payments if completed
        if (status === 'completed') {
            const host = await User.findById(ride.host);
            let hostWallet = await Wallet.findOne({ user: ride.host });
            if (!hostWallet) {
                hostWallet = await Wallet.create({ user: ride.host, balance: 0 });
            }

            for (let p of ride.passengers) {
                if (p.bookingStatus === 'confirmed' || p.bookingStatus === 'completed') {
                    const totalAmount = p.seatsBooked * ride.pricePerSeat;
                    const commission = 0; // 0% commission per user request
                    const driverNetEarning = totalAmount; // Driver gets 100%

                    // Increment host earnings
                    host.driverDetails.earnings = (host.driverDetails.earnings || 0) + totalAmount;

                    if (p.paymentMethod === 'wallet' || p.paymentMethod === 'razorpay') {
                        // 1. Deduct from passenger (restored flow: deduction happens at trip completion)
                        const passenger = await User.findById(p.user);
                        if (passenger) {
                            passenger.walletBalance -= totalAmount;
                            await passenger.save();

                            let pWallet = await Wallet.findOne({ user: p.user });
                            if (!pWallet) {
                                pWallet = await Wallet.create({ user: p.user, balance: passenger.walletBalance });
                            }
                            pWallet.balance = passenger.walletBalance;
                            pWallet.transactions.push({
                                type: 'debit',
                                amount: totalAmount,
                                description: `Pool Payment (Ride ID: ${ride._id.toString().slice(-6).toUpperCase()})`,
                                referenceId: ride._id
                            });
                            await pWallet.save();
                        }

                        // 2. Credit Driver (Net: 100%)
                        host.walletBalance = (host.walletBalance || 0) + driverNetEarning;
                        hostWallet.balance += driverNetEarning;
                        hostWallet.transactions.push({
                            type: 'credit',
                            amount: driverNetEarning,
                            description: `Pool Earning (Ride ID: ${ride._id.toString().slice(-6).toUpperCase()}) - 0% Fee`,
                            referenceId: ride._id
                        });
                    }
                    p.bookingStatus = 'completed';
                    p.paymentStatus = 'completed';
                }
            }
            await host.save();
            await hostWallet.save();
        }

        await ride.save();

        return res.status(200).json({ success: true, message: `Ride status updated to ${status}`, data: ride });
    } catch (error) {
        console.error('updatePoolStatus error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update ride status' });
    }
};

// ─── 7. PUT /api/pools/:id/cancel-booking ──────────────────
// Passenger cancels their own booking in a pool
// @access Private (Passenger)
export const cancelBooking = async (req, res) => {
    try {
        const { cancellationReason } = req.body;
        const rideId = req.params.id;

        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

        const passengerIndex = ride.passengers.findIndex(p => {
            const passengerId = p.user?._id || p.user;
            return passengerId && passengerId.toString() === req.user._id.toString() && p.bookingStatus !== 'cancelled';
        });

        if (passengerIndex === -1) {
            return res.status(400).json({ success: false, message: 'Active booking not found for this user' });
        }

        const booking = ride.passengers[passengerIndex];

        // Restore seats
        ride.availableSeats += booking.seatsBooked;

        // Update status and reason
        booking.bookingStatus = 'cancelled';
        booking.cancellationReason = cancellationReason || 'No reason provided';

        await ride.save();

        return res.status(200).json({ success: true, message: 'Booking cancelled successfully', data: ride });
    } catch (error) {
        console.error('cancelBooking error:', error);
        return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
    }
};

export const markPoolMessagesAsRead = async (req, res) => {
    try {
        const pool = await Ride.findById(req.params.id);
        if (!pool) return res.status(404).json({ success: false, message: 'Pool not found' });
        const now = new Date();
        const isHost = pool.host.toString() === req.user._id.toString();
        const passengerIndex = pool.passengers.findIndex(p => p.user.toString() === req.user._id.toString());
        if (isHost) pool.lastReadByHost = now;
        else if (passengerIndex !== -1) pool.passengers[passengerIndex].lastReadAt = now;
        else return res.status(403).json({ success: false, message: 'Not authorized' });
        await pool.save();
        return res.json({ success: true, message: 'Pool messages marked as read', lastReadAt: now });
    } catch (error) {
        console.error('markPoolMessagesAsRead error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark as read' });
    }
};
