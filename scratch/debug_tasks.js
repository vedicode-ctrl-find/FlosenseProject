const mongoose = require('mongoose');

async function debug() {
    await mongoose.connect('mongodb://127.0.0.1:27017/flowsense');
    
    const Task = mongoose.model('Task', new mongoose.Schema({
        name: String,
        assigned_to: mongoose.Schema.Types.ObjectId,
        company_id: mongoose.Schema.Types.ObjectId
    }));

    const Employee = mongoose.model('Employee', new mongoose.Schema({
        name: String,
        email: String
    }));

    const tasks = await Task.find({});
    console.log('Total Tasks:', tasks.length);
    for (const t of tasks) {
        const emp = await Employee.findById(t.assigned_to);
        console.log(`Task: ${t.name}, Assigned To: ${emp ? emp.name : 'Unknown (' + t.assigned_to + ')'}, Company: ${t.company_id}`);
    }

    const employees = await Employee.find({});
    console.log('\nEmployees:');
    for (const e of employees) {
        console.log(`Name: ${e.name}, ID: ${e._id}, Company: ${e.company_id || 'N/A'}`);
    }

    await mongoose.disconnect();
}

debug();
