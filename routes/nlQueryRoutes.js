const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Employee = require('../models/Employee');
const Task = require('../models/Task');
const Project = require('../models/Project');

// POST /api/nl-query
router.post('/', async (req, res) => {
    try {
        const { query, company_id } = req.body;

        if (!query || !company_id) {
            return res.status(400).json({ success: false, error: 'query and company_id are required.' });
        }

        try {
            new mongoose.Types.ObjectId(company_id);
        } catch (e) {
            return res.status(400).json({ success: false, error: 'Invalid company ID format.' });
        }

        // Fetch live data
        const [employees, tasks, projects] = await Promise.all([
            Employee.find({ company_id }).select('name role skills workload_percentage efficiency'),
            Task.find({ company_id })
                .populate('assigned_to', 'name')
                .populate('project_id', 'name')
                .select('name status priority hours deadline required_skills assigned_to project_id'),
            Project.find({ company_id })
                .populate('team_lead', 'name')
                .select('name status priority deadline progress team_lead')
        ]);

        console.log(`[Local AI Engine] Processing: "${query}"`);

        const q = query.toLowerCase();
        let answer = "I couldn't quite understand that. Try asking about overloaded employees, delayed tasks, or who can take on a specific skill.";
        let candidates = [];

        // --- Rule-Based NLP Engine ---
        if (q.includes('overloaded') || q.includes('too much work')) {
            const overloaded = employees.filter(e => (e.workload_percentage || 0) > 100);
            if (overloaded.length > 0) {
                answer = `I found ${overloaded.length} employee(s) who are currently overloaded (over 100% capacity).`;
                candidates = overloaded.map(e => ({
                    name: e.name,
                    role: e.role,
                    workload: Math.round(e.workload_percentage || 0),
                    reason: `Currently at ${Math.round(e.workload_percentage)}% capacity, which exceeds the recommended limit.`
                }));
            } else {
                answer = "Great news! No one on the team is currently overloaded.";
            }
        } 
        else if (q.includes('free') || q.includes('underutilized') || q.includes('available')) {
            const free = employees.filter(e => (e.workload_percentage || 0) < 50);
            if (free.length > 0) {
                answer = `Here are the team members with the most availability right now.`;
                candidates = free.map(e => ({
                    name: e.name,
                    role: e.role,
                    workload: Math.round(e.workload_percentage || 0),
                    reason: `Has excellent bandwidth (${Math.round(e.workload_percentage)}% workload) to take on new tasks.`
                }));
            } else {
                answer = "Most of the team seems to be fully utilized at the moment.";
            }
        }
        else if (q.includes('delayed') || q.includes('late')) {
            const delayedTasks = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed');
            if (delayedTasks.length > 0) {
                answer = `I found ${delayedTasks.length} delayed task(s):\n\n` + 
                         delayedTasks.map(t => `- **${t.name}** (Assigned to: ${t.assigned_to?.name || 'Unassigned'})`).join('\n');
            } else {
                answer = "All tasks are currently on track! I don't see any delayed tasks.";
            }
        }
        else if (q.includes('progress') || q.includes('lowest')) {
            if (projects.length > 0) {
                const sorted = [...projects].sort((a, b) => (a.progress || 0) - (b.progress || 0));
                const lowest = sorted[0];
                answer = `The project with the lowest progress is **${lowest.name}**, currently at ${lowest.progress || 0}%. The team lead is ${lowest.team_lead?.name || 'Unassigned'}.`;
            } else {
                answer = "There are no active projects to analyze.";
            }
        }
        else if (q.includes('best') || q.includes('performer') || q.includes('efficient')) {
            if (employees.length > 0) {
                const sorted = [...employees].sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0));
                const best = sorted[0];
                answer = `Based on efficiency metrics, **${best.name}** is performing exceptionally well with an efficiency rating of ${Math.round(best.efficiency || 100)}%.`;
            } else {
                answer = "I don't have enough data to determine the best performer.";
            }
        }
        else if (q.includes('can take') || q.includes('who can') || q.includes('assign')) {
            let skillNeeded = null;
            const commonSkills = ['react', 'node', 'design', 'ui', 'frontend', 'backend', 'python', 'javascript'];
            for (const s of commonSkills) {
                if (q.includes(s)) skillNeeded = s;
            }

            const available = employees.filter(e => (e.workload_percentage || 0) <= 80);
            
            if (skillNeeded) {
                const matches = available.filter(e => (e.skills || []).map(s=>s.toLowerCase()).includes(skillNeeded));
                if (matches.length > 0) {
                    answer = `I found ${matches.length} team member(s) with ${skillNeeded} skills who have bandwidth.`;
                    candidates = matches.map(e => ({
                        name: e.name,
                        role: e.role,
                        workload: Math.round(e.workload_percentage || 0),
                        reason: `Has ${skillNeeded} expertise and good availability (${Math.round(e.workload_percentage)}% workload).`
                    }));
                } else {
                    answer = `I couldn't find anyone with '${skillNeeded}' skills who isn't overloaded right now.`;
                }
            } else {
                answer = `Here are some team members who have bandwidth to take on new tasks.`;
                candidates = available.slice(0, 3).map(e => ({
                    name: e.name,
                    role: e.role,
                    workload: Math.round(e.workload_percentage || 0),
                    reason: `Has availability (${Math.round(e.workload_percentage)}% workload) for new assignments.`
                }));
            }
        } else {
            answer = `I've analyzed your team of ${employees.length} members across ${projects.length} active streams. Ask me specifically about overloaded members, delayed tasks, or project progress.`;
        }

        // Simulate a tiny delay so it feels like AI is "thinking"
        setTimeout(() => {
            res.json({ success: true, answer, candidates });
        }, 1200);

    } catch (err) {
        console.error('LOCAL AI ERROR:', err.message);
        res.status(500).json({ success: false, error: 'Internal query engine failed.' });
    }
});

module.exports = router;
