const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a project name'],
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    deadline: {
        type: Date,
        required: [true, 'Please add a deadline']
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    team_lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: [true, 'Please select a team lead']
    },
    team_members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }],
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    status: {
        type: String,
        enum: ['Planning', 'Active', 'Completed', 'On Hold'],
        default: 'Planning'
    },
    required_skills: {
        type: [String],
        default: []
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Project', ProjectSchema);
