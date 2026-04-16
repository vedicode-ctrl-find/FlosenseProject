const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Employee = require('../models/Employee');

// Workload capacity base
const BASE_WEEKLY_HOURS = 40;

// @route   POST /api/tasks
// @desc    Create a new task and recalculate employee workload
// @access  Private
router.post('/', async (req, res) => {
    try {
        const { name, description, required_skills, deadline, hours, assigned_to, project_id, company_id } = req.body;
        
        // Ensure employee exists
        const employee = await Employee.findById(assigned_to);
        if (!employee) {
            return res.status(404).json({ success: false, error: 'Employee not found' });
        }

        // Create the task
        const task = await Task.create({
            name, description, required_skills, deadline, hours,
            assigned_to, project_id, company_id
        });

        // Recalculate Workload
        const allTasks = await Task.find({ assigned_to: assigned_to });
        
        let totalHours = 0;
        allTasks.forEach(t => {
            totalHours += t.hours;
        });

        // Calculate workload (total hours / 40) * 100
        const newWorkload = Math.round((totalHours / BASE_WEEKLY_HOURS) * 100);
        
        employee.workload_percentage = newWorkload;
        await employee.save();

        res.status(201).json({ 
            success: true, 
            data: {
                task,
                updatedWorkload: newWorkload
            } 
        });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/tasks/employee/:emp_id
// @desc    Get all tasks for an employee
// @access  Private
router.get('/employee/:emp_id', async (req, res) => {
    try {
        const tasks = await Task.find({ assigned_to: req.params.emp_id }).populate('project_id', 'name status');
        res.json({ success: true, data: tasks });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/tasks/company/:company_id
// @desc    Get all tasks for a company
// @access  Private
router.get('/company/:company_id', async (req, res) => {
    try {
        const tasks = await Task.find({ company_id: req.params.company_id })
             .populate('assigned_to', 'name role')
             .populate('project_id', 'name');
        res.json({ success: true, data: tasks });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
