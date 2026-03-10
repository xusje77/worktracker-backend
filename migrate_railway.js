const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
    await pool.query(`CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE NOT NULL, permissions JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL, email VARCHAR(150) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role_id INT REFERENCES roles(id) DEFAULT 3, department VARCHAR(100), position VARCHAR(100), is_active BOOLEAN DEFAULT true, refresh_token TEXT, last_login TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS work_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), check_in TIMESTAMPTZ NOT NULL, check_out TIMESTAMPTZ, notes TEXT, location VARCHAR(200), status VARCHAR(20) DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS time_off (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), start_date DATE NOT NULL, end_date DATE NOT NULL, type VARCHAR(50) NOT NULL, description TEXT, status VARCHAR(20) DEFAULT 'pending', approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ, days_count INT GENERATED ALWAYS AS ((end_date - start_date) + 1) STORED, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS schedules (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) UNIQUE, monday_start TIME, monday_end TIME, tuesday_start TIME, tuesday_end TIME, wednesday_start TIME, wednesday_end TIME, thursday_start TIME, thursday_end TIME, friday_start TIME, friday_end TIME, saturday_start TIME, saturday_end TIME, sunday_start TIME, sunday_end TIME, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await pool.query(`INSERT INTO roles (name, permissions) VALUES ('admin', '{"all":true}'), ('manager', '{"reports":true}'), ('employee', '{}') ON CONFLICT (name) DO NOTHING`);
    await pool.query(`INSERT INTO users (name, email, password_hash, role_id) VALUES ('Administrador', 'admin@worktracker.com', '$2b$12$r6V1KZk0aC/gH/6wJNniUON9ftqDlDLE/uWPAU6HhXV5IUO2VN4JC', 1) ON CONFLICT (email) DO NOTHING`);
    console.log('Migracion completada OK');
    pool.end();
}

migrate().catch(e => { console.error(e.message); pool.end(); });