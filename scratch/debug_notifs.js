const mongoose = require('mongoose');

async function debug() {
    await mongoose.connect('mongodb://127.0.0.1:27017/flowsense');
    
    const Notification = mongoose.model('Notification', new mongoose.Schema({
        title: String,
        recipient_id: mongoose.Schema.Types.ObjectId,
        targetRole: String,
        company_id: mongoose.Schema.Types.ObjectId
    }));

    const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(10);
    console.log('Recent Notifications:');
    for (const n of notifications) {
        console.log(`Title: ${n.title}, Recipient: ${n.recipient_id || 'null'}, Role: ${n.targetRole}, Company: ${n.company_id}`);
    }

    await mongoose.disconnect();
}

debug();
