const mongoose = require('mongoose');
const Project = require('./models/Project');
const Employee = require('./models/Employee');

mongoose.connect('mongodb://127.0.0.1:27017/flowsense').then(async () => {
    console.log("=== EMPLOYEES ===");
    const employees = await Employee.find({});
    employees.forEach(e => console.log(`[${e._id}] ${e.name} (${e.role})`));
    
    console.log("\n=== PROJECTS ===");
    const projects = await Project.find({});
    projects.forEach(p => {
        console.log(`Project: ${p.name}`);
        console.log(`Lead: ${p.team_lead}`);
        console.log(`Members: ${p.team_members.map(m => m.toString()).join(', ')}`);
    });
    process.exit(0);
});
