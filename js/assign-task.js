// js/assign-task.js

let employeesData = [];
let companyId = localStorage.getItem('companyId');
let bestAlternative = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadProjects();
    loadEmployees();
    setupEventListeners();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'auth/login.html';
        return;
    }
    
    // Update sidebar profile
    const name = localStorage.getItem('userName') || 'User';
    const role = localStorage.getItem('userRole') || 'Employee';
    document.getElementById('user-name-display').innerText = name;
    document.getElementById('user-role-display').innerText = role.charAt(0).toUpperCase() + role.slice(1);
    
    if (role === 'employee') {
        alert("Access Denied: Only Team Leads/Admin can assign tasks.");
        window.location.href = 'dashboard.html';
    }
}

async function loadProjects() {
    try {
        const res = await fetch(`/api/projects/company/${companyId}`);
        const data = await res.json();
        
        const select = document.getElementById('task-project');
        if (data.success && data.data.length > 0) {
            select.innerHTML = '<option value="">-- Select Project --</option>';
            data.data.forEach(p => {
                select.innerHTML += `<option value="${p._id}">${p.name}</option>`;
            });
        } else {
            select.innerHTML = '<option value="">No Active Projects</option>';
        }
    } catch (err) {
        console.error("Error loading projects:", err);
    }
}

async function loadEmployees() {
    try {
        const res = await fetch(`/api/projects/employees/${companyId}`);
        const data = await res.json();
        if (data.success) {
            employeesData = data.data;
            populateEmployeeDropdown();
        }
    } catch (err) {
        console.error("Error loading employees:", err);
    }
}

function populateEmployeeDropdown() {
    const select = document.getElementById('task-assignee');
    select.innerHTML = '<option value="">-- Select Employee --</option>';
    
    employeesData.forEach(emp => {
        // e.g. "Rahul - Backend Developer (90% workload)"
        select.innerHTML += `<option value="${emp._id}">${emp.name} - ${emp.role} (${emp.workload_percentage || 0}% workload)</option>`;
    });
}

function setupEventListeners() {
    const assigneeSelect = document.getElementById('task-assignee');
    const skillSelect = document.getElementById('task-skill');
    const hoursInput = document.getElementById('task-hours');
    const form = document.getElementById('task-form');
    
    assigneeSelect.addEventListener('change', handleAssigneeSelect);
    skillSelect.addEventListener('change', generateSmartSuggestions);
    hoursInput.addEventListener('input', generateSmartSuggestions);
    
    form.addEventListener('submit', handleTaskSubmit);

    // Modal buttons
    document.getElementById('btn-keep-assign').addEventListener('click', forceSubmitTask);
    document.getElementById('btn-accept-suggestion').addEventListener('click', acceptSuggestionAndSubmit);
}

function handleAssigneeSelect(e) {
    const empId = e.target.value;
    const alertBox = document.getElementById('smart-feedback-alert');
    const hours = parseInt(document.getElementById('task-hours').value) || 0;
    
    if (!empId) {
        alertBox.className = "feedback-alert hidden";
        return;
    }
    
    const emp = employeesData.find(e => e._id === empId);
    if (!emp) return;
    
    // Projected workload logic: 40 hrs is 100% -> 1 hr is 2.5%
    const currentWorkload = emp.workload_percentage || 0;
    const projectedAdd = (hours / 40) * 100;
    const totalWorkload = currentWorkload + projectedAdd;
    
    alertBox.classList.remove('hidden', 'red', 'yellow', 'green');
    const textEl = alertBox.querySelector('.alert-text');
    
    if (totalWorkload > 120) {
        alertBox.classList.add('red');
        textEl.innerText = `This employee will reach ${Math.round(totalWorkload)}% workload. Assigning may cause severe delays.`;
    } else if (totalWorkload >= 80 && totalWorkload <= 120) {
        alertBox.classList.add('yellow');
        textEl.innerText = `This employee is moderately loaded (Projected: ${Math.round(totalWorkload)}%).`;
    } else {
        alertBox.classList.add('green');
        textEl.innerText = `Good choice - employee is available. (Projected: ${Math.round(totalWorkload)}%).`;
    }
}

