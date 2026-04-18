const mongoose = require('mongoose');
const Notification = require('./models/Notification');
const Project = require('./models/Project');
const Employee = require('./models/Employee');
const Company = require('./models/Company');

mongoose.connect('mongodb://localhost:27017/flowsense_db')
  .then(async () => {
    // Let's create a dummy project via the exact API route logic to test notifications.
    const company = await Company.findOne({});
    const employees = await Employee.find({ company_code: company.company_code });
    
    if(!company || employees.length < 2) {
      console.log('Not enough data to test.');
      process.exit(1);
    }

    const teamLead = employees[0];
    const teamMember = employees[1];

    console.log('Company:', company.name, company._id);
    console.log('Team Lead:', teamLead.name, teamLead._id);
    console.log('Team Member:', teamMember.name, teamMember._id);

    // 1. Create Project
    const newProject = await Project.create({
      company_id: company._id,
      name: 'Integration Test Project',
      description: 'Testing notifications',
      deadline: new Date(),
      team_lead: teamLead._id,
      priority: 'Medium'
    });
    console.log('Project created:', newProject._id);

    // 2. Trigger Notification logic exactly as in projectRoutes.js (POST /api/projects)
    await Notification.create({
        company_id: company._id,
        recipient_id: teamLead._id,
        type: 'success',
        title: 'New Project Assigned',
        description: `You have been designated as the Team Lead for the new project: ${newProject.name}.`,
        longDescription: `As the newly assigned Team Lead for "${newProject.name}", you possess full authorization to manage milestones...`,
        category: 'assignment',
        projectLink: newProject._id.toString(),
        action: 'Manage Team',
        targetRole: 'lead'
    });

    // 3. Add to project
    newProject.team_members.push(teamMember._id);
    await newProject.save();

    // 4. Trigger Notification logic (PUT /api/projects/:id/team)
    await Notification.create({
        company_id: company._id,
        recipient_id: teamMember._id,
        type: 'info',
        title: 'Added to Project',
        description: `You have been added to the project: ${newProject.name}.`,
        longDescription: `You have been successfully integrated into the "${newProject.name}" operational stream.`,
        category: 'assignment',
        projectLink: newProject._id.toString(),
        action: 'View Tasks',
        targetRole: 'employee'
    });

    console.log('Inserted notifications.');
    
    // Now fetch to check connection logic matching notificationRoutes.js
    
    // Fetch for Team Lead
    let queryLead = { company_id: company._id };
    if (mongoose.isValidObjectId(teamLead._id)) queryLead.recipient_id = teamLead._id;
    const leadNotifs = await Notification.find(queryLead).sort({ createdAt: -1 });
    
    // Fetch for Team Member
    let queryMember = { company_id: company._id };
    if (mongoose.isValidObjectId(teamMember._id)) queryMember.recipient_id = teamMember._id;
    const memberNotifs = await Notification.find(queryMember).sort({ createdAt: -1 });

    // Fetch for Company
    let queryCompany = { company_id: company._id, recipient_id: null, targetRole: 'company' };
    const compNotifs = await Notification.find(queryCompany).sort({ createdAt: -1 });

    console.log('\n--- LEAD NOTIFICATIONS ---');
    console.log(leadNotifs.filter(n => n.title === 'New Project Assigned'));
    
    console.log('\n--- MEMBER NOTIFICATIONS ---');
    console.log(memberNotifs.filter(n => n.title === 'Added to Project'));

    // Test separation: does Company see lead or member targeted notifs?
    console.log('\n--- COMPANY NOTIFICATIONS (SHOULD BE CLEAN OF TEAM ASSIGNMENTS) ---');
    console.log(compNotifs);

    process.exit(0);
  })
  .catch(console.error);
