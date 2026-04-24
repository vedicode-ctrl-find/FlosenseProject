// js/assign-task.js
// ── TEAM LEAD ONLY ── Task Creation & Assignment
// Access restricted exclusively to employees who are a Team Lead on at least one project.

let employeesData = [];   // Members of the selected project
let leadProjects = [];    // Projects where current user is the Team Lead
let bestAlternative = null;
let currentUserId = null;
let companyId = null;

// ── Entry Point ──
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// ── Step 1: Authenticate & Verify Team Lead Role ──
async function checkAuth() {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('userRole');
    const name  = localStorage.getItem('userName');
    currentUserId = localStorage.getItem('userId');
    companyId     = localStorage.getItem('companyId');

    // Redirect if not logged in
    if (!token || !currentUserId) {
        window.location.href = 'auth/login.html';
        return;
    }

    // Update sidebar profile display
    document.getElementById('user-name-display').innerText = name || 'User';
    document.getElementById('user-role-display').innerText = 'Team Lead';

    // Only employees can be Team Leads — Company admins do NOT assign tasks
    if (role === 'company') {
        showAccessDenied('Company admins do not assign tasks. Please log in as the assigned Team Lead.');
        return;
    }

    // For regular employees, verify they are actually a Team Lead of some project
    showLoadingState('Verifying your Team Lead access...');

    try {
        const res  = await fetch(`/api/projects/lead/${currentUserId}`);
        const data = await res.json();

        if (!data.success || !data.data || data.data.length === 0) {
            // Not a team lead of any project
            showAccessDenied('Access denied. Only the assigned Team Lead of a project can create and assign tasks.');
            return;
        }

        leadProjects = data.data;
        hideLoadingState();
        populateProjectDropdown();
        setupEventListeners();

    } catch (err) {
        console.error('Auth check failed:', err);
        showAccessDenied('Unable to verify access. Please try again later.');
    }
}

// ── Step 2: Populate Projects Dropdown (only lead's projects) ──
function populateProjectDropdown() {
    const select = document.getElementById('task-project');
    select.innerHTML = '<option value="">-- Select Your Project --</option>';
    leadProjects.forEach(p => {
        select.innerHTML += `<option value="${p._id}">${p.name}</option>`;
    });
}

// ── Step 3: Load Team Members when Project is Selected ──
async function loadProjectMembers(projectId) {
    if (!projectId) {
        employeesData = [];
        resetEmployeeDropdown();
        return;
    }
    try {
        const res  = await fetch(`/api/projects/${projectId}/members`);
        const data = await res.json();
        if (data.success) {
            // Exclude the team lead themselves from being assigned tasks (optional — remove filter if leads can self-assign)
            employeesData = data.data.filter(emp => emp._id !== currentUserId);
            populateEmployeeDropdown();
            generateSmartSuggestions(); // re-run suggestions if skill/hours already set
        }
    } catch (err) {
        console.error('Error loading project members:', err);
    }
}

function resetEmployeeDropdown() {
    const select = document.getElementById('task-assignee');
    select.innerHTML = '<option value="">-- Select a project first --</option>';
    document.getElementById('smart-suggestions-list').innerHTML =
        '<p class="empty-state">Select a project to view available team members.</p>';
}

function populateEmployeeDropdown() {
    const select = document.getElementById('task-assignee');
    if (employeesData.length === 0) {
        select.innerHTML = '<option value="">No team members in this project</option>';
        return;
    }
    select.innerHTML = '<option value="">-- Select Employee --</option>';
    employeesData.forEach(emp => {
        select.innerHTML += `<option value="${emp._id}">${emp.name} — ${emp.role} (${emp.workload_percentage || 0}% workload)</option>`;
    });
}

// ── Event Bindings ──
function setupEventListeners() {
    const projectSelect  = document.getElementById('task-project');
    const assigneeSelect = document.getElementById('task-assignee');
    const skillSelect    = document.getElementById('task-skill');
    const hoursInput     = document.getElementById('task-hours');
    const form           = document.getElementById('task-form');

    projectSelect.addEventListener('change', e => {
        const projectId = e.target.value;
        loadProjectMembers(projectId);

        const deadlineInput = document.getElementById('task-deadline');
        const selectedProject = leadProjects.find(p => p._id === projectId);

        if (selectedProject) {
            if (selectedProject.created_at) {
                deadlineInput.min = selectedProject.created_at.split('T')[0];
            }
            if (selectedProject.deadline) {
                deadlineInput.max = selectedProject.deadline.split('T')[0];
            }
        } else {
            deadlineInput.removeAttribute('min');
            deadlineInput.removeAttribute('max');
        }
    });

    assigneeSelect.addEventListener('change', handleAssigneeSelect);
    skillSelect.addEventListener('change', generateSmartSuggestions);
    hoursInput.addEventListener('input', generateSmartSuggestions);

    form.addEventListener('submit', handleTaskSubmit);

    // Modal buttons
    document.getElementById('btn-keep-assign').addEventListener('click', forceSubmitTask);
    document.getElementById('btn-accept-suggestion').addEventListener('click', acceptSuggestionAndSubmit);
}

