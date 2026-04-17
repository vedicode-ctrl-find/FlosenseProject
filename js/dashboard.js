// ── Application State ──
// NOTE: employees/projects are intentionally empty — all data comes from the real API.
// DO NOT add mock data here; it causes cross-company data leakage.
let FlowSenseState = {
    employees: [],   // DEPRECATED — use liveData.employees
    projects:  [],   // DEPRECATED — use liveData.projects
    tasks:     [],   // Live tasks (fetched per view)
    currentView:  'overview',
    searchQuery:  ''
};

// ── Live DB Data Store (populated from API) ──
let liveData = {
    employees: [],   // Real employees from MongoDB
    projects:  [],   // Real projects from MongoDB
    loaded:    false // Whether API data has been fetched
};

// Helper: get companyId from localStorage (set on login)
function getCompanyId() {
    return localStorage.getItem('companyId') || '';
}

// ── Fetch real employees — secure token-authenticated endpoint ──
// Server derives the company from the JWT; frontend cannot manipulate it.
async function fetchLiveEmployees() {
    const token = localStorage.getItem('token');
    if (!token) return [];
    try {
        const res  = await fetch('/api/team-members', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            liveData.employees = data.data;
            return data.data;
        }
        console.error('Team members fetch failed:', data.error);
    } catch (err) {
        console.error('Failed to fetch team members:', err);
    }
    return [];
}

// ── Fetch all real projects for this company ──
async function fetchLiveProjects() {
    const companyId = getCompanyId();
    if (!companyId) return [];
    try {
        const res  = await fetch(`/api/projects/company/${companyId}`);
        const data = await res.json();
        if (data.success) {
            liveData.projects = data.data;
            return data.data;
        }
    } catch (err) {
        console.error('Failed to fetch live projects:', err);
    }
    return [];
}

// ── Authentication Check ──
function checkAuth() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('userName');

    if (!token) {
        window.location.href = 'auth/login.html';
        return;
    }

    document.getElementById('user-name-display').innerText = name || 'User';
    document.getElementById('user-role-display').innerText = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Team Member';
    
    if (role === 'employee') {
        document.getElementById('btn-quick-action').style.display = 'none';
        renderEmployeeSidebar();
    } else {
        renderCompanySidebar();
    }

    // Attach Search Listener
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            FlowSenseState.searchQuery = e.target.value.toLowerCase();
            renderCurrentView();
        });
    }

    renderCurrentView();
}

function renderCompanySidebar() {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = `
        <a href="#" class="nav-item active" data-view="overview" onclick="loadView('overview')">
            <i class="fas fa-th-large"></i>
            <span>Dashboard</span>
        </a>
        <a href="#" class="nav-item" data-view="projects" onclick="loadView('projects')">
            <i class="fas fa-project-diagram"></i>
            <span>Projects</span>
        </a>
        <a href="#" class="nav-item" data-view="team" onclick="loadView('team')">
            <i class="fas fa-users"></i>
            <span>Team Hub</span>
        </a>
        <a href="#" class="nav-item" data-view="performance" onclick="loadView('performance')">
            <i class="fas fa-chart-line"></i>
            <span>Insights</span>
        </a>
    `;
}

function renderEmployeeSidebar() {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = `
        <a href="#" class="nav-item active" data-view="overview" onclick="loadView('overview')">
            <i class="fas fa-th-large"></i>
            <span>Dashboard</span>
        </a>
        <a href="#" class="nav-item" data-view="projects" onclick="loadView('projects')">
            <i class="fas fa-project-diagram"></i>
            <span>My Projects</span>
        </a>
        <a href="#" class="nav-item" data-view="performance" onclick="loadView('performance')">
            <i class="fas fa-briefcase"></i>
            <span>Workload</span>
        </a>
        <a href="#" class="nav-item" data-view="team" onclick="loadView('team')">
            <i class="fas fa-users"></i>
            <span>Team Hub</span>
        </a>
    `;
}

// ── View Management ──
function loadView(view) {
    FlowSenseState.currentView = view;
    renderCurrentView();
}

