const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Employee = require('../models/Employee');
const Task = require('../models/Task');

// @route   POST /api/tasks/recommend
// @desc    Get top 3 recommended employees for a task
// @access  Private
router.post('/recommend', async (req, res) => {
    try {
        const { project_id, required_skills, estimated_hours } = req.body;

        if (!project_id) {
            return res.status(400).json({ success: false, error: 'Project ID is required' });
        }

        // 1. Fetch Project and its members
        const project = await Project.findById(project_id)
            .populate('team_members', 'name role skills workload_percentage efficiency employee_id')
            .populate('team_lead', 'name role skills workload_percentage efficiency employee_id');

        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        // Combine lead and members
        const candidates = [project.team_lead, ...project.team_members].filter(Boolean);

        // 2. Calculate scores for each candidate
        const recommendations = candidates.map(emp => {
            let skillScore = 0;
            let capacityScore = 0;
            let efficiencyScore = (emp.efficiency || 100) / 5; // Max 20 points
            let analysis = [];

            // A. Skill Match (Max 50 points)
            if (required_skills && Array.isArray(required_skills)) {
                const matches = required_skills.filter(skill => 
                    emp.skills && emp.skills.some(s => s.toLowerCase() === skill.toLowerCase())
                );
                
                if (matches.length > 0) {
                    skillScore = Math.min(50, (matches.length / required_skills.length) * 50);
                    analysis.push(`Matches ${matches.length} required skill(s).`);
                } else {
                    analysis.push(`Does not possess specified primary skills.`);
                }
            }

            // B. Capacity Match (Max 30 points)
            const currentWL = emp.workload_percentage || 0;
            const projectedAddition = estimated_hours ? (estimated_hours / 40) * 100 : 0;
            const projectedWL = currentWL + projectedAddition;

            if (projectedWL <= 70) {
                capacityScore = 30;
                analysis.push(`Excellent bandwidth (Projected: ${Math.round(projectedWL)}%).`);
            } else if (projectedWL <= 90) {
                capacityScore = 20;
                analysis.push(`Healthy bandwidth (Projected: ${Math.round(projectedWL)}%).`);
            } else if (projectedWL <= 110) {
                capacityScore = 10;
                analysis.push(`Approaching capacity (Projected: ${Math.round(projectedWL)}%).`);
            } else {
                capacityScore = Math.max(-20, 10 - (projectedWL - 110)); // Penalize overload
                analysis.push(`High risk of overload (Projected: ${Math.round(projectedWL)}%).`);
            }

            // C. Performance Bonus
            if (emp.efficiency > 105) {
                analysis.push(`Recognized high performer.`);
            }

            const totalScore = Math.round(skillScore + capacityScore + efficiencyScore);

            return {
                id: emp._id,
                name: emp.name,
                role: emp.role,
                employee_id: emp.employee_id,
                matchScore: totalScore,
                analysis: analysis.join(' '),
                workload: currentWL,
                projectedWorkload: projectedWL
            };
        });

        // 3. Sort and pick top 3
        recommendations.sort((a, b) => b.matchScore - a.matchScore);
        const top3 = recommendations.slice(0, 3);

        res.json({ success: true, data: top3 });

    } catch (err) {
        console.error('RECOMMENDATION ERROR:', err);
        res.status(500).json({ success: false, error: 'Failed to generate recommendations.' });
    }
});

module.exports = router;
