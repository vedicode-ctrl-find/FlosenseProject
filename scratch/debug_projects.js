const mongoose = require('mongoose');

async function debug() {
    await mongoose.connect('mongodb://127.0.0.1:27017/flowsense');
    
    const Project = mongoose.model('Project', new mongoose.Schema({
        name: String,
        team_lead: mongoose.Schema.Types.ObjectId
    }));

    const projects = await Project.find({});
    for (const p of projects) {
        console.log(`Project: ${p.name}, ID: ${p._id}, Lead ID: ${p.team_lead}`);
    }

    await mongoose.disconnect();
}

debug();