function renderCurrentView() {
    const container = document.getElementById('view-container');
    const view = FlowSenseState.currentView;
    const role = localStorage.getItem('userRole');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    if (view === 'overview') {
        role === 'employee' ? renderEmployeeOverview(container) : renderLeadOverview(container);
    } else if (view === 'organization') {
        renderOrgView(container);
    } else if (view === 'projects') {
        role === 'employee' ? renderEmployeeProjectsView(container) : renderProjectsView(container);
    } else if (view === 'team') {
        renderTeamView(container);
    } else if (view === 'tasks') {
        role === 'employee' ? renderEmployeeTasksView(container) : renderTasksView(container);
    } else if (view === 'performance') {
        role === 'employee' ? renderEmployeePerformanceView(container) : renderPerformanceView(container);
    }
}

// ── Workload Calculation Logic ──
function recalculateState() {
    // Reset workloads
    FlowSenseState.employees.forEach(emp => emp.workload = 0);
    
    // Sum hours (Mock formula: workload % = total hours * 2)
    FlowSenseState.tasks.forEach(task => {
        const emp = FlowSenseState.employees.find(e => e.id === task.assigneeId);
        if (emp) emp.workload += task.hours * 2.5; 
    });

    // Update statuses
    FlowSenseState.employees.forEach(emp => {
        if (emp.workload > 120) emp.status = 'Overloaded';
        else if (emp.workload < 80) emp.status = 'Underutilized';
        else emp.status = 'Balanced';
    });

    renderCurrentView();
}

// ── Functionalities ──

// 1. Create Project
function openProjectModal() {
    // Instead of a simple modal, we redirect to our high-fidelity flow
    window.location.href = 'create-project.html';
}

function handleProjectSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('p-name').value;
    const lead = document.getElementById('p-lead').value;
    const desc = document.getElementById('p-desc').value;

    FlowSenseState.projects.push({
        id: 'prj' + Date.now(),
        name,
        description: desc,
        lead,
        progress: 0,
        status: 'On Track'
    });

    document.getElementById('project-modal').remove();
    showToast(`Project "${name}" created successfully!`, 'success');
    renderCurrentView();
}

// 2. Task Assignment
function handleTaskAssignment(e) {
    e.preventDefault();
    const title = document.getElementById('t-name').value;
    const project = document.getElementById('t-project').value;
    const assigneeId = document.getElementById('t-assignee').value;
    const hours = parseInt(document.getElementById('t-hours').value);

    // Smart Alert check
    const emp = FlowSenseState.employees.find(e => e.id === assigneeId);
    if (emp && emp.workload + (hours * 2.5) > 130) {
        if (!confirm(`${emp.name} is already near capacity. Assigning this will cause severe overload. Proceed anyway?`)) {
            return;
        }
    }

    FlowSenseState.tasks.push({
        id: 'tsk' + Date.now(),
        title,
        projectName: project,
        assigneeId,
        deadline: '7 Days Left',
        status: 'On-Track',
        hours
    });

    showToast('Task assigned and workload updated.', 'success');
    recalculateState();
}

// 3. Search / Filter Implementation
// ONLY uses real DB data. Never falls back to mock.
function getFilteredData(type) {
    const q = FlowSenseState.searchQuery;

    if (type === 'employees') {
        // Always use live DB data — if empty, return empty (no mock fallback)
        const source = liveData.employees;
        if (!q) return source;
        return source.filter(e => {
            const name   = (e.name   || '').toLowerCase();
            const role   = (e.role   || '').toLowerCase();
            const skills = (e.skills || []).map(s => s.toLowerCase());
            return name.includes(q) || role.includes(q) || skills.some(s => s.includes(q));
        });
    }

    if (type === 'projects') {
        // Always use live DB data
        const source = liveData.projects;
        if (!q) return source;
        return source.filter(p =>
            (p.name || '').toLowerCase().includes(q)
        );
    }

    return [];
}

// ── Renderers ──

