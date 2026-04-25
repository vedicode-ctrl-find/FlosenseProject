// Fix: local router DNS blocks MongoDB Atlas SRV lookups — use Google DNS
require('dns').setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('../config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Load routes
const authRoutes            = require('../routes/auth');
const projectRoutes         = require('../routes/projectRoutes');
const taskRoutes            = require('../routes/taskRoutes');
const teamRoutes            = require('../routes/teamRoutes');
const notificationRoutes    = require('../routes/notificationRoutes');
const messageRoutes         = require('../routes/messageRoutes');
const recommendationRoutes  = require('../routes/recommendationRoutes');
const nlQueryRoutes         = require('../routes/nlQueryRoutes');

// Mount routes
app.use('/api/auth',            authRoutes);
app.use('/api/projects',        projectRoutes);
app.use('/api/tasks',           taskRoutes);
app.use('/api/team-members',    teamRoutes);
app.use('/api/notifications',   notificationRoutes);
app.use('/api/messages',        messageRoutes);
app.use('/api/recommend',       recommendationRoutes);
app.use('/api/nl-query',        nlQueryRoutes);

// Heartbeat route
app.get('/heartbeat', (req, res) => {
    res.json({ success: true, status: 'operational', timestamp: new Date() });
});

// Global Error Handling
process.on('unhandledRejection', (err) => {
    console.log(`❌ Unhandled Rejection: ${err.message}`);
});
process.on('uncaughtException', (err) => {
    console.log(`❌ Uncaught Exception: ${err.message}`);
});

module.exports = app;
