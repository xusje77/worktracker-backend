const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    : new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'work_tracker_db',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 20,
    });

pool.on('error', (err) => {
    console.error('Error en pool PostgreSQL:', err);
});

const query = async (text, params) => {
    try {
        const result = await pool.query(text, params);
        return result;
    } catch (error) {
        console.error('Error en query:', error.message);
        throw error;
    }
};

const getClient = () => pool.connect();

const withTransaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const testConnection = async () => {
    try {
        const result = await query('SELECT NOW() AS current_time');
        console.log('Conectado a PostgreSQL:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('Error conectando a PostgreSQL:', error.message);
        return false;
    }
};

module.exports = { query, getClient, withTransaction, testConnection, pool };