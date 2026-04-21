const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Employee = require('../models/Employee');
const Project = require('../models/Project');

// Workload capacity base
const BASE_WEEKLY_HOURS = 40;

// @route   POST /api/tasks
// @desc    Create a new task and recalculate employee workload
// @access  Private
// @route   GET /api/tasks/project/:project_id
// @desc    Get all tasks for a specific project
// @access  Private
router.get('/project/:project_id', async (req, res) => {
    try {
        const tasks = await Task.find({ project_id: req.params.project_id })
            .populate('assigned_to', 'name role workload_percentage employee_id')
            .sort({ created_at: -1 });
        res.json({ success: true, data: tasks });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   POST /api/tasks
// @desc    Create a new task — Only Team Lead of the project can create
// @access  Private (Team Lead only)
router.post('/', async (req, res) => {
    try {
        const { name, description, required_skills, deadline, hours, assigned_to, project_id, company_id, requested_by } = req.body;

        const project = await Project.findById(project_id);
        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        // ── AUTHORIZATION: Only the Team Lead of this project can assign tasks ──
        if (requested_by) {
            const isTeamLead = project.team_lead.toString() === requested_by.toString();
            if (!isTeamLead) {
                return res.status(403).json({ success: false, error: 'Access denied. Only the Team Lead of this project can assign tasks.' });
            }
        }

        // ── DATE VALIDATION: Task deadline must be within the project schedule ──
        if (deadline) {
            const taskDateStr = new Date(deadline).toISOString().split('T')[0];
            const projectStartStr = new Date(project.created_at).toISOString().split('T')[0];
            
            if (taskDateStr < projectStartStr) {
                return res.status(400).json({ success: false, error: 'Task deadline cannot be before the project started.' });
            }

            if (project.deadline) {
                const projectEndStr = new Date(project.deadline).toISOString().split('T')[0];
                if (taskDateStr > projectEndStr) {
                    return res.status(400).json({ success: false, error: 'Task deadline cannot be after the project deadline.' });
                }
            }
        }
        
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

// @route   PUT /api/tasks/:id/status
// @desc    Update task status (and workload if completed)
// @access  Private
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

        const oldStatus = task.status;
        task.status = status;
        await task.save();

        // If newly completed, reduce workload
        if (status === 'Completed' && oldStatus !== 'Completed') {
            const emp = await Employee.findById(task.assigned_to);
            if (emp) {
                const reduction = Math.round(task.hours * 2.5);
                emp.workload_percentage = Math.max(0, (emp.workload_percentage || 0) - reduction);
                await emp.save();
            }
        } 
        // If moved back FROM completed, re-add workload
        else if (oldStatus === 'Completed' && status !== 'Completed') {
            const emp = await Employee.findById(task.assigned_to);
            if (emp) {
                const addition = Math.round(task.hours * 2.5);
                emp.workload_percentage = (emp.workload_percentage || 0) + addition;
                await emp.save();
            }
        }

        res.json({ success: true, data: task });
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
