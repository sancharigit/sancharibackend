import logger from '../logger.js';
import AppError from '../Utils/AppError.js';

const handleCastErrorDB = (err) =>
    new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldsDB = (err) => {
    const field = Object.keys(err.keyValue)[0];
    return new AppError(`${field} already exists. Please use a different ${field}.`, 409);
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map((e) => e.message);
    return new AppError('Invalid input data.', 400, errors);
};

const handleJWTError = () =>
    new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () =>
    new AppError('Your token has expired. Please log in again.', 401);

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        status: err.status,
        message: err.message,
        errors: err.errors,
        stack: err.stack,
    });
};

const sendErrorProd = (err, res) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            message: err.message,
            errors: err.errors,
        });
    } else {
        // Don't leak programming errors to client
        logger.error('UNHANDLED ERROR:', err);
        res.status(500).json({
            success: false,
            status: 'error',
            message: 'Something went wrong. Please try again.',
        });
    }
};

const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method}`);

    if (process.env.NODE_ENV === 'development') {
        return sendErrorDev(err, res);
    }

    let error = { ...err, message: err.message };

    if (err.name === 'CastError') error = handleCastErrorDB(err);
    if (err.code === 11000) error = handleDuplicateFieldsDB(err);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
};

export default globalErrorHandler;
