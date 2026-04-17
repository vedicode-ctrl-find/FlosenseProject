const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Employee = require('../models/Employee');

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private
router.post('/', async (req, res) => {
    try {
        const { name, description, deadline, priority, team_lead, company_id, required_skills } = req.body;
        const project = await Project.create({
            name, description, deadline, priority,
            team_lead, company_id, required_skills
        });
        res.status(201).json({ success: true, data: project });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/projects/:id
// @desc    Get a single project with populated lead & members
// @access  Private
router.get('/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('team_lead', 'name role workload_percentage efficiency')
            .populate('team_members', 'name role workload_percentage skills efficiency');
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
        res.json({ success: true, data: project });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   PUT /api/projects/:id/team
// @desc    Update team members for a project
// @access  Private
router.put('/:id/team', async (req, res) => {
    try {
        const { team_members } = req.body;
        const project = await Project.findByIdAndUpdate(
            req.params.id,
            { team_members },
            { new: true, runValidators: true }
        ).populate('team_members', 'name role workload_percentage skills');
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
        res.json({ success: true, data: project });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/projects/employees/:company_id
// @desc    Get all employees for a company with workload data
// @access  Private
router.get('/employees/:company_id', async (req, res) => {
    try {
        const employees = await Employee.find({ company_id: req.params.company_id })
            .select('name role skills workload_percentage efficiency employee_id');
        res.json({ success: true, data: employees });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/projects/company/:company_id
// @desc    Get all projects for a company
// @access  Private
router.get('/company/:company_id', async (req, res) => {
    try {
        const projects = await Project.find({ company_id: req.params.company_id })
            .select('name status');
        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/projects/lead/:employee_id
// @desc    Get all projects where the given employee is the team_lead
// @access  Private (used by frontend to verify team lead access)
router.get('/lead/:employee_id', async (req, res) => {
    try {
        const projects = await Project.find({ team_lead: req.params.employee_id })
            .select('name status deadline team_members');
        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/projects/:id/members
// @desc    Get team members of a specific project
// @access  Private
router.get('/:id/members', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('team_members', 'name role workload_percentage skills efficiency employee_id')
            .populate('team_lead', 'name role workload_percentage skills efficiency employee_id');
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
        // Include both team_lead and team_members in the response
        const allMembers = [project.team_lead, ...project.team_members].filter(Boolean);
        res.json({ success: true, data: allMembers });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
