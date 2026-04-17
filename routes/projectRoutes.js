const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Employee = require('../models/Employee');
const protect = require('../middleware/auth');

// router.use(protect);

// @route   POST /api/projects
// @desc    Create a new project
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

// @route   GET /api/projects/company/:company_id
// @desc    Get all projects for a company
router.get('/company/:company_id', async (req, res) => {
    try {
        const projects = await Project.find({ company_id: req.params.company_id })
            .select('_id name status description deadline priority team_lead team_members progress created_at');
        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/projects/employees/:company_id
// @desc    Get all employees for a company
router.get('/employees/:company_id', async (req, res) => {
    try {
        const employees = await Employee.find({ company_id: req.params.company_id })
            .select('name role skills workload_percentage efficiency employee_id');
        res.json({ success: true, data: employees });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   GET /api/projects/lead/:employee_id
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
router.get('/:id/members', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
        const project = await Project.findById(req.params.id)
            .populate('team_members', 'name role workload_percentage skills efficiency employee_id')
            .populate('team_lead', 'name role workload_percentage skills efficiency employee_id');
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
        const allMembers = [project.team_lead, ...project.team_members].filter(Boolean);
        res.json({ success: true, data: allMembers });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// @route   PUT /api/projects/:id/team
// @desc    Update team members
router.put('/:id/team', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
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

// @route   GET /api/projects/:id
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
        const project = await Project.findById(req.params.id)
            .populate('team_lead', 'name role workload_percentage efficiency')
            .populate('team_members', 'name role workload_percentage skills efficiency');
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
        res.json({ success: true, data: project });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// @route   PUT /api/projects/:id
router.put('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
        const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
        res.json({ success: true, data: project });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// @route   POST /api/projects/:id/delete
// @desc    Delete a project (Using POST for maximum compatibility)
router.post('/:id/delete', async (req, res) => {
    try {
        console.log('Force deleting project via POST:', req.params.id);
        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.json({ success: true, data: { message: 'Deleted' } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
