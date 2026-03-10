const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const SALT_ROUNDS = 12;

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

const formatUser = (user) => ({
    id: user.id, name: user.name, email: user.email,
    role: user.role_name || user.role_id,
    department: user.department, position: user.position,
});

exports.register = async (req, res, next) => {
    try {
        const { name, email, password, department, position, role_id = 3 } = req.body;
        if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Nombre, email y contrasena son requeridos' });
        const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'El email ya esta registrado' });
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await query(
            'INSERT INTO users (name, email, password_hash, role_id, department, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role_id, department, position, created_at',
            [name.trim(), email.toLowerCase().trim(), passwordHash, role_id, department, position]
        );
        const user = result.rows[0];
        const { accessToken, refreshToken } = generateTokens(user.id);
        await query('UPDATE users SET refresh_token = $1, last_login = NOW() WHERE id = $2', [refreshToken, user.id]);
        res.status(201).json({ success: true, message: 'Usuario registrado', data: { user: formatUser(user), accessToken, refreshToken } });
    } catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email y contrasena requeridos' });
        const result = await query(
            'SELECT u.*, r.name AS role_name, r.permissions FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = $1',
            [email.toLowerCase().trim()]
        );
        const user = result.rows[0];
        const passwordMatch = user
            ? await bcrypt.compare(password, user.password_hash)
            : await bcrypt.compare(password, '$2b$12$invalidhash');
        if (!user || !passwordMatch) return res.status(401).json({ success: false, message: 'Email o contrasena incorrectos' });
        if (!user.is_active) return res.status(403).json({ success: false, message: 'Cuenta desactivada' });
        const { accessToken, refreshToken } = generateTokens(user.id);
        await query('UPDATE users SET refresh_token = $1, last_login = NOW() WHERE id = $2', [refreshToken, user.id]);
        res.json({ success: true, message: 'Login exitoso', data: { user: formatUser(user), accessToken, refreshToken } });
    } catch (error) { next(error); }
};

exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token requerido' });
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const result = await query('SELECT id, is_active, refresh_token FROM users WHERE id = $1', [decoded.userId]);
        const user = result.rows[0];
        if (!user || user.refresh_token !== refreshToken || !user.is_active) return res.status(401).json({ success: false, message: 'Refresh token invalido' });
        const tokens = generateTokens(user.id);
        await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [tokens.refreshToken, user.id]);
        res.json({ success: true, data: tokens });
    } catch (error) { next(error); }
};

exports.logout = async (req, res, next) => {
    try {
        await query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);
        res.json({ success: true, message: 'Sesion cerrada' });
    } catch (error) { next(error); }
};

exports.me = async (req, res) => {
    res.json({ success: true, data: { user: formatUser(req.user) } });
};