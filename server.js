'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const API = process.env.API_PREFIX || '/api/v1';

app.use(helmet());
app.use(compression());

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Demasiadas solicitudes.' },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const authRoutes    = require('./routes/auth');
const workRoutes    = require('./routes/work');
const timeOffRoutes = require('./routes/timeoff');
const reportsRoutes = require('./routes/reports');

app.use(`${API}/auth`,    authRoutes);
app.use(`${API}/work`,    workRoutes);
app.use(`${API}/timeoff`, timeOffRoutes);
app.use(`${API}/reports`, reportsRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({ name: 'Work Tracker API', version: '1.0.0' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('─────────────────────────────────────────');
    console.log(` Work Tracker API corriendo en puerto ${PORT}`);
    console.log(` http://localhost:${PORT}/health`);
    console.log('─────────────────────────────────────────');
});

module.exports = app;