const { query } = require('../config/database');

exports.checkIn = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { notes, location } = req.body;
        const openSession = await query(`SELECT id FROM work_sessions WHERE user_id = $1 AND status = 'open'`, [userId]);
        if (openSession.rows.length > 0) return res.status(409).json({ success: false, message: 'Ya tienes una jornada abierta' });
        const result = await query(`INSERT INTO work_sessions (user_id, check_in, notes, status) VALUES ($1, NOW(), $2, 'open') RETURNING id, check_in, notes, status`, [userId, notes || null]);
        res.status(201).json({ success: true, message: 'Jornada iniciada', data: { session: result.rows[0] } });
    } catch (error) { next(error); }
};

exports.checkOut = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { notes, break_minutes = 0 } = req.body;
        const openSession = await query(`SELECT id, check_in FROM work_sessions WHERE user_id = $1 AND status = 'open'`, [userId]);
        if (openSession.rows.length === 0) return res.status(404).json({ success: false, message: 'No tienes una jornada abierta' });
        const result = await query(
            `UPDATE work_sessions SET check_out = NOW(), notes = COALESCE($1, notes), break_minutes = $2, status = 'closed' WHERE id = $3 RETURNING id, check_in, check_out, total_minutes, net_minutes, break_minutes, status`,
            [notes || null, break_minutes, openSession.rows[0].id]
        );
        const updated = result.rows[0];
        const totalHours = updated.net_minutes ? (updated.net_minutes / 60).toFixed(2) : '0';
        res.json({ success: true, message: `Jornada cerrada. Horas trabajadas: ${totalHours}h`, data: { session: updated } });
    } catch (error) { next(error); }
};

exports.getActiveSession = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, check_in, notes, status, EXTRACT(EPOCH FROM (NOW() - check_in))::INTEGER / 60 AS elapsed_minutes FROM work_sessions WHERE user_id = $1 AND status = 'open'`,
            [req.user.id]
        );
        res.json({ success: true, data: { session: result.rows[0] || null } });
    } catch (error) { next(error); }
};

exports.getHistory = async (req, res, next) => {
    try {
        const userId = req.query.userId || req.user.id;
        const now = new Date();
        const from = req.query.from || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
        const to = req.query.to || now.toISOString().split('T')[0];
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const result = await query(
            `SELECT ws.id, ws.check_in, ws.check_out, ws.total_minutes, ws.net_minutes, ws.break_minutes, ws.notes, ws.status FROM work_sessions ws WHERE ws.user_id = $1 AND DATE(ws.check_in) BETWEEN $2 AND $3 ORDER BY ws.check_in DESC LIMIT $4 OFFSET $5`,
            [userId, from, to, limit, offset]
        );
        const countResult = await query(`SELECT COUNT(*) AS total FROM work_sessions WHERE user_id = $1 AND DATE(check_in) BETWEEN $2 AND $3`, [userId, from, to]);
        res.json({ success: true, data: { sessions: result.rows, pagination: { page, limit, total: parseInt(countResult.rows[0].total) } } });
    } catch (error) { next(error); }
};

exports.getStats = async (req, res, next) => {
    try {
        const userId = req.query.userId || req.user.id;
        const now = new Date();
        const y = req.query.year || now.getFullYear();
        const m = req.query.month || now.getMonth() + 1;
        const monthlyStats = await query(
            `SELECT COUNT(DISTINCT DATE(check_in)) AS days_worked, COUNT(id) AS sessions_count, COALESCE(SUM(net_minutes), 0) AS total_net_minutes, COALESCE(ROUND(SUM(net_minutes)::numeric / 60, 2), 0) AS total_hours, COALESCE(ROUND(AVG(net_minutes)::numeric / 60, 2), 0) AS avg_daily_hours FROM work_sessions WHERE user_id = $1 AND status = 'closed' AND EXTRACT(YEAR FROM check_in) = $2 AND EXTRACT(MONTH FROM check_in) = $3`,
            [userId, y, m]
        );
        const dailyBreakdown = await query(
            `SELECT DATE(check_in) AS date, COALESCE(ROUND(SUM(net_minutes)::numeric / 60, 2), 0) AS hours FROM work_sessions WHERE user_id = $1 AND status = 'closed' AND EXTRACT(YEAR FROM check_in) = $2 AND EXTRACT(MONTH FROM check_in) = $3 GROUP BY DATE(check_in) ORDER BY DATE(check_in)`,
            [userId, y, m]
        );
        res.json({ success: true, data: { monthly: monthlyStats.rows[0], dailyBreakdown: dailyBreakdown.rows, period: { year: y, month: m } } });
    } catch (error) { next(error); }
};

exports.updateSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { check_in, check_out, break_minutes, notes } = req.body;
        const sessionResult = await query('SELECT id, user_id FROM work_sessions WHERE id = $1', [sessionId]);
        if (sessionResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Sesion no encontrada' });
        const result = await query(
            `UPDATE work_sessions SET check_in = COALESCE($1, check_in), check_out = COALESCE($2, check_out), break_minutes = COALESCE($3, break_minutes), notes = COALESCE($4, notes), status = 'edited', edited_by = $5, edited_at = NOW() WHERE id = $6 RETURNING *`,
            [check_in, check_out, break_minutes, notes, req.user.id, sessionId]
        );
        res.json({ success: true, message: 'Sesion actualizada', data: { session: result.rows[0] } });
    } catch (error) { next(error); }
};