import jwt from 'jsonwebtoken';
import User from '../Models/User.js';

// Protect route — any logged-in user
export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ success: false, message: 'User not found' });
            }

            next();
        } catch (error) {
            console.error('Auth Middleware Error:', error.message);
            console.log('Received Token:', token); 
            return res.status(401).json({ success: false, message: `Not authorized, invalid token: ${error.message}` });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

// Driver only
export const driverOnly = (req, res, next) => {
    if (req.user?.role === 'driver') return next();
    return res.status(403).json({ success: false, message: 'Access restricted to drivers' });
};

// Admin only
export const adminOnly = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ success: false, message: 'Access restricted to admins' });
};
