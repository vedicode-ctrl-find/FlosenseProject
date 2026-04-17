const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// @route   GET /api/notifications/company/:companyId
router.get('/company/:companyId', async (req, res) => {
    try {
        const { userId, role } = req.query;
        let query = { company_id: req.params.companyId };

        // Role-based filtering: Employees see ONLY their own targeted notifications
        if (role === 'employee' && userId && userId !== 'null' && userId !== 'undefined') {
            const isValidId = mongoose.Types.ObjectId.isValid(userId);
            
            if (isValidId) {
                query.recipient_id = userId;
            } else {
                // If invalid ID, they see NOTHING (strict personal isolation)
                query.recipient_id = new mongoose.Types.ObjectId(); 
            }
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ success: true, data: notifications });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// @desc    Create a new notification
// @route   POST /api/notifications
router.post('/', async (req, res) => {
    try {
        const notification = await Notification.create(req.body);
        res.json({ success: true, data: notification });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );
        res.json({ success: true, data: notification });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// @desc    Mark all as read for a company
// @route   PUT /api/notifications/company/:companyId/read-all
router.put('/company/:companyId/read-all', async (req, res) => {
    try {
        await Notification.updateMany(
            { company_id: req.params.companyId, isRead: false },
            { isRead: true }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
