const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a task name'],
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    required_skills: {
        type: [String],
        default: []
    },
    deadline: {
        type: Date,
        required: [true, 'Please add a deadline']
    },
    hours: {
        type: Number,
        required: [true, 'Please add estimated hours for the task'],
        min: [1, 'Hours must be at least 1']
    },
    assigned_to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: [true, 'Please assign an employee']
    },
    project_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Please associate the task with a project']
    },
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Testing', 'Completed'],
        default: 'Pending'
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Task', TaskSchema);
