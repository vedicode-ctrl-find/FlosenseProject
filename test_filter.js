const userId = "69de3d5a3234a6fbcdca6b44";

const projects = [
    {
        name: "vh",
        team_lead: "69de3d5a3234a6fbcdca6b44",
        team_members: [ '69e0ffff4d12840d26f1f22c', '69e2339c32b120dda28ea5c1', '69e2340632b120dda28ea5c5' ]
    },
    {
        name: "Market",
        team_lead: "69e2339c32b120dda28ea5c1",
        team_members: [ '69de3d5a3234a6fbcdca6b44', '69e0ffff4d12840d26f1f22c' ]
    }
];

const myProjects = projects.filter(p => {
    const isMember = p.team_members && p.team_members.some(m => String(m._id || m.id || m) === String(userId));
    const isLead = p.team_lead && String(p.team_lead._id || p.team_lead.id || p.team_lead) === String(userId);
    return isMember || isLead;
});

console.log('Filtered projects:', myProjects.length);
