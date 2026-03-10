const { query } = require('../config/database');

exports.generatePDF = async (req, res, next) => {
    try {
        const userId = req.query.userId || req.user.id;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: 'Parámetros from y to requeridos. Ejemplo: ?from=2024-01-01&to=2024-01-31'
            });
        }

        const result = await query(
            `SELECT DATE(ws.check_in) AS date,
                    TO_CHAR(ws.check_in, 'HH24:MI') AS check_in,
                    TO_CHAR(ws.check_out, 'HH24:MI') AS check_out,
                    COALESCE(ws.net_minutes, 0) AS net_minutes,
                    COALESCE(ROUND(ws.net_minutes::numeric / 60, 2), 0) AS net_hours,
                    ws.notes, u.name AS user_name
             FROM work_sessions ws
             JOIN users u ON u.id = ws.user_id
             WHERE ws.user_id = $1
               AND DATE(ws.check_in) BETWEEN $2 AND $3
               AND ws.status IN ('closed','edited')
             ORDER BY ws.check_in ASC`,
            [userId, from, to]
        );

        const totals = await query(
            `SELECT COUNT(DISTINCT DATE(check_in)) AS days_worked,
                    COALESCE(ROUND(SUM(net_minutes)::numeric / 60, 2), 0) AS total_hours
             FROM work_sessions
             WHERE user_id = $1
               AND DATE(check_in) BETWEEN $2 AND $3
               AND status IN ('closed','edited')`,
            [userId, from, to]
        );

        res.json({
            success: true,
            message: 'Datos del reporte generados',
            data: {
                sessions: result.rows,
                totals: totals.rows[0],
                period: { from, to }
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.generateCSV = async (req, res, next) => {
    try {
        const userId = req.query.userId || req.user.id;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: 'Parámetros from y to requeridos'
            });
        }

        const result = await query(
            `SELECT DATE(ws.check_in) AS fecha,
                    u.name AS empleado,
                    TO_CHAR(ws.check_in, 'HH24:MI') AS entrada,
                    TO_CHAR(ws.check_out, 'HH24:MI') AS salida,
                    COALESCE(ws.break_minutes, 0) AS descanso_min,
                    COALESCE(ROUND(ws.net_minutes::numeric / 60, 2), 0) AS horas_netas,
                    ws.status AS estado,
                    COALESCE(ws.notes, '') AS notas
             FROM work_sessions ws
             JOIN users u ON u.id = ws.user_id
             WHERE ws.user_id = $1
               AND DATE(ws.check_in) BETWEEN $2 AND $3
               AND ws.status IN ('closed','edited')
             ORDER BY ws.check_in ASC`,
            [userId, from, to]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No hay datos para el período seleccionado'
            });
        }

        const headers = Object.keys(result.rows[0]).join(';');
        const rows = result.rows.map(row => Object.values(row).join(';'));
        const csv = '\uFEFF' + [headers, ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="reporte_${from}_${to}.csv"`);
        res.send(csv);

    } catch (error) {
        next(error);
    }
};