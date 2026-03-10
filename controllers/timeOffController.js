const { query } = require('../config/database');

exports.create = async (req, res, next) => {
    try {
        const { start_date, end_date, type, description } = req.body;
        const userId = req.user.id;

        if (!start_date || !end_date || !type) {
            return res.status(400).json({
                success: false,
                message: 'Fecha inicio, fecha fin y tipo son requeridos'
            });
        }

        const validTypes = ['vacation','personal','sick','holiday','unpaid','other'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo invalido. Use: ' + validTypes.join(', ')
            });
        }

        const overlap = await query(
            `SELECT id FROM time_off
             WHERE user_id = $1
               AND status IN ('pending','approved')
               AND NOT (end_date < $2 OR start_date > $3)`,
            [userId, start_date, end_date]
        );

        if (overlap.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Las fechas se solapan con una solicitud existente',
            });
        }

        const result = await query(
            `INSERT INTO time_off (user_id, start_date, end_date, type, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, start_date, end_date, type, description]
        );

        res.status(201).json({
            success: true,
            message: 'Solicitud creada. Pendiente de aprobacion.',
            data: { timeOff: result.rows[0] },
        });
    } catch (error) {
        next(error);
    }
};

exports.getAll = async (req, res, next) => {
    try {
        const userId = req.query.userId || req.user.id;
        const year = req.query.year || new Date().getFullYear();
        const status = req.query.status;

        let sql = `
            SELECT t.*, u.name AS user_name,
                   a.name AS approved_by_name
            FROM time_off t
            JOIN users u ON u.id = t.user_id
            LEFT JOIN users a ON a.id = t.approved_by
            WHERE t.user_id = $1
              AND EXTRACT(YEAR FROM t.start_date) = $2`;

        const params = [userId, year];

        if (status) {
            sql += ` AND t.status = $3`;
            params.push(status);
        }

        sql += ` ORDER BY t.start_date DESC`;

        const result = await query(sql, params);

        const summary = await query(
            `SELECT type, SUM(days_count) AS total_days
             FROM time_off
             WHERE user_id = $1
               AND status = 'approved'
               AND EXTRACT(YEAR FROM start_date) = $2
             GROUP BY type`,
            [userId, year]
        );

        res.json({
            success: true,
            data: { timeOff: result.rows, summary: summary.rows },
        });
    } catch (error) {
        next(error);
    }
};

exports.updateStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado invalido' });
        }

        const result = await query(
            `UPDATE time_off
             SET status = $1, approved_by = $2, approved_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status, req.user.id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        }

        res.json({
            success: true,
            message: `Solicitud ${status === 'approved' ? 'aprobada' : 'rechazada'}`,
            data: { timeOff: result.rows[0] },
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query(
            'DELETE FROM time_off WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        }
        res.json({ success: true, message: 'Solicitud eliminada' });
    } catch (error) {
        next(error);
    }
};