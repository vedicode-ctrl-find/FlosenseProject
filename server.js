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
app.use(express.static(__dirname));

// Load routes
const authRoutes    = require('./routes/auth');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes    = require('./routes/taskRoutes');
const teamRoutes    = require('./routes/teamRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Mount routes
app.use('/api/auth',         authRoutes);
app.use('/api/projects',     projectRoutes);
app.use('/api/tasks',        taskRoutes);
app.use('/api/team-members', teamRoutes); 
app.use('/api/notifications', notificationRoutes);

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
