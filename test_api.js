async function testAPI() {
    try {
        const companyId = '69de370f3234a6fbcdca6b3d';
        console.log(`Company ID: ${companyId}`);
        const projectsRes = await fetch(`http://localhost:5000/api/projects/company/${companyId}`);
        const projectsData = await projectsRes.json();
        console.log("PROJECTS DATA:");
        console.dir(projectsData, {depth: null});
    } catch(e) {
        console.error(e);
    }
}
testAPI();
