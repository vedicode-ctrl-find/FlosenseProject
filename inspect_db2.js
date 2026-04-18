const mongoose = require('mongoose');
const Project = require('./models/Project');
const Employee = require('./models/Employee');

mongoose.connect('mongodb://127.0.0.1:27017/flowsense').then(async () => {
    const v = await Employee.findOne({ name: /Vedika/i });
    console.log(`Vedika's Company ID: ${v.company_id}`);
    
    const projects = await Project.find({});
    projects.forEach(p => {
        console.log(`Project ${p.name} Company ID: ${p.company_id}`);
    });
    process.exit(0);
});
