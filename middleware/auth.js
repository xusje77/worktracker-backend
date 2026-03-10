const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token requerido' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await query(
            'SELECT u.id, u.name, u.email, u.role_id, u.is_active, r.name AS role_name, r.permissions FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1',
            [decoded.userId]
        );
        if (result.rows.length === 0 || !result.rows[0].is_active) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        }
        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expirado', code: 'TOKEN_EXPIRED' });
        if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Token invalido' });
        next(error);
    }
};

const authorize = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' });
    if (req.user.permissions && req.user.permissions.all) return next();
    if (!roles.includes(req.user.role_name)) return res.status(403).json({ success: false, message: 'Acceso denegado' });
    next();
};

module.exports = { authenticate, authorize };