// ── Real-Time Workload Feedback ──
function handleAssigneeSelect(e) {
    const empId   = e.target.value;
    const alertBox = document.getElementById('smart-feedback-alert');
    const hours    = parseInt(document.getElementById('task-hours').value) || 0;
    const requiredSkill = document.getElementById('task-skill').value;

    if (!empId) {
        alertBox.className = 'feedback-alert hidden';
        return;
    }

    const emp = employeesData.find(e => e._id === empId);
    if (!emp) return;

    // Calculate Match Score for selected employee
    let skillScore = (emp.skills && emp.skills.includes(requiredSkill)) ? 40 : 0;
    const currentWL = emp.workload_percentage || 0;
    const projectedWL = currentWL + ((hours / 40) * 100);
    let capacityScore = projectedWL <= 80 ? 40 : (projectedWL <= 100 ? 20 : Math.max(0, 40 - (projectedWL - 100)));
    const efficiencyScore = (emp.efficiency || 100) / 5;
    const totalScore = Math.round(skillScore + capacityScore + efficiencyScore);

    alertBox.classList.remove('hidden', 'red', 'yellow', 'green');
    const textEl = alertBox.querySelector('.alert-text');

    let feedbackText = `<strong>Match Score: ${totalScore}%</strong> — `;

    if (projectedWL > 120) {
        alertBox.classList.add('red');
        feedbackText += `⚠ Severe Overload: ${Math.round(projectedWL)}% workload.`;
    } else if (projectedWL >= 100) {
        alertBox.classList.add('yellow');
        feedbackText += `High Load: ${Math.round(projectedWL)}% workload.`;
    } else {
        alertBox.classList.add('green');
        feedbackText += `Available: ${Math.round(projectedWL)}% workload.`;
    }

    if (requiredSkill && !emp.skills.includes(requiredSkill)) {
        feedbackText += ` <br><span style="font-size:11px;">Note: Missing required skill "${requiredSkill}"</span>`;
    }

    textEl.innerHTML = feedbackText;
}

