const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Project = require('../models/Project');

// @route   POST /api/messages
// @desc    Send a message (project, direct, or task)
router.post('/', async (req, res) => {
    try {
        const { 
            projectId, 
            senderId, 
            senderModel, 
            senderName, 
            senderRole, 
            receiverId, 
            taskId, 
            chatType, 
            message, 
            messageType 
        } = req.body;

        if (!projectId || !senderId || !message) {
            return res.status(400).json({ success: false, error: 'projectId, senderId, and message are required.' });
        }

        // Ensure project exists
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

        // Access control: sender must be lead, member, or company admin
        const isLead = String(project.team_lead) === String(senderId);
        const isMember = project.team_members.some(m => String(m) === String(senderId));
        const isCompanySender = senderModel === 'Company';

        if (!isLead && !isMember && !isCompanySender) {
            return res.status(403).json({ success: false, error: 'Access denied: You are not assigned to this project.' });
        }

        // If direct chat, ensure receiver is also in project
        if (chatType === 'direct' && receiverId) {
            const isReceiverLead = String(project.team_lead) === String(receiverId);
            const isReceiverMember = project.team_members.some(m => String(m) === String(receiverId));
            if (!isReceiverLead && !isReceiverMember) {
                return res.status(403).json({ success: false, error: 'Restricted: Cannot message users outside of this project context.' });
            }
        }

        const newMessage = await Message.create({
            projectId,
            senderId,
            senderModel: senderModel || 'Employee',
            senderName: senderName || 'Unknown',
            senderRole: senderRole || 'Employee',
            receiverId: receiverId || null,
            taskId: taskId || null,
            chatType: chatType || 'project',
            message,
            messageType: messageType || 'General'
        });

        res.status(201).json({ success: true, data: newMessage });
    } catch (err) {
        console.error('Message POST error:', err);
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/messages/project/:projectId
// @desc    Get all general project chat messages
router.get('/project/:projectId', async (req, res) => {
    try {
        const messages = await Message.find({ 
            projectId: req.params.projectId,
            chatType: 'project'
        })
        .sort({ timestamp: 1 })
        .limit(200);

        res.json({ success: true, data: messages });
    } catch (err) {
        console.error('Message GET error:', err);
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/messages/direct/:projectId/:user1Id/:user2Id
// @desc    Get direct messages between two users in a project
router.get('/direct/:projectId/:user1Id/:user2Id', async (req, res) => {
    try {
        const { projectId, user1Id, user2Id } = req.params;
        const messages = await Message.find({
            projectId,
            chatType: 'direct',
            $or: [
                { senderId: user1Id, receiverId: user2Id },
                { senderId: user2Id, receiverId: user1Id }
            ]
        })
        .sort({ timestamp: 1 })
        .limit(200);

        res.json({ success: true, data: messages });
    } catch (err) {
        console.error('Direct Message GET error:', err);
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/messages/task/:taskId
// @desc    Get all messages for a specific task
router.get('/task/:taskId', async (req, res) => {
    try {
        const messages = await Message.find({ 
            taskId: req.params.taskId,
            chatType: 'task'
        })
        .sort({ timestamp: 1 });

        res.json({ success: true, data: messages });
    } catch (err) {
        console.error('Task Message GET error:', err);
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
