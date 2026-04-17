const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    recipient_id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null // Null = Company-wide, Not Null = Targeted to specific userId
    },
    type: {
        type: String,
        enum: ['info', 'success', 'danger', 'warning'],
        default: 'info'
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    longDescription: {
        type: String
    },
    category: {
        type: String,
        default: 'system'
    },
    projectLink: {
        type: String
    },
    action: {
        type: String
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notification', NotificationSchema);
