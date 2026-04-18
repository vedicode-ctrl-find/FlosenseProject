const mongoose = require('mongoose');
const Project = require('./models/Project');
const Employee = require('./models/Employee');

mongoose.connect('mongodb://127.0.0.1:27017/flowsense').then(async () => {
    const projects = await Project.find({});
    console.log("\n=== PROJECTS ===");
    projects.forEach(p => {
        console.log(`Project: ${p.name}`);
        console.log(`Lead ID: ${p.team_lead}`);
        console.log(`Team Members (IDs):`);
        console.log(p.team_members.map(m => m.toString()));
    });
    process.exit(0);
});