async function renderLeadOverview(container) {
    // Show skeleton while loading
    container.innerHTML = `
        <div class="welcome-header">
            <h2>Organization Health</h2>
            <p>Intelligence platform analyzing team capacity and delivery risk.</p>
        </div>
        <div class="stats-grid">
            ${[1,2,3,4].map(() => `
                <div class="stat-card" style="opacity:0.5;">
                    <div class="stat-icon violet"><i class="fas fa-spinner fa-spin"></i></div>
                    <div><div class="stat-value">—</div><div class="stat-label">Loading...</div></div>
                </div>
            `).join('')}
        </div>`;

    // Fetch real data in parallel
    const [employees, projects] = await Promise.all([fetchLiveEmployees(), fetchLiveProjects()]);

    const overloaded     = employees.filter(e => (e.workload_percentage || 0) > 100);
    const empCount       = employees.length;
    const projCount      = projects.length;

    // Build workload distribution from live employees
    const workloadItems = employees.length > 0
        ? employees.map(e => {
            const wl     = e.workload_percentage || 0;
            const status = wl > 100 ? 'overloaded' : wl >= 80 ? 'balanced' : 'underutilized';
            return renderWorkloadItem(e.name, wl, status);
          }).join('')
        : '<p style="font-size:13px;color:var(--gray-600);text-align:center;padding:20px 0;">No employees registered yet.</p>';

    // Smart suggestions from live data
    const overloadedEmp    = employees.find(e => (e.workload_percentage || 0) > 100);
    const underutilizedEmp = employees.find(e => (e.workload_percentage || 0) < 60);
    const suggestionHTML = (overloadedEmp && underutilizedEmp)
        ? `<div class="suggestion-card">
                <h4><i class="fas fa-bolt"></i> Rebalance Alert</h4>
                <p><strong>${overloadedEmp.name}</strong> is at <strong>${Math.round(overloadedEmp.workload_percentage)}%</strong> capacity.
                   Suggested: Move a task to <strong>${underutilizedEmp.name}</strong> (${Math.round(underutilizedEmp.workload_percentage || 0)}% workload).</p>
           </div>`
        : `<p style="font-size:13px; color:var(--gray-600); text-align:center; margin-top:20px;">Team is balanced. No optimization needed.</p>`;

    container.innerHTML = `
        <div class="welcome-header">
            <h2>Organization Health</h2>
            <p>Intelligence platform analyzing team capacity and delivery risk.</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon violet"><i class="fas fa-project-diagram"></i></div>
                <div>
                    <div class="stat-value">${projCount}</div>
                    <div class="stat-label">Active Projects</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue"><i class="fas fa-users"></i></div>
                <div>
                    <div class="stat-value">${empCount}</div>
                    <div class="stat-label">Team Members</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green"><i class="fas fa-tasks"></i></div>
                <div>
                    <div class="stat-value">${FlowSenseState.tasks.length}</div>
                    <div class="stat-label">Live Tasks</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon amber"><i class="fas fa-exclamation-triangle"></i></div>
                <div>
                    <div class="stat-value">${overloaded.length}</div>
                    <div class="stat-label">Overload Alerts</div>
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header">
                    <h3>Workload Distribution</h3>
                </div>
                <div class="workload-list">${workloadItems}</div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>Optimizer Engine</h3>
                </div>
                <div id="simple-suggestion-list">${suggestionHTML}</div>
            </div>
        </div>
    `;
}

function renderRealSuggestions() {
    const overloaded = FlowSenseState.employees.find(e => e.workload > 120);
    const underutilized = FlowSenseState.employees.find(e => e.workload < 70);

    if (overloaded && underutilized) {
        return `
            <div class="suggestion-card">
                <h4><i class="fas fa-bolt"></i> Rebalance Alert</h4>
                <p><strong>${overloaded.name}</strong> is at ${Math.round(overloaded.name === 'Rahul Gupta' ? 135 : overloaded.workload)}% capacity. Suggested: Move one task to <strong>${underutilized.name}</strong> (${Math.round(underutilized.workload)}%).</p>
                <div class="suggestion-actions">
                    <button class="btn btn-primary btn-xs" onclick="acceptSuggestion('${overloaded.id}', '${underutilized.id}')">Optimize Now</button>
                </div>
            </div>
        `;
    }
    return `<p style="font-size:13px; color:var(--gray-600); text-align:center; margin-top:20px;">Team is perfectly balanced. No optimization needed.</p>`;
}

function acceptSuggestion(fromId, toId) {
    const task = FlowSenseState.tasks.find(t => t.assigneeId === fromId);
    if (task) {
        task.assigneeId = toId;
        showToast('Workload rebalanced. Task reassigned.', 'success');
        recalculateState();
    }
}

