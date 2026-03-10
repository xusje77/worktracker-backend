const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
    await pool.query(`DROP TABLE IF EXISTS work_sessions CASCADE`);
    await pool.query(`
        CREATE TABLE work_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            check_in TIMESTAMPTZ NOT NULL,
            check_out TIMESTAMPTZ,
            break_minutes INT DEFAULT 0,
            total_minutes INT GENERATED ALWAYS AS (
                CASE WHEN check_out IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (check_out - check_in))::INT / 60 
                ELSE NULL END
            ) STORED,
            net_minutes INT GENERATED ALWAYS AS (
                CASE WHEN check_out IS NOT NULL 
                THEN (EXTRACT(EPOCH FROM (check_out - check_in))::INT / 60) - COALESCE(break_minutes, 0)
                ELSE NULL END
            ) STORED,
            notes TEXT,
            location VARCHAR(200),
            status VARCHAR(20) DEFAULT 'open',
            edited_by UUID REFERENCES users(id),
            edited_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    console.log('work_sessions recreada OK');
    pool.end();
}

migrate().catch(e => { console.error(e.message); pool.end(); });