// ── Smart Suggestions Panel ──
async function generateSmartSuggestions() {
    console.log('DEBUG: generateSmartSuggestions called');
    const requiredSkill = document.getElementById('task-skill').value;
    const hours         = parseInt(document.getElementById('task-hours').value) || 0;
    const projectId     = document.getElementById('task-project').value;
    const panel         = document.getElementById('smart-suggestions-list');

    console.log('DEBUG: Values:', { requiredSkill, hours, projectId });

    if (!projectId) {
        panel.innerHTML = '<p class="empty-state">Select a project first to see team member recommendations.</p>';
        return;
    }

    if (!requiredSkill || hours <= 0) {
        panel.innerHTML = '<p class="empty-state">Select a skill and enter estimated hours to see smart recommendations.</p>';
        bestAlternative = null;
        return;
    }

    panel.innerHTML = '<div class="loading-mini">AI is analyzing team bandwidth...</div>';

    try {
        const res = await fetch('/api/recommend/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                required_skills: [requiredSkill],
                estimated_hours: hours
            })
        });
        const data = await res.json();

        if (!data.success || !data.data || data.data.length === 0) {
            panel.innerHTML = '<p class="empty-state">No suitable recommendations found for this task.</p>';
            return;
        }

        const candidates = data.data;
        bestAlternative = candidates[0]; // For the overload modal logic
        panel.innerHTML = '';

        candidates.forEach((emp, index) => {
            const isBest = index === 0;
            const cls    = isBest ? 'suggestion-card high-match' : 'suggestion-card';

            panel.innerHTML += `
                <div class="${cls}">
                    <div class="sc-header">
                        <div class="sc-profile">
                            <span class="sc-name">${emp.name}</span>
                            <span class="sc-role">${emp.role}</span>
                        </div>
                        <div class="match-score-ring" style="--score: ${emp.matchScore}%">
                            <span class="score-val">${emp.matchScore}</span>
                            <span class="score-label">MATCH</span>
                        </div>
                    </div>
                    <div class="sc-analysis">
                        <i class="fas fa-robot" style="margin-right:6px; color:var(--primary-600);"></i> 
                        ${emp.analysis}
                    </div>
                    <div class="sc-actions">
                        <button type="button" class="btn-assign-smart" onclick="selectSuggestedEmployee('${emp.id}')">
                            ${isBest ? '✦ Best Match: Assign Now' : 'Assign Employee'}
                        </button>
                        ${isBest ? '<button type="button" class="btn-ignore" onclick="ignoreSuggestion(this)">Skip</button>' : ''}
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error('Failed to fetch recommendations:', err);
        panel.innerHTML = '<p class="empty-state">Error generating recommendations. Please try again.</p>';
    }
}

window.selectSuggestedEmployee = function(empId) {
    const select = document.getElementById('task-assignee');
    select.value = empId;
    handleAssigneeSelect({ target: { value: empId } });
    showToast('Smart suggestion applied.', 'success');
};

window.ignoreSuggestion = function(btnElement) {
    const card = btnElement.closest('.suggestion-card');
    card.style.opacity = '0.5';
    btnElement.disabled = true;
    btnElement.innerText = 'Ignored';
};

// ── Form Submission ──
function handleTaskSubmit(e) {
    e.preventDefault();

    const assigneeId = document.getElementById('task-assignee').value;
    const hours      = parseInt(document.getElementById('task-hours').value) || 0;

    if (!assigneeId) {
        showToast('Please select an employee to assign the task.', 'error');
        return;
    }

    const selectedEmp      = employeesData.find(e => e._id === assigneeId);
    if (!selectedEmp) return;

    const projectedWorkload = (selectedEmp.workload_percentage || 0) + ((hours / 40) * 100);

    // Overload check: show smart modal if above 120% and a better option exists
    if (projectedWorkload > 120 && bestAlternative && bestAlternative._id !== assigneeId) {
        showPostAssignModal(selectedEmp, bestAlternative, projectedWorkload);
        return;
    }

    submitTaskPayload(assigneeId);
}

function showPostAssignModal(selectedEmp, alternativeEmp, overloadedVal) {
    const modal    = document.getElementById('post-assign-modal');
    const body     = document.getElementById('post-assign-body');
    const taskName = document.getElementById('task-name').value;

    body.innerHTML = `
        <p><strong>${selectedEmp.name}</strong> will reach <strong>${Math.round(overloadedVal)}% workload</strong> if assigned this task.</p>
        <p style="margin-top:12px; color:#3b82f6;"><strong>✦ Smart Suggestion:</strong></p>
        <p>Re-assign "<strong>${taskName}</strong>" to <strong>${alternativeEmp.name}</strong> (${Math.round(alternativeEmp.workload_percentage || 0)}% workload). They have matching skills and better availability.</p>
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
    document.getElementById('task-assignee').value = bestAlternative._id;
    submitTaskPayload(bestAlternative._id);
}

// ── API Call: Create Task ──
async function submitTaskPayload(finalAssigneeId) {
    const payload = {
        name:            document.getElementById('task-name').value.trim(),
        description:     document.getElementById('task-desc').value.trim(),
        required_skills: [document.getElementById('task-skill').value].filter(Boolean),
        deadline:        document.getElementById('task-deadline').value,
        hours:           parseInt(document.getElementById('task-hours').value),
        priority:        document.getElementById('task-priority').value,
        assigned_to:     finalAssigneeId,
        project_id:      document.getElementById('task-project').value,
        company_id:      companyId,
        requested_by:    currentUserId   // ← Backend uses this to verify Team Lead identity
    };

    // Validate required fields
    if (!payload.name || !payload.deadline || !payload.hours || !payload.project_id || !payload.assigned_to) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }

    const submitBtn = document.getElementById('btn-submit-task');
    submitBtn.innerText = 'Assigning...';
    submitBtn.disabled = true;

    try {
        const res  = await fetch('/api/tasks', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            showToast('✓ Task assigned! Workload recalculated dynamically.', 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
        } else {
            // Handle 403 Access Denied from backend
            if (res.status === 403) {
                showToast('Access denied. Only the Team Lead can assign tasks.', 'error');
            } else {
                showToast(data.error || 'Failed to create task.', 'error');
            }
            submitBtn.innerText = 'Assign Task';
            submitBtn.disabled = false;
        }
    } catch (err) {
        showToast('Error connecting to server. Please try again.', 'error');
        submitBtn.innerText = 'Assign Task';
        submitBtn.disabled = false;
    }
}

// ── UI Utilities ──
function showLoadingState(message) {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh; gap:16px;">
            <div style="width:48px; height:48px; border:4px solid #e9d5ff; border-top-color:#8b5cf6; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            <p style="font-size:14px; color:var(--gray-600);">${message}</p>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
}

function hideLoadingState() {
    // Restore the original view-container content
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="assign-task-header">
            <h2>Create &amp; Assign Task</h2>
            <p>As Team Lead, you are authorized to create and assign tasks to your team members.</p>
        </div>

        <div class="assign-task-grid">
            <!-- Left: Task Creation Form -->
            <div class="card form-card">
                <form id="task-form">
                    <div class="form-group full-width">
                        <label>Task Name <span class="req">*</span></label>
                        <input type="text" id="task-name" class="styled-input" placeholder="Enter task name" required>
                    </div>

                    <div class="form-group full-width">
                        <label>Task Description</label>
                        <textarea id="task-desc" class="styled-input" placeholder="Describe the task briefly"></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Required Skill</label>
                            <select id="task-skill" class="styled-input">
                                <option value="">-- Select Skill --</option>
                                <option value="Frontend">Frontend</option>
                                <option value="Backend">Backend</option>
                                <option value="Testing">Testing</option>
                                <option value="Database">Database</option>
                                <option value="DevOps">DevOps</option>
                                <option value="UI/UX">UI/UX</option>
                                <option value="Python">Python</option>
                                <option value="Node.js">Node.js</option>
                                <option value="React">React</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Project <span class="req">*</span></label>
                            <select id="task-project" class="styled-input" required>
                                <option value="">-- Select Your Project --</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Deadline <span class="req">*</span></label>
                            <input type="date" id="task-deadline" class="styled-input" required>
                        </div>
                        <div class="form-group">
                            <label>Estimated Hours <span class="req">*</span></label>
                            <input type="number" id="task-hours" class="styled-input" placeholder="Effort in hours" min="1" required>
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label>Priority Level</label>
                        <select id="task-priority" class="styled-input">
                            <option value="Low">Low</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>

                    <div class="form-group full-width">
                        <label>Assign Employee <span class="req">*</span></label>
                        <select id="task-assignee" class="styled-input" required>
                            <option value="">-- Select a project first --</option>
                        </select>
                    </div>

                    <!-- Real-Time Smart Feedback -->
                    <div id="smart-feedback-alert" class="feedback-alert hidden">
                        <div class="alert-icon"></div>
                        <div class="alert-text"></div>
                    </div>

                    <!-- Team Lead Authority Badge -->
                    <div class="team-lead-badge">
                        <i class="fas fa-crown"></i>
                        <span>Team Lead Authority — Only you can assign tasks to your team</span>
                    </div>

                    <div class="action-bar">
                        <button type="button" class="btn btn-secondary" onclick="window.location.href='dashboard.html'">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-task">
                            <i class="fas fa-paper-plane"></i> Assign Task
                        </button>
                    </div>
                </form>
            </div>

            <!-- Right: Smart Suggestion Panel -->
            <div class="card insights-card">
                <div class="insights-header">
                    <h3><i class="fas fa-magic"></i> Recommended Assignments</h3>
                </div>
                <div id="smart-suggestions-list" class="suggestions-list">
                    <p class="empty-state">Select a project to see your team members and smart recommendations.</p>
                </div>
            </div>
        </div>
    `;

    // Re-populate the project dropdown with lead's projects
    populateProjectDropdown();
    setupEventListeners();
}

function showAccessDenied(message) {
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:65vh; gap:20px; text-align:center;">
            <div style="width:80px; height:80px; background:linear-gradient(135deg, #fee2e2, #fecaca); border-radius:50%; display:flex; align-items:center; justify-content:center;">
                <i class="fas fa-lock" style="font-size:32px; color:#dc2626;"></i>
            </div>
            <h2 style="font-size:22px; font-weight:700; color:var(--gray-900);">Access Restricted</h2>
            <p style="font-size:14px; color:var(--gray-600); max-width:380px; line-height:1.6;">${message}</p>
            <button class="btn btn-primary" onclick="window.location.href='dashboard.html'">
                <i class="fas fa-arrow-left"></i> Return to Dashboard
            </button>
        </div>
    `;
    // Remove modal and toast clutter
    const modal = document.getElementById('post-assign-modal');
    if (modal) modal.remove();
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast     = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function logout() {
    localStorage.clear();
    window.location.href = 'auth/login.html';
}