function renderProjectsView(container) {
    const filteredProjects = getFilteredData('projects');
    container.innerHTML = `
        <div class="welcome-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h2>Active Projects</h2>
                <p>Tracking progress across ${filteredProjects.length} projects.</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="openProjectModal()">
                <i class="fas fa-plus"></i> Create Project
            </button>
        </div>

        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
            ${filteredProjects.map(p => `
                <div class="card" style="cursor:pointer;" onclick="openProjectDetails('${p.id}')">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <span class="badge" style="background:${p.status === 'On Track' ? '#dcfce7' : '#fee2e2'}; color:${p.status === 'On Track' ? '#166534' : '#991b1b'}; font-size:11px; padding:4px 10px; border-radius:20px;">${p.status}</span>
                    </div>
                    <h3 style="margin-bottom:8px;">${p.name}</h3>
                    <p style="font-size:13px; color:var(--gray-600); margin-bottom:20px;">${p.description}</p>
                    <div style="display:flex; align-items:center; gap:10px; border-top:1px solid #f3f4f6; padding-top:15px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.lead)}&background=random" style="width:32px; height:32px; border-radius:50%;">
                        <div style="flex:1;">
                            <p style="font-size:12px; font-weight:600;">${p.lead}</p>
                            <p style="font-size:11px; color:var(--gray-600);">Lead</p>
                        </div>
                        <div style="text-align:right;">
                            <p style="font-size:12px; font-weight:600;">${p.progress}%</p>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function renderTeamView(container) {
    const role = localStorage.getItem('userRole');

    // Show loading skeleton
    container.innerHTML = `
        <div class="welcome-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h2>Team Hub</h2>
                <p>Loading members...</p>
            </div>
        </div>
        <div class="team-grid">
            ${[1,2,3].map(() => `
                <div class="team-card" style="opacity:0.4; pointer-events:none;">
                    <div class="team-card-header">
                        <div class="team-card-avatar-wrapper">
                            <div style="width:48px;height:48px;border-radius:50%;background:#e9d5ff;"></div>
                        </div>
                        <div class="team-card-meta">
                            <div style="height:14px;width:120px;background:#e9d5ff;border-radius:4px;margin-bottom:8px;"></div>
                            <div style="height:11px;width:80px;background:#f3e8ff;border-radius:4px;"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>`;

    // Fetch real employees
    const employees = await fetchLiveEmployees();
    liveData.employees = employees;
    const filtered = getFilteredData('employees');

    const companyName = localStorage.getItem('userName') || 'Your Company';

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="welcome-header">
                <h2>Team Hub</h2>
                <p>${FlowSenseState.searchQuery ? 'No members match your search.' : 'No employees have joined yet. Share your company code to get started.'}</p>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;gap:16px;">
                <div style="width:72px;height:72px;background:linear-gradient(135deg,#ede9fe,#ddd6fe);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-user-plus" style="font-size:28px;color:#8b5cf6;"></i>
                </div>
                <p style="font-size:14px;color:var(--gray-600);text-align:center;max-width:320px;">Employees can join by signing up with your company code. Once they register, they'll appear here automatically.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="welcome-header" style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <h2>Team Hub</h2>
                <p>Managing <strong>${filtered.length}</strong> registered member${filtered.length !== 1 ? 's' : ''} in <strong>${companyName}</strong>.</p>
            </div>
            <div style="display:flex;align-items:center;gap:8px;background:#f5f3ff;border:1px solid #ddd6fe;padding:6px 14px;border-radius:20px;font-size:13px;color:#7c3aed;font-weight:600;">
                <i class="fas fa-users"></i> ${filtered.length} Total Members
            </div>
        </div>
        <div class="team-grid">
            ${filtered.map(e => renderTeamCard(e)).join('')}
        </div>
    `;
}

function renderTasksView(container) {
    container.innerHTML = `
        <div class="welcome-header">
            <h2>Task Optimizer</h2>
            <p>Smart task allocation engine.</p>
        </div>

        <div class="dashboard-grid" style="grid-template-columns: 350px 1fr;">
            <div class="card">
                <h3 style="margin-bottom:20px;">New Assignment</h3>
                <form onsubmit="handleTaskAssignment(event)">
                    <div class="form-group">
                        <label>Task Name</label>
                        <input type="text" id="t-name" class="styled-input" placeholder="e.g. Design System" required style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:15px;">
                    </div>
                    <div class="form-group">
                        <label>Hours Required</label>
                        <input type="number" id="t-hours" class="styled-input" value="10" required style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:15px;">
                    </div>
                    <div class="form-group">
                        <label>Project</label>
                        <select id="t-project" class="styled-input" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:15px;">
                            ${FlowSenseState.projects.map(p => `<option>${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Assignee</label>
                        <select id="t-assignee" class="styled-input" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:15px;" onchange="checkTaskOverload(this.value)">
                            ${FlowSenseState.employees.map(e => `<option value="${e.id}">${e.name} (${Math.round(e.workload)}%)</option>`).join('')}
                        </select>
                    </div>
                    <div id="smart-alert-container"></div>
                    <button class="btn btn-primary" style="margin-top:10px;">Assign Task</button>
                </form>
            </div>

            <div class="card" style="padding:0;">
                <div style="padding:20px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">Pending Tasks</h3>
                </div>
                <div style="padding:10px 20px;">
                    ${FlowSenseState.tasks.map(t => {
                        const emp = FlowSenseState.employees.find(e => e.id === t.assigneeId);
                        return renderTaskItem(t.title, t.projectName, emp ? emp.name : 'Unknown', t.deadline, t.status);
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

// ── Shared UI Renderers ──

function renderTeamCard(e) {
    // Support both DB shape (_id, workload_percentage) and mock shape (id, workload)
    const workload    = e.workload_percentage !== undefined ? e.workload_percentage : (e.workload || 0);
    const empId       = e._id || e.id || '';
    const empIdLabel  = e.employee_id || '';

    const statusColor = workload > 100 ? '#ef4444' : (workload < 70 ? '#3b82f6' : '#10b981');
    const statusLabel = workload > 100 ? 'Overloaded' : (workload < 70 ? 'Available' : 'Balanced');
    const statusType  = workload > 100 ? 'busy' : 'online';

    const skills      = e.skills || [];
    const skillTags   = skills.length > 0
        ? skills.map(s => `<span class="team-skill-tag">${s}</span>`).join('')
        : '<span style="color:var(--gray-400);font-size:12px;">No skills listed</span>';

    // For DB employees we don\'t have project-task mapping live yet — show employee_id badge instead
    const metaBadge   = empIdLabel
        ? `<span class="team-project-badge" style="background:#f0fdf4;color:#166534;border-color:#bbf7d0;">${empIdLabel}</span>`
        : '<span style="color:var(--gray-400);font-size:12px;">ID not assigned</span>';

    const efficiency  = e.efficiency !== undefined ? e.efficiency : 100;

    // Avatar color based on role
    const avatarBg    = workload > 100 ? 'ef4444' : workload < 70 ? '3b82f6' : '8b5cf6';

    return `
        <div class="team-card">
            <div class="team-card-header">
                <div class="team-card-avatar-wrapper">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(e.name)}&background=${avatarBg}&color=fff" class="team-card-avatar" alt="${e.name}">
                    <div class="status-indicator ${statusType}"></div>
                </div>
                <div class="team-card-meta">
                    <h3>${e.name}</h3>
                    <span class="team-card-role">${e.role}</span>
                </div>
            </div>

            <div class="team-card-section">
                <span class="team-card-label">Core Skills</span>
                <div class="team-skill-tags">${skillTags}</div>
            </div>

            <div class="team-card-section">
                <span class="team-card-label">Employee ID</span>
                <div class="team-project-badges">${metaBadge}</div>
            </div>

            <div class="team-card-footer">
                <div class="workload-visual">
                    <div class="workload-meta">
                        <span>Workload</span>
                        <span class="workload-status-text" style="color:${statusColor}">${Math.round(workload)}% — ${statusLabel}</span>
                    </div>
                    <div class="workload-bar-bg">
                        <div class="workload-bar-fill" style="width:${Math.min(workload, 100)}%; background:${statusColor}"></div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9;">
                    <span style="font-size:11px;color:var(--gray-600);">Efficiency</span>
                    <span style="font-size:12px;font-weight:700;color:#8b5cf6;">${efficiency}%</span>
                </div>
            </div>
        </div>
    `;
}

function renderWorkloadItem(name, percent, status) {
    const color = status === 'overloaded' ? '#ef4444' : (status === 'balanced' ? '#10b981' : '#3b82f6');
    return `
        <div class="workload-item">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random" style="width:32px; height:32px; border-radius:50%;" alt="">
            <div class="workload-info">
                <div class="workload-name"><span>${name}</span><span class="workload-percent" style="color:${color}">${Math.round(percent)}%</span></div>
                <div class="progress-bg"><div class="progress-fill ${status}" style="width: ${Math.min(percent, 100)}%"></div></div>
            </div>
        </div>
    `;
}

function renderTaskItem(title, project, assignee, deadline, status) {
    return `<div style="display:flex; align-items:center; padding:15px 0; border-bottom:1px solid #f8fafc; cursor:pointer;" onclick="openTaskDetails('${title}')">
        <div style="flex:1;"><h4 style="margin-bottom:4px;">${title}</h4><p style="font-size:12px; color:var(--gray-600);">${project} • ${assignee}</p></div>
        <div style="text-align:right;"><p style="font-size:12px; font-weight:600; color:${status === 'High-Risk' ? '#ef4444' : '#10b981'}">${deadline}</p></div>
    </div>`;
}

function showToast(message, type = 'success') {
    // Custom toast logic (simple alert for now or implement a visual one)
    console.log(`[${type.toUpperCase()}] ${message}`);
    const toast = document.createElement('div');
    toast.style = `position:fixed; bottom:24px; right:24px; background:${type==='success'?'#10b981':'#ef4444'}; color:white; padding:12px 24px; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.1); z-index:9999; animation: slideUp 0.3s ease;`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ── Boilerplate for details & views (simplified) ──
function renderOrgView(container) { container.innerHTML = '<h2>Org Settings</h2><p>Mock Code: FS-2026</p>'; }
function openTaskDetails(name) { alert(`Thread for: ${name}\nSystem: No active messages.`); }
// Temporary integration for Assign Task / Manage Team mock URLs.
window.openTeamSetup = function(projectId) {
    // We would pass the project id to the external page via localStorage or query param
    localStorage.setItem('currentSetupProject', projectId);
    window.location.href = 'team-setup.html';
}
window.openAssignTask = function(projectId) {
    localStorage.setItem('currentAssignProject', projectId);
    window.location.href = 'assign-task.html';
}

function openProjectDetails(projectId) {
    const p = FlowSenseState.projects.find(proj => proj.id === projectId);
    if(!p) return;
    FlowSenseState.currentView = 'project_details';
    const container = document.getElementById('view-container');
    const role = localStorage.getItem('userRole'); 
    const userName = localStorage.getItem('userName');
    
    // Check if the current user is the "Team Lead" for this project
    // (mock check: if the project's lead name contains their user name)
    const isLead = (role === 'employee' || role === 'company') && (p.lead === userName || p.lead.includes("Sharma")); // fallback to Anita for demo

    let tabsContent = '';
    
    if (role === 'company') {
        tabsContent = `
            <div class="project-details-section">
                <h3>High-Level Overview</h3>
                <p>Status: ${p.status}</p>
                <p>Progress: ${p.progress}%</p>
                <button class="btn btn-secondary" onclick="loadView('projects')">Back to Projects</button>
            </div>
        `;
    } else if (isLead) {
        tabsContent = `
            <div class="project-details-tabs" style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary" onclick="alert('Overview view placeholder')">Overview</button>
                <button class="btn btn-secondary" onclick="window.openTeamSetup('${p.id}')">Manage Team</button>
                <button class="btn btn-secondary" onclick="window.openAssignTask('${p.id}')">Assign Tasks</button>
            </div>
            <div class="project-details-section" style="margin-top:20px;">
                <button class="btn btn-secondary btn-sm" onclick="loadView('projects')">Back to Projects</button>
            </div>
        `;
    } else {
        // Standard Employee
        tabsContent = `
            <div class="project-details-tabs" style="margin-top:20px; display:flex; gap:10px;">
                <button class="btn btn-primary">My Tasks</button>
                <button class="btn btn-secondary" onclick="alert('Opening chat component...')">Chat / Requests</button>
            </div>
            <div class="project-details-section" style="margin-top:20px;">
                <button class="btn btn-secondary btn-sm" onclick="loadView('projects')">Back to Projects</button>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="welcome-header">
            <h2>${p.name}</h2>
            <p>${p.description}</p>
            <p style="font-size:12px; color:var(--primary-violet); margin-top:5px;"><i class="fas fa-crown"></i> Lead: ${p.lead}</p>
        </div>
        ${tabsContent}
    `;
}

function renderPerformanceView(container) { container.innerHTML = '<h2>Performance</h2><p>Analytics loading...</p>'; }

function logout() { localStorage.clear(); window.location.href = 'auth/login.html'; }

// Start
document.addEventListener('DOMContentLoaded', checkAuth);


function renderEmployeeOverview(container) {
    const name = localStorage.getItem("userName") || "Employee";
    const empId = (name.includes("Rahul")) ? "emp1" : "emp2";
    const myTasks = FlowSenseState.tasks.filter(t => t.assigneeId === empId);
    const myWorkload = Math.round(myTasks.reduce((acc, current) => acc + (current.hours * 2.5), 0));

    container.innerHTML = `
        <div class="welcome-header">
            <h2>Dashboard</h2>
            <p>Welcome back, ${name}. You are currently at ${myWorkload}% workload capacity.</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon violet"><i class="fas fa-clipboard-check"></i></div>
                <div>
                    <div class="stat-value">${myTasks.length}</div>
                    <div class="stat-label">Assigned Tasks</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green"><i class="fas fa-clock"></i></div>
                <div>
                    <div class="stat-value">${myWorkload}%</div>
                    <div class="stat-label">Current Workload</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue"><i class="fas fa-brain"></i></div>
                <div>
                    <div class="stat-value">94</div>
                    <div class="stat-label">Efficiency Score</div>
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header">
                    <h3>Upcoming Deadlines</h3>
                </div>
                <div>
                    ${myTasks.length > 0 ? myTasks.map(t => renderTaskItem(t.title, t.projectName, name, t.deadline, t.status)).join("") : "<p>No pending tasks.</p>"}
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>Project Participation</h3>
                </div>
                <div class="workload-list">
                    ${FlowSenseState.projects.filter(p => myTasks.some(t => t.projectName === p.name)).map(p => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f8fafc;">
                            <div>
                                <p style="font-weight:600; font-size:14px;">${p.name}</p>
                                <p style="font-size:12px; color:var(--gray-600);">${p.lead} (Lead)</p>
                            </div>
                            <span class="badge" style="background:#f3f4f6; color:var(--gray-600); font-size:11px; padding:4px 8px; border-radius:10px;">${p.status}</span>
                        </div>
                    `).join("") || "<p style=\"font-size:13px; color:var(--gray-600);\">No active projects.</p>"}
                </div>
            </div>
        </div>
    `;
}

function renderEmployeeProjectsView(container) {
    const name = localStorage.getItem("userName") || "Employee";
    const empId = (name.includes("Rahul")) ? "emp1" : "emp2";
    const myTasks = FlowSenseState.tasks.filter(t => t.assigneeId === empId);
    const myProjects = FlowSenseState.projects.filter(p => myTasks.some(t => t.projectName === p.name));

    container.innerHTML = `
        <div class="welcome-header">
            <h2>My Projects</h2>
            <p>You are contributing to ${myProjects.length} active projects.</p>
        </div>
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
            ${myProjects.map(p => `
                <div class="card" style="cursor:pointer;" onclick="openProjectDetails('${p.id}')">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <span class="badge" style="background:#dcfce7; color:#166534; font-size:11px; padding:4px 10px; border-radius:20px;">Participating</span>
                    </div>
                    <h3 style="margin-bottom:8px;">${p.name}</h3>
                    <p style="font-size:13px; color:var(--gray-600); margin-bottom:20px;">${p.description}</p>
                    <div style="display:flex; align-items:center; gap:10px; border-top:1px solid #f3f4f6; padding-top:15px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.lead)}&background=8b5cf6&color=fff" style="width:32px; height:32px; border-radius:50%;">
                        <div style="flex:1;">
                            <p style="font-size:12px; font-weight:600;">${p.lead}</p>
                            <p style="font-size:11px; color:var(--gray-600);">Project Lead</p>
                        </div>
                        <button class="btn btn-outline btn-xs" onclick="alert(\"Sending contact request to ${p.lead}\")">Contact Lead</button>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function renderEmployeeTasksView(container) {
    const name = localStorage.getItem("userName") || "Employee";
    const empId = (name.includes("Rahul")) ? "emp1" : "emp2";
    const myTasks = FlowSenseState.tasks.filter(t => t.assigneeId === empId);

    container.innerHTML = `
        <div class="welcome-header">
            <h2>My Work Board</h2>
            <p>Total of ${myTasks.length} tasks assigned to you.</p>
        </div>
        <div class="card" style="padding:0;">
             <table style="width:100%; border-collapse: collapse;">
                <thead style="background:#f8fafc; border-bottom:1px solid #f1f5f9;">
                    <tr style="text-align:left; font-size:12px; color:var(--gray-600); text-transform:uppercase; letter-spacing:0.5px;">
                        <th style="padding:16px 24px;">Task Name</th>
                        <th style="padding:16px 24px;">Project</th>
                        <th style="padding:16px 24px;">Est. Hours</th>
                        <th style="padding:16px 24px;">Deadline</th>
                        <th style="padding:16px 24px;">Actions</th>
                    </tr>
                </thead>
                <tbody style="font-size:14px;">
                    ${myTasks.map(t => `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:16px 24px; font-weight:600;">${t.title}</td>
                            <td style="padding:16px 24px; color:var(--gray-600);">${t.projectName}</td>
                            <td style="padding:16px 24px;">${t.hours}h</td>
                            <td style="padding:16px 24px; color:${t.status === "High-Risk" ? "#ef4444" : "#10b981"}; font-weight:600;">${t.deadline}</td>
                            <td style="padding:16px 24px;">
                                <div style="display:flex; gap:8px;">
                                    <button class="btn btn-outline btn-xs" onclick="openTaskDetails('${t.title}')"><i class="fas fa-comments"></i> Discuss</button>
                                    <button class="btn btn-outline btn-xs" onclick="requestExtension('${t.title}')" style="color:var(--primary-violet); border-color:var(--primary-light-purple);"><i class="fas fa-clock"></i> Request Extension</button>
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function requestExtension(taskName) {
    showToast(`Extension request for "${taskName}" sent to your Team Lead.`, 'info');
    // Simulated communication thread update
    setTimeout(() => {
        showToast('Tip: You can track the response in the Discussion thread.', 'info');
    }, 2000);
}

function renderEmployeePerformanceView(container) {
    container.innerHTML = `
        <div class="welcome-header">
            <h2>My Insights</h2>
            <p>Tracking your efficiency and optimization metrics.</p>
        </div>
        <div class="dashboard-grid">
            <div class="card">
                <h3>Efficiency Trend</h3>
                <div style="height:200px; display:flex; align-items:flex-end; gap:20px; padding:20px 0;">
                    <div style="flex:1; height:70%; background:var(--primary-light-purple); border-radius:8px 8px 0 0; position:relative;">
                        <span style="position:absolute; bottom:-25px; left:50%; transform:translateX(-50%); font-size:11px; color:var(--gray-600);">Mon</span>
                    </div>
                    <div style="flex:1; height:85%; background:var(--primary-light-purple); border-radius:8px 8px 0 0; position:relative;">
                        <span style="position:absolute; bottom:-25px; left:50%; transform:translateX(-50%); font-size:11px; color:var(--gray-600);">Tue</span>
                    </div>
                    <div style="flex:1; height:92%; background:var(--primary-violet); border-radius:8px 8px 0 0; position:relative;">
                        <span style="position:absolute; bottom:-25px; left:50%; transform:translateX(-50%); font-size:11px; color:var(--gray-600);">Wed</span>
                    </div>
                    <div style="flex:1; height:75%; background:var(--primary-light-purple); border-radius:8px 8px 0 0; position:relative;">
                        <span style="position:absolute; bottom:-25px; left:50%; transform:translateX(-50%); font-size:11px; color:var(--gray-600);">Thu</span>
                    </div>
                </div>
                <p style="font-size:13px; color:var(--gray-600); margin-top:40px; text-align:center;">Your average efficiency this week is <strong>92.4%</strong></p>
            </div>
            <div class="card">
                <h3>Workload Health</h3>
                <div style="text-align:center; padding:20px;">
                    <div style="display:inline-block; position:relative; width:120px; height:120px; border-radius:50%; border:10px solid #f1f5f9; border-top-color:var(--primary-violet);">
                        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:24px; font-weight:800;">Optimal</div>
                    </div>
                    <p style="font-size:13px; color:var(--gray-600); margin-top:20px;">You are currently within the <strong>80-120% Balanced</strong> range. You are operating at peak sustainable performance.</p>
                </div>
            </div>
        </div>
    `;
}

