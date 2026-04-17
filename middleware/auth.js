/**
 * middleware/auth.js
 * JWT verification middleware.
 * Attaches decoded token payload to req.user = { id, role? }
 */

const jwt = require('jsonwebtoken');

module.exports = function protect(req, res, next) {
    // Accept token from Authorization: Bearer <token> header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized — no token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, role? }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Token is invalid or expired.' });
    }
};
