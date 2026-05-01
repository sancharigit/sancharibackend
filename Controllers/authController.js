import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../Models/User.js';
import { sendSMS, sendPersonalizedSMS } from '../Utils/smsService.js';
import { sendWhatsAppOTP } from '../Utils/whatsappService.js';

const googleClient = new OAuth2Client('909296510785-e3a279afthh5br10j180ie4lidh9ucp2.apps.googleusercontent.com');

// ─── Helper ────────────────────────────────────────────────────
const generateToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const sendSuccess = (res, statusCode, message, data = {}) =>
    res.status(statusCode).json({ success: true, message, data });

const sendError = (res, statusCode, message) =>
    res.status(statusCode).json({ success: false, message });

// ─── @route  POST /api/auth/register ────────────────────────────
// @desc   Register as passenger or driver
// @access Public
export const register = async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;
        console.log(`DEBUG: Registration attempt for ${email} / ${phone} with role: ${role}`);

        if (!name || !email || !phone) {
            return sendError(res, 400, 'Please provide name, email, and phone');
        }

        if (!password && !req.body.googleIdToken) {
            return sendError(res, 400, 'Please provide a password');
        }

        const normalizedRole = role?.toLowerCase() || 'passenger';
        console.log("kakakakakka", normalizedRole)
        const userExists = await User.findOne({
            $and: [
                { $or: [{ email }, { phone }] },
                { role: normalizedRole }
            ]
        });

        if (userExists) {
            return sendError(res, 409,
                `A ${normalizedRole} account with this email or phone already exists. Please login instead.`
            );
        }

        // Different role (driver→passenger or passenger→driver) — allow registration
        // Just continue below, don't return

        // const normalizedRole = role?.toLowerCase() || 'passenger';
        const hashedPassword = await bcrypt.hash(req.body.googleIdToken ? req.body.googleIdToken + (process.env.JWT_SECRET || 'secret') : password, 10);
        console.log(`DEBUG: Normalized role for ${email}: ${normalizedRole}`);

        console.log(`DEBUG: Normalized role for ${email}: ${normalizedRole}`);

        let driverDetailsData = undefined;
        if (normalizedRole === 'driver') {
            let vehicleData = req.body.vehicle;

            // Fallback: Check if nested in driverDetails (common confusion)
            if (!vehicleData && req.body.driverDetails && req.body.driverDetails.vehicle) {
                vehicleData = req.body.driverDetails.vehicle;
            }

            // Fallback: parsing if string
            if (typeof vehicleData === 'string') {
                try {
                    console.log("DEBUG: vehicle data is string, parsing...");
                    vehicleData = JSON.parse(vehicleData);
                } catch (e) {
                    console.error("DEBUG: Failed to parse vehicle string:", e);
                }
            }

            if (vehicleData) {
                // Explicitly valid fields to prevent stripping
                driverDetailsData = {
                    vehicle: {
                        make: vehicleData.make,
                        model: vehicleData.model,
                        year: vehicleData.year,
                        plateNumber: vehicleData.plateNumber,
                        color: vehicleData.color,
                        type: vehicleData.type || 'CAR',
                        fuelType: vehicleData.fuelType || 'Petrol',
                        seatingCapacity: Number(vehicleData.seatingCapacity) || 4,
                        bootSpace: vehicleData.bootSpace
                    },
                    licenseNumber: req.body.licenseNumber || req.body.driverDetails?.licenseNumber,
                    verificationStatus: {
                        email: req.body.googleIdToken ? true : false,
                        phone: false,
                        idCard: false,
                        communityTrusted: false
                    }
                };
            } else {
                console.warn("Vehicle data not found in request body for driver registration.");
                // Still create empty driverDetails to ensure role=driver works
                driverDetailsData = {
                    vehicle: {},
                    verificationStatus: {
                        email: req.body.googleIdToken ? true : false,
                        phone: false,
                        idCard: false,
                        communityTrusted: false
                    }
                };
            }
        }

        const user = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            role: normalizedRole,
            profileImage: req.body.profileImage || '',
            driverDetails: driverDetailsData,
            verificationStatus: {
                email: req.body.googleIdToken ? true : false,
                phone: false,
                idCard: false,
                communityTrusted: false
            }
        });

        const savedUser = await user.save();
        console.log(`DEBUG: User saved successfully with role: ${savedUser.role}`);

        const token = generateToken(savedUser._id);
        const userData = savedUser.toObject();
        delete userData.password;

        return sendSuccess(res, 201, 'Registration successful', {
            ...userData,
            token
        });
    } catch (error) {
        console.error('Register error:', error);
        return sendError(
            res,
            500,
            process.env.NODE_ENV === 'development'
                ? `Registration failed: ${error.message}`
                : 'Server error during registration'
        );
    }
};


