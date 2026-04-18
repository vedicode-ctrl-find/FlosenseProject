const fs = require('fs');
const path = './js/dashboard-company.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/fetch\('\/api\//g, "fetch('http://localhost:5000/api/");
content = content.replace(/fetch\(`\/api\//g, "fetch(`http://localhost:5000/api/");

fs.writeFileSync(path, content);
console.log('Fixed API Origins for dashboard-company!');
