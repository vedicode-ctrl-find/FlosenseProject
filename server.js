const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.static(__dirname));

// Load routes
const authRoutes    = require('./routes/auth');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes    = require('./routes/taskRoutes');
const teamRoutes    = require('./routes/teamRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const nlQueryRoutes = require('./routes/nlQueryRoutes');

// Mount routes
app.use('/api/auth',         authRoutes);
app.use('/api/projects',     projectRoutes);
app.use('/api/tasks',        taskRoutes);
app.use('/api/team-members', teamRoutes); 
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages',     messageRoutes);
app.use('/api/recommend',    recommendationRoutes);
app.use('/api/nl-query',     nlQueryRoutes);

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Heartbeat route for health checks
app.get('/heartbeat', (req, res) => {
    res.json({ success: true, status: 'operational', timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// ── Global Error Handling ──
// Handle unhandled promise rejections (e.g. database query failures)
process.on('unhandledRejection', (err, promise) => {
    console.log(`❌ Unhandled Rejection: ${err.message}`);
    // Optional: server.close(() => process.exit(1)); 
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.log(`❌ Uncaught Exception: ${err.message}`);
});