function generateSmartSuggestions() {
    const requiredSkill = document.getElementById('task-skill').value;
    const hours = parseInt(document.getElementById('task-hours').value) || 0;
    const panel = document.getElementById('smart-suggestions-list');
    
    if (!requiredSkill || hours <= 0) {
        panel.innerHTML = '<p class="empty-state">Select a skill and enter estimated hours to see smart recommendations.</p>';
        bestAlternative = null;
        return;
    }
    
    // Filter by skill
    let candidates = employeesData.filter(emp => emp.skills.includes(requiredSkill));
    
    if (candidates.length === 0) {
        panel.innerHTML = `<p class="empty-state">No matching employees found with skill: ${requiredSkill}. Showing all available employees instead.</p>`;
        candidates = employeesData;
    }
    
    // Sort by projected workload ascending, and then by efficiency descending
    candidates.sort((a, b) => {
        const wa = a.workload_percentage || 0;
        const wb = b.workload_percentage || 0;
        if (wa !== wb) return wa - wb;
        return (b.efficiency || 100) - (a.efficiency || 100);
    });
    
    if (candidates.length === 0) return;
    
    bestAlternative = candidates[0]; // Save the top recommendation
    
    panel.innerHTML = '';
    
    candidates.slice(0, 3).forEach((emp, index) => {
        const isBest = index === 0;
        const cls = isBest ? "suggestion-card high-efficiency" : "suggestion-card";
        const wl = emp.workload_percentage || 0;
        
        panel.innerHTML += `
            <div class="${cls}">
                <div class="sc-header">
                    <span class="sc-name">${emp.name}</span>
                    <span class="sc-badge">${Math.round(wl)}% Workload</span>
                </div>
                <div class="sc-info">
                    ${emp.role} • ${(emp.efficiency || 100)}% Efficiency
                </div>
                <div class="sc-actions">
                    <button type="button" class="btn-outline assign-btn" onclick="selectSuggestedEmployee('${emp._id}')">
                        ${isBest ? '✦ Assign Instead' : 'Assign'}
                    </button>
                    ${isBest ? '<button type="button" class="btn-outline" onclick="ignoreSuggestion(this)">Ignore</button>' : ''}
                </div>
            </div>
        `;
    });
}

window.selectSuggestedEmployee = function(empId) {
    const select = document.getElementById('task-assignee');
    select.value = empId;
    handleAssigneeSelect({target: {value: empId}});
    showToast("Smart suggestion applied.");
}

window.ignoreSuggestion = function(btnElement) {
    const card = btnElement.closest('.suggestion-card');
    card.style.opacity = '0.5';
    btnElement.disabled = true;
    btnElement.innerText = 'Ignored';
}

function handleTaskSubmit(e) {
    e.preventDefault();
    
    const assigneeId = document.getElementById('task-assignee').value;
    const hours = parseInt(document.getElementById('task-hours').value) || 0;
    
    const selectedEmp = employeesData.find(e => e._id === assigneeId);
    if (!selectedEmp) return;
    
    const projectedWorkload = (selectedEmp.workload_percentage || 0) + ((hours / 40) * 100);
    
    // Overload Check Logic
    if (projectedWorkload > 120 && bestAlternative && bestAlternative._id !== assigneeId) {
        // Trigger Smart Popup
        showPostAssignModal(selectedEmp, bestAlternative, projectedWorkload);
        return; // Halt form submission
    }
    
    // Valid/Accepted
    submitTaskPayload(assigneeId);
}

function showPostAssignModal(selectedEmp, alternativeEmp, overloadedVal) {
    const modal = document.getElementById('post-assign-modal');
    const body = document.getElementById('post-assign-body');
    const taskName = document.getElementById('task-name').value;
    
    body.innerHTML = `
        <p><strong>${selectedEmp.name}</strong> will reach <strong>${Math.round(overloadedVal)}% workload</strong> if assigned this task.</p>
        <p style="margin-top:12px; color:#3b82f6;"><strong>✦ Smart Suggestion:</strong></p>
        <p>Re-assign "${taskName}" to <strong>${alternativeEmp.name}</strong> (${Math.round(alternativeEmp.workload_percentage || 0)}% workload). They have matching skills and better availability.</p>
    `;
    
    modal.style.display = 'flex';
}

function forceSubmitTask() {
    const assigneeId = document.getElementById('task-assignee').value;
    document.getElementById('post-assign-modal').style.display = 'none';
    submitTaskPayload(assigneeId);
}

function acceptSuggestionAndSubmit() {
    if (!bestAlternative) return;
    document.getElementById('post-assign-modal').style.display = 'none';
    
    // Update UI select
    document.getElementById('task-assignee').value = bestAlternative._id;
    submitTaskPayload(bestAlternative._id);
}

async function submitTaskPayload(finalAssigneeId) {
    const payload = {
        name: document.getElementById('task-name').value,
        description: document.getElementById('task-desc').value,
        required_skills: [document.getElementById('task-skill').value].filter(Boolean),
        deadline: document.getElementById('task-deadline').value,
        hours: parseInt(document.getElementById('task-hours').value),
        assigned_to: finalAssigneeId,
        project_id: document.getElementById('task-project').value,
        company_id: companyId
    };

    const submitBtn = document.getElementById('btn-submit-task');
    submitBtn.innerText = "Assigning...";
    submitBtn.disabled = true;

    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast("Task Assigned! Workload recalculated dynamically.", "success");
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } else {
            showToast(data.error || "Failed to create task", "error");
            submitBtn.innerText = "Assign Task";
            submitBtn.disabled = false;
        }
    } catch (err) {
        showToast("Error connecting to server", "error");
        submitBtn.innerText = "Assign Task";
        submitBtn.disabled = false;
    }
}

function showToast(msg, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> <span>${msg}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