// ─── @route  POST /api/auth/login ───────────────────────────────
// @desc   Login with email/phone + password
// @access Public
export const login = async (req, res) => {
    try {
        const { email, phone, password, role } = req.body;

        if (!password || (!email && !phone)) {
            return sendError(res, 400, 'Please provide (email or phone) and password');
        }

        const query = {
            ...(email ? { email } : { phone })
        };

        if (role) {
            query.role = role.toLowerCase();
        }

        let user = await User.findOne(query);

        // Fallback: If no role was specified and no user was found with default 'passenger' logic,
        // try to find the user by identifier only (this helps admins or users with specific roles)
        if (!user && !role) {
            user = await User.findOne({
                ...(email ? { email } : { phone })
            });
        }
        console.log("user found", user)

        if (!user) {
            return sendError(res, 401, 'Invalid credentials');
        }
        console.log("user role", user.role)
        // --- NEW: Role Verification ---
        if (req.body.role && !user.role.includes(req.body.role.toLowerCase())) {
            return sendError(
                res,
                403,
                `You are not registered as a ${req.body.role}`
            );
        }


        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return sendError(res, 401, 'Invalid credentials');
        }

        // --- NEW: Bypass OTP for Admins ---
        if (user.role === 'admin') {
            const token = generateToken(user._id);
            const userData = user.toObject();
            delete userData.password;
            return sendSuccess(res, 200, 'Admin Login successful', {
                ...userData,
                token
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Send SMS
        const message = `Your OTP for HybridRide login is ${otp}. Valid for 10 minutes.`;
        const templateId = process.env.SMS_TEMPLATE_ID || 123;

        try {
            // Using personalized method with message fallback for raw mode support
            await sendPersonalizedSMS([
                {
                    number: user.phone,
                    name: user.name.split(' ')[0],
                    otp: otp
                }
            ],
                process.env.SMS_TEMPLATE_ID === '123' ? null : process.env.SMS_TEMPLATE_ID,
                "Dear {name}, your One Time Password (OTP) is {otp}. Please use this code to complete your verification. Do not share this OTP with anyone. This code is valid for a limited time only. Thank you.",
                process.env.SMS_SENDER_ID || "SSGSPT"
            );

            // 2. Send via WhatsApp (if configured)
            if (process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TEMPLATE_NAME) {
                await sendWhatsAppOTP(
                    user.phone,
                    process.env.WHATSAPP_TEMPLATE_NAME,
                    [otp] // Authentication templates usually only take the OTP code
                );
            }
        } catch (smsError) {
            console.error('Failed to send OTP SMS:', smsError);
            // In dev, we might want to still allow login or at least show the OTP in console
            if (process.env.NODE_ENV === 'development') {
                console.log(`[DEV ONLY] OTP for ${user.phone}: ${otp}`);
            } else {
                return sendError(res, 500, 'Failed to send OTP. Please try again later.');
            }
        }

        return sendSuccess(res, 200, 'OTP sent to your phone', {
            otpRequired: true,
            phone: user.phone
        });

    } catch (error) {
        console.error('Login error:', error);
        return sendError(res, 500, `Login failed: ${error.message}`);
    }
};

// ─── @route  POST /api/auth/verify-otp ──────────────────────────
// @desc   Verify OTP and complete login
// @access Public
export const verifyOTP = async (req, res) => {
    try {
        const { phone, otp, role } = req.body;

        if (!phone || !otp) {
            return sendError(res, 400, 'Please provide phone and OTP');
        }

        const normalizedRole = role?.toLowerCase() || 'passenger';
        const user = await User.findOne({ phone, role: normalizedRole });
        console.log("user", user);
        console.log("user", user)

        if (!user || user.otp !== otp || user.otpExpires < new Date()) {
            return sendError(res, 401, 'Invalid or expired OTP');
        }

        // --- NEW: Role Verification ---
        if (req.body.role && user.role !== req.body.role.toLowerCase()) {
            return sendError(res, 403, `Role mismatch during verification. This account is registered as a ${user.role}.`);
        }


        // Clear OTP
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        const token = generateToken(user._id);
        const userData = user.toObject();
        delete userData.password;
        delete userData.otp;
        delete userData.otpExpires;

        return sendSuccess(res, 200, 'Login successful', {
            ...userData,
            token,
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        return sendError(res, 500, `OTP verification failed: ${error.message}`);
    }
};

// ─── @route  POST /api/auth/google ───────────────────────────────
// @desc   Login or Register with Google Sign-In
// @access Public
export const googleLogin = async (req, res) => {
    try {
        const { idToken, role } = req.body;

        if (!idToken) {
            return sendError(res, 400, 'Please provide idToken');
        }
        console.log("hhshshshshshssh")
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: '909296510785-e3a279afthh5br10j180ie4lidh9ucp2.apps.googleusercontent.com',
        });
        console.log("ticket", ticket)
        const payload = ticket.getPayload();


        if (!payload || !payload.email) {
            return sendError(res, 400, 'Invalid Google Token');
        }

        const { email, name, picture } = payload;

        let user = await User.findOne({ email, role: role?.toLowerCase() || 'passenger' });

        // if (user) {
        //     return sendError(
        //         res,
        //         403,
        //         `This account is already registered as ${user.role}`
        //     );
        // }

        // ✅ Auto create user
        if (!user) {
            user = await User.create({
                email,
                name: name || 'Google User',
                profileImage: picture,
                role: role?.toLowerCase() || 'passenger',
                isGoogleUser: true
            });
        }

        // --- NEW: Role Verification for existing Google users ---
        if (role && user.role !== role.toLowerCase()) {
            return sendError(res, 403, `This Google account is already registered as a ${user.role}. Please use the correct application section.`);
        }

        const token = generateToken(user._id);
        const userData = user.toObject();
        delete userData.password;

        return sendSuccess(res, 200, 'Google Login successful', {
            ...userData,
            token,
        });

    } catch (error) {
        console.error('Google login error:', error);
        return sendError(res, 500, `Google Login failed: ${error.message}`);
    }
};

// ─── @route  POST /api/auth/whatsapp-login ───────────────────────
// @desc   Passwordless Login with WhatsApp OTP
// @access Public
export const whatsappLogin = async (req, res) => {
    try {
        const { phone, role } = req.body;
        console.log("whatsapp login", req.body)

        if (!phone) {
            return sendError(res, 400, 'Please provide a phone number');
        }

        const normalizedRole = role?.toLowerCase() || 'passenger';
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);

        const user = await User.findOne({ phone: cleanPhone, role: normalizedRole });


        if (!user) {
            return sendError(res, 404, 'User not found. Please sign up first.');
        }

        // --- NEW: Role Verification ---
        if (req.body.role && user.role !== req.body.role.toLowerCase()) {
            return sendError(res, 403, `This account is registered as a ${user.role}. Please log in through the correct section.`);
        }


        // Generate 6-digit OTP
        // const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otp = "123456";
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Send via WhatsApp
        if (process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TEMPLATE_NAME) {
            const waResponse = await sendWhatsAppOTP(
                user.phone,
                process.env.WHATSAPP_TEMPLATE_NAME,
                [otp]
            );

            if (waResponse?.error) {
                return sendError(res, 500, `WhatsApp Error: ${waResponse.error.message}`);
            }
        } else {
            return sendError(res, 500, 'WhatsApp login is not configured on server');
        }

        return sendSuccess(res, 200, 'OTP sent to WhatsApp', {
            otpRequired: true,
            phone: user.phone
        });

    } catch (error) {
        console.error('WhatsApp Login error:', error);
        return sendError(res, 500, `WhatsApp Login failed: ${error.message}`);
    }
};

// ─── @route  GET /api/auth/me ────────────────────────────────────
// @desc   Get logged-in user's profile
// @access Private
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        return sendSuccess(res, 200, 'Profile fetched', user);
    } catch (error) {
        console.error('GetMe error:', error);
        return sendError(res, 500, 'Server error fetching profile');
    }
};

// ─── @route  PUT /api/auth/profile ───────────────────────────────
// @desc   Update logged-in user's profile
// @access Private
export const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        // 1. Handle File Upload (if any)
        if (req.file) {
            // Store path as /uploads/filename for static serving
            user.profileImage = `/uploads/${req.file.filename}`;
        }

        // 2. Handle Text Fields
        let { name, email, phone, ridePersonality, savedPlaces } = req.body;

        // If using form-data, arrays/objects might arrive as strings
        if (typeof ridePersonality === 'string') {
            try { ridePersonality = JSON.parse(ridePersonality); } catch (e) { }
        }
        if (typeof savedPlaces === 'string') {
            try { savedPlaces = JSON.parse(savedPlaces); } catch (e) { }
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;

        // Update Passenger Specifics
        if (ridePersonality) user.ridePersonality = ridePersonality;
        if (savedPlaces) user.savedPlaces = savedPlaces;

        await user.save();

        const updatedUser = user.toObject();
        delete updatedUser.password;

        return sendSuccess(res, 200, 'Profile updated successfully', updatedUser);
    } catch (error) {
        console.error('UpdateProfile error:', error);
        return sendError(res, 500, `Profile update failed: ${error.message}`);
    }
};


