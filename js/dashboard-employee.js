// ── Application State ──
// NOTE: employees/projects are intentionally empty — all data comes from the real API.
// DO NOT add mock data here; it causes cross-company data leakage.
let FlowSenseState = {
    employees: [],   // DEPRECATED — use liveData.employees
    projects:  [],   // DEPRECATED — use liveData.projects
    tasks:     [],   // Live tasks (fetched per view)
    currentView:  'overview',
    currentSelectedProjectForTasks: 'all', // For Kanban filtering
    searchQuery:  '',
    userProfile: {}  // Cached for settings population
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
        const res  = await fetch('http://localhost:5000/api/team-members', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            liveData.employees = data.data;
            FlowSenseState.employees = data.data; // Sync
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
        const res  = await fetch(`http://localhost:5000/api/projects/company/${companyId}`);
        const text = await res.text();
        try {
            const data = JSON.parse(text);
            if (data.success) {
                liveData.projects = data.data;
                FlowSenseState.projects = data.data; // Sync
                liveData.loaded = true;
                return data.data;
            } else {
                window.DiagnosticFetchDetails = "Success was false: " + text;
            }
        } catch (parseFail) {
            window.DiagnosticFetchDetails = "JSON Parse Failed. Status: " + res.status + " | Response: " + text;
        }
    } catch (err) {
        console.error('Failed to fetch live projects:', err);
        window.DiagnosticFetchDetails = "Network Fetch Exception: " + err.message;
    }
    return [];
}

// ── Fetch persistent notifications from DB ──
async function fetchLiveNotifications() {
    const companyId = getCompanyId();
    const userId    = localStorage.getItem('userId');
    const role      = localStorage.getItem('userRole');
    if (!companyId) return;
    try {
        const res = await fetch(`http://localhost:5000/api/notifications/company/${companyId}?userId=${userId}&role=${role}`);
        const data = await res.json();
        if (data.success) {
            // Map DB fields to UI fields if they differ
            FlowSenseNotifications = data.data.map(n => ({
                id: n._id,
                type: n.type,
                title: n.title,
                desc: n.description,
                longDesc: n.longDescription,
                category: n.category,
                projectLink: n.projectLink,
                action: n.action,
                read: n.isRead,
                time: timeAgo(n.createdAt)
            }));
            renderNotificationsList(); // Update badge/list
        }
    } catch (err) {
        console.error('Notification synchronization failed:', err);
    }
}

async function fetchLiveTasks() {
    const companyId = getCompanyId();
    if (!companyId) return;
    try {
        const res = await fetch(`http://localhost:5000/api/tasks/company/${companyId}`);
        const data = await res.json();
        if (data.success) {
            FlowSenseState.tasks = data.data;
        }
    } catch (err) {
        console.error('Task synchronization failed:', err);
    }
}

// Helper for relative time
function timeAgo(dateParam) {
    if (!dateParam) return 'Just now';
    const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
    const today = new Date();
    const seconds = Math.round((today - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
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

    fetchLiveNotifications();
    fetchLiveProfile();
    // Synchronize all data streams before initial render
    // Use .catch() on each to ensure the dashboard still renders if one stream is offline
    Promise.all([
        fetchLiveProjects().catch(e => console.warn('Project stream offline')), 
        fetchLiveEmployees().catch(e => console.warn('Employee stream offline')),
        fetchLiveTasks().catch(e => console.warn('Task stream offline'))
    ]).then(() => {
        renderCurrentView();
    });
}

function renderCompanySidebar() {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = `
        <a href="#" class="nav-item active" data-view="overview" onclick="loadView('overview')">
            <i class="fas fa-th-large"></i>
            <span>Executive Board</span>
        </a>
        <a href="#" class="nav-item" data-view="projects" onclick="loadView('projects')">
            <i class="fas fa-project-diagram"></i>
            <span>Project Index</span>
        </a>
        <a href="#" class="nav-item" data-view="tasks" onclick="loadView('tasks')">
            <i class="fas fa-tasks"></i>
            <span>My Objectives</span>
        </a>
        <a href="#" class="nav-item" data-view="team" onclick="loadView('team')">
            <i class="fas fa-users-cog"></i>
            <span>Lead Hub</span>
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
            <span>Overview</span>
        </a>
        <a href="#" class="nav-item" data-view="projects" onclick="loadView('projects')">
            <i class="fas fa-project-diagram"></i>
            <span>My Projects</span>
        </a>
        <a href="#" class="nav-item" data-view="tasks" onclick="loadView('tasks')">
            <i class="fas fa-tasks"></i>
            <span>My Tasks</span>
        </a>
        <a href="#" class="nav-item" data-view="performance" onclick="loadView('performance')">
            <i class="fas fa-briefcase"></i>
            <span>Capacity</span>
        </a>
        <a href="#" class="nav-item" data-view="team" onclick="loadView('team')">
            <i class="fas fa-users"></i>
            <span>Team Directory</span>
        </a>
    `;
}

// ── View Management ──
function loadView(view) {
    FlowSenseState.currentView = view;
    renderCurrentView();
}

let currentProjectTasks = [];

async function openAssignTaskModal(projectId) {
    const projects = await fetchLiveProjects();
    const p = projects.find(proj => (proj._id === projectId || proj.id === projectId));
    if (!p) return;
    
    currentCreatingProject = p;
    
    // Fetch current tasks for this project
    try {
        const res = await fetch(`http://localhost:5000/api/tasks/project/${projectId}`);
        const data = await res.json();
        currentProjectTasks = data.success ? data.data : [];
    } catch (e) {
        currentProjectTasks = [];
    }

    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        renderAssignTaskModalContent(false); // Start with board view
    }
}

async function renderAssignTaskModalContent(showForm = false) {
    const container = document.getElementById('modal-container');
    const projectMembers = currentCreatingProject.team_members || [];
    
    const allEmployees = await fetchLiveEmployees();
    const memberIds = projectMembers.map(m => String(m._id || m.id || m));
    const members = allEmployees.filter(e => memberIds.includes(String(e._id || e.id)));
    
    const leadId = currentCreatingProject.team_lead && (currentCreatingProject.team_lead._id || currentCreatingProject.team_lead.id || currentCreatingProject.team_lead);
    const lead = allEmployees.find(e => String(e._id || e.id) === String(leadId));
    if (lead && !members.some(m => String(m._id || m.id) === String(leadId))) {
        members.push(lead);
    }

    if (!showForm) {
        // BOARD VIEW
        container.innerHTML = `
            <div class="modal-header">
                <div class="modal-header-info">
                    <h2>Mission Control: ${currentCreatingProject.name}</h2>
                    <p>Current task deployments and team orchestration.</p>
                </div>
                <button class="close-modal" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" style="padding: 20px 30px;">
                <div class="task-deployment-board">
                    ${currentProjectTasks.length === 0 ? `
                        <div class="empty-state-placeholder">
                            <i class="fas fa-satellite-dish"></i>
                            <p>No active tasks deployed to this stream yet.</p>
                        </div>
                    ` : `
                        <div class="task-grid-board">
                            ${currentProjectTasks.map(t => {
                                const assigneeId = t.assigned_to?._id || t.assigned_to?.id || t.assigned_to;
                                const assignee = allEmployees.find(e => String(e._id || e.id) === String(assigneeId));
                                return `
                                <div class="task-deployment-card">
                                    <div class="task-card-header">
                                        <span class="p-tag p-${t.priority?.toLowerCase() || 'medium'}">${t.priority || 'Med'}</span>
                                        <span class="s-tag s-${t.status?.toLowerCase().replace(' ', '-')}">${t.status}</span>
                                    </div>
                                    <h4 class="task-card-name">${t.name}</h4>
                                    <div class="task-card-assignee">
                                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(assignee?.name || 'U')}&background=8b5cf6&color=fff" class="task-avatar">
                                        <div class="assignee-meta">
                                            <span class="a-name">${assignee?.name || 'Unknown'}</span>
                                            <span class="a-role">${assignee?.role || 'Resource'}</span>
                                        </div>
                                    </div>
                                    <div class="task-card-footer">
                                        <span><i class="fas fa-clock"></i> ${t.hours}h</span>
                                        <span><i class="fas fa-calendar-check"></i> ${new Date(t.deadline).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
            <div class="modal-footer" style="padding: 20px 30px; background: var(--gray-50);">
                <div style="display:flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div class="deployment-stats">
                        <span class="d-stat"><strong>${currentProjectTasks.length}</strong> Deployed</span>
                        <span class="d-stat"><strong>${currentProjectTasks.filter(t => t.status === 'Completed').length}</strong> Completed</span>
                    </div>
                    <button class="btn btn-primary" style="width:auto; padding: 12px 32px; border-radius: 12px;" onclick="renderAssignTaskModalContent(true)">
                        <i class="fas fa-plus"></i> New Deployment
                    </button>
                </div>
            </div>

            <style>
                .task-deployment-board { min-height: 300px; max-height: 500px; overflow-y: auto; padding: 10px 0; }
                .empty-state-placeholder { text-align: center; padding: 80px 20px; color: var(--gray-400); }
                .empty-state-placeholder i { font-size: 40px; margin-bottom: 20px; opacity: 0.3; }
                
                .task-grid-board { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
                .task-deployment-card { background: white; border: 1px solid var(--gray-100); border-radius: 16px; padding: 20px; box-shadow: var(--shadow-sm); transition: all 0.3s ease; }
                .task-deployment-card:hover { border-color: var(--primary-violet); transform: translateY(-3px); box-shadow: var(--shadow-md); }
                
                .task-card-header { display: flex; justify-content: space-between; margin-bottom: 15px; }
                .p-tag, .s-tag { font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 100px; }
                .p-high { background: #fee2e2; color: #991b1b; }
                .p-medium { background: #fef3c7; color: #92400e; }
                .p-low { background: #dcfce7; color: #166534; }
                
                .s-pending { background: #f3f4f6; color: #374151; }
                .s-in-progress { background: #e0f2fe; color: #075985; }
                .s-completed { background: #dcfce7; color: #166534; }

                .task-card-name { font-size: 16px; font-weight: 700; margin-bottom: 18px; color: var(--gray-900); }
                .task-card-assignee { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding: 10px; background: var(--gray-50); border-radius: 12px; }
                .task-avatar { width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; box-shadow: var(--shadow-sm); }
                .assignee-meta { display: flex; flex-direction: column; }
                .a-name { font-size: 13px; font-weight: 700; color: var(--gray-900); }
                .a-role { font-size: 10px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; }
                
                .task-card-footer { display: flex; justify-content: space-between; border-top: 1px solid var(--gray-100); padding-top: 15px; font-size: 12px; font-weight: 600; color: var(--gray-500); }
                .deployment-stats { display: flex; gap: 20px; }
                .d-stat { font-size: 12px; color: var(--gray-600); }
            </style>
        `;
    } else {
        // FORM VIEW
        container.innerHTML = `
            <div class="modal-header">
                <div class="modal-header-info">
                    <button class="back-link" onclick="renderAssignTaskModalContent(false)" style="background:none; border:none; color:var(--primary-violet); font-weight:600; cursor:pointer; padding:0; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-arrow-left" style="font-size:10px;"></i> Back to Mission Board
                    </button>
                    <h2>New Deployment</h2>
                    <p>Provisioning tasks for <strong>${currentCreatingProject.name}</strong></p>
                </div>
                <button class="close-modal" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" style="padding: 30px;">
                <form id="modal-assign-task-form" onsubmit="submitModalTaskAssignment(event)">
                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        <div class="form-group" style="grid-column: span 2;">
                            <label class="modern-label">Task Name *</label>
                            <input type="text" id="m-task-name" class="modern-input" placeholder="e.g. Implement User Authentication" required>
                        </div>
                        
                        <div class="form-group" style="grid-column: span 2;">
                            <label class="modern-label">Description</label>
                            <textarea id="m-task-desc" class="modern-textarea" style="min-height: 80px;" placeholder="Provide technical context and goals..."></textarea>
                        </div>

                        <div class="form-group">
                            <label class="modern-label">Appoint Assignee *</label>
                            <div class="custom-select-wrapper" id="m-assignee-wrapper">
                                <div class="custom-select-trigger">
                                    <span>— Select Talent —</span>
                                    <i class="fas fa-chevron-down" style="color:var(--gray-300); font-size:12px;"></i>
                                </div>
                                <div class="custom-options"></div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="modern-label">Target Deadline *</label>
                            <div class="custom-date-wrapper" id="m-deadline-wrapper">
                                <input type="text" id="m-task-deadline" class="modern-input" placeholder="Select Date" readonly style="cursor:pointer; background:white;">
                                <i class="fas fa-calendar-alt" style="position:absolute; right:16px; top:50%; transform:translateY(-50%); color:var(--gray-300); pointer-events:none;"></i>
                                <div class="custom-date-picker"></div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="modern-label">Effort Estimation (Hours)</label>
                            <input type="number" id="m-task-hours" class="modern-input" min="1" max="100" value="8" required>
                        </div>

                    <div class="form-group">
                        <label class="modern-label">Priority Level</label>
                        <select id="m-task-priority" class="modern-input styled-select" style="height: 48px;">
                            <option value="Low">Low Priority</option>
                            <option value="Medium" selected>Medium Priority</option>
                            <option value="High">High Priority</option>
                        </select>
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer" style="padding: 24px 30px;">
            <div style="display:flex; justify-content: flex-end; gap:12px; width: 100%;">
                <button class="btn btn-secondary" style="border-radius:12px; width: auto; padding: 12px 28px;" onclick="renderAssignTaskModalContent(false)">Cancel</button>
                <button id="modal-deploy-task-btn" class="btn btn-primary" style="border-radius:12px; background:var(--violet-gradient); border:none; padding:12px 36px; width: auto;">
                    Deploy Task <i class="fas fa-paper-plane" style="margin-left:8px; font-size:12px;"></i>
                </button>
            </div>
        </div>
    `;

    // Initialize custom components
    let selectedAssigneeId = '';
    let selectedDeadline = null;

    const selectOptions = members.map(m => ({
        value: m._id || m.id,
        label: `${m.name} — ${m.role} (${m.workload_percentage || 0}% Load)`
    }));

    initializeCustomSelect('m-assignee-wrapper', selectOptions, (val) => {
        selectedAssigneeId = val;
    });

    initializeCustomDatePicker('m-deadline-wrapper', (date) => {
        selectedDeadline = date;
    });

    document.getElementById('modal-deploy-task-btn').onclick = async () => {
        const submitBtn = document.getElementById('modal-deploy-task-btn');
        const name = document.getElementById('m-task-name').value.trim();
        const description = document.getElementById('m-task-desc').value.trim();
        const hours = parseInt(document.getElementById('m-task-hours').value);
        const priority = document.getElementById('m-task-priority').value;
        const requested_by = localStorage.getItem('userId');
        const company_id = localStorage.getItem('companyId');

            if (!name) { showToast('Task name is required.', 'warning'); return; }
            if (!selectedAssigneeId) { showToast('Please select an assignee.', 'warning'); return; }
            if (!selectedDeadline) { showToast('Please select a deadline.', 'warning'); return; }

            const emp = members.find(m => String(m._id || m.id) === String(selectedAssigneeId));
            const currentLoad = emp ? (emp.workload_percentage || 0) : 0;
            const estimatedImpact = Math.round(hours * 2.5);
            if (currentLoad + estimatedImpact > 100) {
               if (!confirm(`Capacity Alert: ${emp.name} is reaching peak load. Continue?`)) return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deploying...';

            try {
                const res = await fetch('http://localhost:5000/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name, description, hours, priority,
                        assigned_to: selectedAssigneeId,
                        project_id: currentCreatingProject._id || currentCreatingProject.id,
                        company_id, requested_by,
                        deadline: selectedDeadline,
                        required_skills: [] 
                    })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Successfully deployed to employee orbit.', 'success');
                    
                    // RE-FETCH TASKS for real-time board update
                    const tRes = await fetch(`http://localhost:5000/api/tasks/project/${currentCreatingProject._id || currentCreatingProject.id}`);
                    const tData = await tRes.json();
                    currentProjectTasks = tData.success ? tData.data : [];
                    
                    // Return to board view
                    renderAssignTaskModalContent(false);

                    addNotification(
                        'info', // type (info, success, warning, danger)
                        'Active Strategy Assigned',
                        `Objective: ${name}`,
                        `Your Lead has deployed a new task to your queue in project ${currentCreatingProject.name}.`,
                        'tasks',
                        currentCreatingProject._id || currentCreatingProject.id,
                        null,
                        null,
                        selectedAssigneeId // Targeted recipient
                    );
                } else {
                    showToast(data.error, 'danger');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Deploy Task <i class="fas fa-paper-plane" style="margin-left:8px; font-size:12px;"></i>';
                }
            } catch (err) {
                showToast('Sync failure.', 'danger');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Deploy Task <i class="fas fa-paper-plane" style="margin-left:8px; font-size:12px;"></i>';
            }
        };
    }
}

async function openTeamSetupModal(projectId) {
    const projects = await fetchLiveProjects();
    const p = projects.find(proj => (proj._id === projectId || proj.id === projectId));
    if (!p) return;
    
    currentCreatingProject = p;
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        renderTeamSetupStep();
    }
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

// ── Modal Multi-Step Flow: Create Project & Team Setup ──

let currentCreatingProject = null;

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'none';
    document.getElementById('modal-container').innerHTML = '';
}

function openProjectModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'flex';
    renderProjectCreationStep();
}

// ── Custom Component Utilities ──

function initializeCustomSelect(containerId, options, onSelect) {
    const wrapper = document.getElementById(containerId);
    if (!wrapper) return;

    let selectedValue = '';
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const optionsCont = wrapper.querySelector('.custom-options');

    trigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = optionsCont.classList.contains('show');
        // Close all others
        document.querySelectorAll('.custom-options').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.custom-select-trigger').forEach(el => el.classList.remove('open'));
        
        if (!isOpen) {
            optionsCont.classList.add('show');
            trigger.classList.add('open');
        }
    };

    const renderOptions = (filteredOptions) => {
        optionsCont.innerHTML = filteredOptions.map(opt => `
            <div class="custom-option ${selectedValue === opt.value ? 'selected' : ''}" data-value="${opt.value}">
                <span>${opt.label}</span>
            </div>
        `).join('');

        optionsCont.querySelectorAll('.custom-option').forEach(el => {
            el.onclick = () => {
                selectedValue = el.dataset.value;
                trigger.querySelector('span').textContent = el.querySelector('span').textContent;
                optionsCont.classList.remove('show');
                trigger.classList.remove('open');
                if (onSelect) onSelect(selectedValue);
            };
        });
    };

    renderOptions(options);

    // Global close
    window.addEventListener('click', () => {
        optionsCont.classList.remove('show');
        trigger.classList.remove('open');
    });
}

function initializeCustomDatePicker(containerId, onSelect) {
    const wrapper = document.getElementById(containerId);
    if (!wrapper) return;

    const input = wrapper.querySelector('.modern-input');
    const picker = wrapper.querySelector('.custom-date-picker');
    let currentDate = new Date();

    input.onclick = (e) => {
        e.stopPropagation();
        picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        picker.innerHTML = `
            <div class="datepicker-header">
                <button class="prev-month" style="background:none; border:none; cursor:pointer; color:var(--gray-500);"><i class="fas fa-chevron-left"></i></button>
                <div style="font-weight:700; font-size:13px;">${monthNames[month]} ${year}</div>
                <button class="next-month" style="background:none; border:none; cursor:pointer; color:var(--gray-500);"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="datepicker-grid" style="margin-top:10px;">
                ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `<div style="font-size:10px; font-weight:700; color:var(--gray-400); text-align:center; padding-bottom:8px;">${d}</div>`).join('')}
                ${Array(firstDay).fill().map(() => `<div class="datepicker-day empty"></div>`).join('')}
                ${Array(daysInMonth).fill().map((_, i) => {
                    const day = i + 1;
                    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
                    return `<div class="datepicker-day ${isToday ? 'today' : ''}" data-day="${day}">${day}</div>`;
                }).join('')}
            </div>
        `;

        picker.querySelector('.prev-month').onclick = (e) => { e.stopPropagation(); currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
        picker.querySelector('.next-month').onclick = (e) => { e.stopPropagation(); currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
        
        picker.querySelectorAll('.datepicker-day:not(.empty)').forEach(el => {
            el.onclick = () => {
                const selected = new Date(year, month, el.dataset.day);
                input.value = selected.toISOString().split('T')[0];
                picker.style.display = 'none';
                if (onSelect) onSelect(input.value);
            };
        });
    };

    renderCalendar();

    window.addEventListener('click', () => {
        picker.style.display = 'none';
    });
}

async function renderProjectCreationStep() {
    const container = document.getElementById('modal-container');
    const token = localStorage.getItem('token');

    container.innerHTML = `
        <div class="modal-header">
            <div class="modal-header-info">
                <h2>New Multi-Project Stream</h2>
                <p>Initialize project parameters and assign core leadership.</p>
            </div>
            <button class="close-modal" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
            <form id="modal-project-form" style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="modern-label">Project Identity *</label>
                    <input type="text" id="modal-p-name" class="modern-input" placeholder="e.g. Phoenix Infrastructure 2.0" required>
                </div>
                <div class="form-group">
                    <label class="modern-label">Target Completion *</label>
                    <div class="custom-date-wrapper" id="p-deadline-wrapper">
                        <input type="text" id="modal-p-deadline" class="modern-input" placeholder="Select Deadline" readonly style="cursor:pointer; background:white;">
                        <i class="fas fa-calendar-alt" style="position:absolute; right:16px; top:50%; transform:translateY(-50%); color:var(--gray-300); pointer-events:none;"></i>
                        <div class="custom-date-picker"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label class="modern-label">Priority Level</label>
                    <div class="priority-group">
                        <button type="button" class="priority-btn" data-p="Low">Low</button>
                        <button type="button" class="priority-btn active" data-p="Medium">Med</button>
                        <button type="button" class="priority-btn" data-p="High">High</button>
                    </div>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="modern-label">Project Objectives</label>
                    <textarea id="modal-p-desc" class="modern-textarea" placeholder="Outline high-level goals and KPIs..." style="min-height:100px;"></textarea>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="modern-label">Appoint Team Lead *</label>
                    <div class="custom-select-wrapper" id="p-lead-wrapper">
                        <div class="custom-select-trigger">
                            <span>— Select Principal Lead —</span>
                            <i class="fas fa-chevron-down" style="color:var(--gray-300); font-size:12px;"></i>
                        </div>
                        <div class="custom-options"></div>
                    </div>
                    <div id="modal-lead-info" class="alert-box info" style="margin-top:16px; display:none;"></div>
                    <div id="modal-lead-warning" class="alert-box warning" style="margin-top:16px; display:none;"></div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" style="border-radius:12px;" onclick="closeModal()">Discard</button>
            <button class="btn btn-primary" id="modal-p-submit" style="border-radius:12px; padding:12px 28px;">
                Configure Team Intelligence <i class="fas fa-arrow-right" style="margin-left:8px; font-size:12px;"></i>
            </button>
        </div>
    `;

    // Priority Logic
    const pBtns = container.querySelectorAll('.priority-btn');
    let selectedPriority = 'Medium';
    pBtns.forEach(btn => {
        btn.onclick = () => {
            pBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPriority = btn.dataset.p;
        };
    });

    // Fetch Employees and Init Custom Select
    const employees = await fetchLiveEmployees();
    const selectOptions = employees.sort((a,b) => (a.workload_percentage || 0) - (b.workload_percentage || 0))
        .map(emp => ({
            value: emp._id,
            label: `${emp.name} — ${emp.role} (${emp.workload_percentage || 0}% Load)`
        }));

    let selectedLeadId = '';
    initializeCustomSelect('p-lead-wrapper', selectOptions, (val) => {
        selectedLeadId = val;
        const emp = employees.find(e => e._id === val);
        const info = document.getElementById('modal-lead-info');
        const warn = document.getElementById('modal-lead-warning');
        if (!emp) return;
        
        const wl = emp.workload_percentage || 0;
        if (wl > 100) {
            warn.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-top:2px;"></i> <div><strong>Capacity Alert:</strong> ${emp.name} is currently over-leveraged at ${wl}%.</div>`;
            warn.style.display = 'flex'; info.style.display = 'none';
        } else {
            info.innerHTML = `<i class="fas fa-info-circle" style="margin-top:2px;"></i> <div><strong>Lead Selected:</strong> ${emp.name} has ${100-wl}% bandwidth available.</div>`;
            info.style.display = 'flex'; warn.style.display = 'none';
        }
    });

    // Init Custom Datepicker
    initializeCustomDatePicker('p-deadline-wrapper');

    // Form Submit
    document.getElementById('modal-p-submit').onclick = async () => {
        const name = document.getElementById('modal-p-name').value;
        const deadline = document.getElementById('modal-p-deadline').value;
        const desc = document.getElementById('modal-p-desc').value;
        const lead = selectedLeadId;
        const companyId = localStorage.getItem('companyId');

        if (!name || !deadline || !lead) {
            showToast('Please complete all mandatory parameters.', 'danger');
            return;
        }

        const submitBtn = document.getElementById('modal-p-submit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing System...';

        try {
            const res = await fetch('http://localhost:5000/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, deadline, description: desc, team_lead: lead, priority: selectedPriority, company_id: companyId })
            });
            const data = await res.json();
            if (data.success) {
                currentCreatingProject = data.data;
                addNotification('info', 'Project Stream Initialized', `System record created for '${name}'.`, `A new development stream has been detected. Operational parameters for '${name}' are now being synchronized. Awaiting team assembly.`, 'project', name);
                renderTeamSetupStep();
            } else {
                showToast(data.error, 'danger');
                submitBtn.disabled = false;
                submitBtn.innerText = 'Configure Team Intelligence';
            }
        } catch (e) {
            showToast('Communication fault with core density server.', 'danger');
            submitBtn.disabled = false;
        }
    };
}

async function renderTeamSetupStep() {
    const container = document.getElementById('modal-container');
    const employees = await fetchLiveEmployees();
    let selectedIds = currentCreatingProject.team_members || [];

    container.innerHTML = `
        <div class="modal-header">
            <div class="modal-header-info">
                <h2>Team Assembly</h2>
                <p>Synthesize expert resources for <strong>${currentCreatingProject.name}</strong></p>
            </div>
            <button class="close-modal" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
            <div class="team-setup-container">
                <div class="selection-panel">
                    <div class="panel-header">
                        <h3>Employee Directory</h3>
                        <div style="position:relative;">
                            <i class="fas fa-search" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--gray-300); font-size:10px;"></i>
                            <input type="text" id="modal-team-search" placeholder="Search talent..." style="padding:6px 10px 6px 28px; border-radius:8px; border:1px solid var(--gray-100); font-size:11px; outline:none; width:160px;">
                        </div>
                    </div>
                    <div class="panel-scroll" id="modal-avail-list"></div>
                </div>

                <div class="selection-panel" style="background:var(--gray-50);">
                    <div class="panel-header">
                        <h3>Project Roster</h3>
                        <span id="modal-sel-count" style="font-size:10px; font-weight:800; background:var(--primary-violet); color:white; padding:2px 8px; border-radius:10px;">0</span>
                    </div>
                    <div class="panel-scroll" id="modal-sel-list"></div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <div class="footer-stats">
                <div class="f-stat">
                    <span>Avg Workload</span>
                    <span id="modal-avg-wl">0%</span>
                </div>
                <div class="f-stat">
                    <span>Team Velocity</span>
                    <span>High Cap</span>
                </div>
            </div>
            <div style="display:flex; gap:12px;">
                <button class="btn btn-secondary" style="border-radius:12px;" onclick="saveTeamLater()">Save for later</button>
                <button class="btn btn-primary" id="modal-team-finish" style="border-radius:12px; background:var(--violet-gradient); border:none; padding:12px 28px;">
                    Finalize Deployment <i class="fas fa-rocket" style="margin-left:8px; font-size:12px;"></i>
                </button>
            </div>
        </div>
    `;

    // Global helper for saving later
    window.saveTeamLater = () => {
        showToast('Draft updated. You can finish team setup anytime from Project Details.', 'info');
        closeModal();
        fetchLiveProjects().then(() => renderCurrentView());
    };

    const availList = document.getElementById('modal-avail-list');
    const selList = document.getElementById('modal-sel-list');
    const selCount = document.getElementById('modal-sel-count');
    const avgWlSpan = document.getElementById('modal-avg-wl');

    const updateLists = () => {
        selCount.textContent = selectedIds.length;
        selList.innerHTML = '';
        availList.innerHTML = '';

        const query = document.getElementById('modal-team-search').value.toLowerCase();
        let totalWl = 0;

        employees.filter(e => e._id !== currentCreatingProject.team_lead).forEach(emp => {
            const isAdded = selectedIds.includes(emp._id);
            // Search by NAME or ROLE
            if (!emp.name.toLowerCase().includes(query) && !emp.role.toLowerCase().includes(query)) return;

            // Avail List item
            const wl = emp.workload_percentage || 0;
            const wlClass = wl > 100 ? 'high' : wl >= 70 ? 'med' : 'low';
            
            const card = document.createElement('div');
            card.className = `member-card ${isAdded ? 'added' : ''}`;
            card.innerHTML = `
                <div class="member-main">
                    <div class="m-avatar">${emp.name.charAt(0)}</div>
                    <div class="m-info">
                        <h4>${emp.name}</h4>
                        <p>${emp.role}</p>
                    </div>
                </div>
                <div class="wl-tag ${wlClass}">${wl}% Load</div>
            `;
            if (!isAdded) card.onclick = () => { selectedIds.push(emp._id); updateLists(); };
            availList.appendChild(card);

            // Selected List item
            if (isAdded) {
                totalWl += wl;
                const selCard = document.createElement('div');
                selCard.className = 'member-card';
                selCard.style.background = 'white';
                selCard.innerHTML = `
                    <div class="member-main">
                        <div class="m-avatar" style="width:28px; height:28px; font-size:11px;">${emp.name.charAt(0)}</div>
                        <div class="m-info">
                            <h4 style="font-size:12px;">${emp.name}</h4>
                        </div>
                    </div>
                    <button class="remove-btn">×</button>
                `;
                selCard.querySelector('.remove-btn').onclick = () => { selectedIds = selectedIds.filter(id => id !== emp._id); updateLists(); };
                selList.appendChild(selCard);
            }
        });

        const avg = selectedIds.length > 0 ? Math.round(totalWl / selectedIds.length) : 0;
        avgWlSpan.textContent = `${avg}%`;
        avgWlSpan.style.color = avg > 100 ? '#ef4444' : (avg >= 70 ? '#f59e0b' : '#10b981');
    };

    document.getElementById('modal-team-search').oninput = updateLists;
    updateLists();

    document.getElementById('modal-team-finish').onclick = async () => {
        const finishBtn = document.getElementById('modal-team-finish');
        finishBtn.disabled = true;
        finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deploying...';

        try {
            await fetch(`http://localhost:5000/api/projects/${currentCreatingProject._id}/team`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_members: selectedIds })
            });
            addNotification('success', 'Stream Fully Deployed', `'${currentCreatingProject.name}' is now operational.`, `Deployment sequence complete. All expert resources have been synthesized for '${currentCreatingProject.name}'. Activity metrics are now reporting live.`, 'project', currentCreatingProject.name);
            showToast('Stream Deployment Successful.', 'success');
            closeModal();
            fetchLiveProjects().then(() => renderCurrentView());
        } catch (e) {
            showToast('Deployment interrupt: Communication failure.', 'danger');
            finishBtn.disabled = false;
        }
    };
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
        <div class="projects-page-header">
            <div class="header-left">
                <h1 class="premium-title">Active Projects</h1>
                <p class="premium-subtitle">Orchestrating <span class="accent-text">${filteredProjects.length}</span> high-impact streams.</p>
            </div>
            <!-- Initialize Stream button removed from here as per user request -->
        </div>

        <div class="projects-grid">
            ${filteredProjects.map(p => {
                const pid = p._id ? p._id.toString() : (p.id ? p.id.toString() : '');
                const progress = p.progress || 0;
                const description = p.description || 'No objectives defined for this stream.';
                const status = p.status || 'Planning';
                
                // Resolve Lead Name
                let leadName = 'Unassigned';
                if (p.team_lead) {
                    const leadEmp = FlowSenseState.employees.find(e => (e._id === p.team_lead || e.id === p.team_lead));
                    if (leadEmp) leadName = leadEmp.name;
                    else leadName = p.lead || 'Strategic Lead';
                } else {
                    leadName = p.lead || 'Strategic Lead';
                }

                const statusClass = status.toLowerCase().replace(' ', '-');

                return `
                <div class="project-card-premium" onclick="openProjectDetails('${pid}')">
                    <div class="card-glow"></div>
                    <div class="card-content">
                        <div class="card-top">
                            <span class="status-pill ${statusClass}">${status}</span>
                            <div class="card-actions-wrapper">
                                <button class="dot-btn" onclick="toggleProjectMenu(event, '${pid}')">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div class="project-context-menu" id="menu-${pid}">
                                    <div class="menu-item" onclick="openProjectDetails('${pid}')"><i class="fas fa-eye"></i> View details</div>
                                    <div class="menu-item" onclick="openTeamSetupModal('${pid}')"><i class="fas fa-users"></i> Manage Team</div>
                                    <div class="menu-item delete" onclick="deleteProject(event, '${pid}')"><i class="fas fa-trash"></i> Delete Stream</div>
                                </div>
                            </div>
                        </div>
                        
                        <h3 class="card-title">${p.name}</h3>
                        <p class="card-desc">${description}</p>
                        
                        <div class="card-metrics">
                            <div class="metric-item">
                                <div class="lead-avatar-group">
                                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(leadName)}&background=8b5cf6&color=fff" alt="${leadName}">
                                    <div class="lead-info">
                                        <span class="l-name">${leadName}</span>
                                        <span class="l-label">Stream Lead</span>
                                    </div>
                                </div>
                            </div>
                            <div class="metric-item right">
                                <div class="progress-circle-mini" style="--p:${progress}">
                                    <span class="p-text">${progress}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card-footer-visual">
                            <div class="line-progress-bg">
                                <div class="line-progress-fill" style="width: ${progress}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('')}
            
            ${filteredProjects.length === 0 ? `
                <div class="empty-state-card" onclick="openProjectModal()">
                    <div class="empty-icon"><i class="fas fa-rocket"></i></div>
                    <h3>Start Your First Stream</h3>
                    <p>No projects are currently active. Click here to initialize your workspace.</p>
                </div>
            ` : ''}
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


// ── Boilerplate for details & views (simplified) ──
function renderOrgView(container) { container.innerHTML = '<h2>Org Settings</h2><p>Mock Code: FS-2026</p>'; }
function openTaskDetails(name) { alert(`Thread for: ${name}\nSystem: No active messages.`); }
// Temporary integration for Assign Task / Manage Team mock URLs.
window.openTeamSetup = function(projectId) {
    openTeamSetupModal(projectId);
}
window.openAssignTask = function(projectId) {
    openAssignTaskModal(projectId);
}

// ── Project Menu Actions ──
function toggleProjectMenu(event, pid) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${pid}`);
    const allMenus = document.querySelectorAll('.project-context-menu');
    
    const isOpen = menu.classList.contains('show');
    allMenus.forEach(m => m.classList.remove('show'));
    
    if (!isOpen) menu.classList.add('show');
}

async function showConfirm(title, text) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-modal-overlay');
        const titleEl = document.getElementById('confirm-title');
        const textEl = document.getElementById('confirm-text');
        const abortBtn = document.getElementById('confirm-btn-abort');
        const proceedBtn = document.getElementById('confirm-btn-proceed');

        titleEl.textContent = title;
        textEl.textContent = text;
        overlay.style.display = 'flex';

        const cleanup = (val) => {
            overlay.style.display = 'none';
            abortBtn.onclick = null;
            proceedBtn.onclick = null;
            resolve(val);
        };

        abortBtn.onclick = () => cleanup(false);
        proceedBtn.onclick = () => cleanup(true);
    });
}

async function deleteProject(event, pid) {
    event.stopPropagation();
    
    // Use custom premium confirmation modal
    const confirmed = await showConfirm(
        'Terminate Stream?', 
        'This will permanently purge all telemetry and resource allocations for this project. This action is irreversible.'
    );
    
    if (!confirmed) return;

    // Show immediate feedback
    showToast('Executing termination protocols...', 'info');

    try {
        const res = await fetch(`http://localhost:5000/api/projects/${pid}/delete`, { 
            method: 'POST' 
        });
        const data = await res.json();
        if (data.success) {
            showToast('Stream successfully terminated and record purged.', 'success');
            await fetchLiveProjects();
            renderCurrentView();
        } else {
            showToast(data.error || 'Failed to delete stream.', 'danger');
        }
    } catch (e) {
        showToast('System fault: Deletion logic interrupted.', 'danger');
    }
    
    // Global menu close
    document.querySelectorAll('.project-context-menu').forEach(m => m.classList.remove('show'));
}

// Global click to close menus
function openProjectDetails(projectId) {
    const p = FlowSenseState.projects.find(proj => (proj._id === projectId || proj.id === projectId));
    if(!p) return;
    FlowSenseState.currentView = 'project_details';
    const container = document.getElementById('view-container');
    const role = localStorage.getItem('userRole'); 
    const userId = localStorage.getItem('userId');
    
    // Resolve Lead Identity
    const leadId = p.team_lead && (p.team_lead._id || p.team_lead.id || p.team_lead);
    const leadEmployee = liveData.employees.find(e => String(e._id || e.id) === String(leadId));
    const leadName = leadEmployee ? leadEmployee.name : 'Unknown Lead';
    const leadRole = leadEmployee ? leadEmployee.role : 'Manager';
    
    // Security verification
    const isLead = String(leadId) === String(userId);

    let actionButtons = '';
    
    if (role === 'company') {
        actionButtons = `
            <div class="project-actions-row">
                <button class="btn btn-secondary btn-glass" onclick="loadView('projects')"><i class="fas fa-arrow-left"></i> Back</button>
                <button class="btn btn-primary" onclick="alert('Manage this project')">Control Panel</button>
            </div>
        `;
    } else {
        // Unified action row for Leads and Members to ensure everyone can see their tasks
        const leadActions = isLead ? `
            <button class="btn btn-primary" onclick="openAssignTaskModal('${p._id || p.id}')"><i class="fas fa-plus"></i> Assign Tasks</button>
            <button class="btn btn-secondary" onclick="openTeamSetupModal('${p._id || p.id}')"><i class="fas fa-users-cog"></i> Manage Team</button>
        ` : '';

        actionButtons = `
            <div class="project-actions-row">
                <button class="btn btn-secondary btn-glass" onclick="loadView('projects')"><i class="fas fa-arrow-left"></i> Back</button>
                ${leadActions}
                <button class="btn btn-primary" style="background:var(--violet-gradient);" onclick="loadView('tasks')"><i class="fas fa-tasks"></i> My Tasks</button>
                <button class="btn btn-secondary" onclick="alert('Opening secure channel...')"><i class="fas fa-comments"></i> Chat / Requests</button>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="project-premium-header">
            <div class="header-main-content">
                <div class="project-title-area">
                    <span class="project-status-tag tag-${p.status.toLowerCase().replace(' ', '-')}">${p.status}</span>
                    <h1 class="project-title-text">${p.name}</h1>
                    <p class="project-desc-text">${p.description || 'No description provided for this initiative.'}</p>
                </div>
                
                <div class="project-meta-grid">
                    <div class="meta-item">
                        <div class="meta-icon"><i class="fas fa-crown"></i></div>
                        <div class="meta-info">
                            <span class="meta-label">Project Lead</span>
                            <span class="meta-value">${leadName}</span>
                        </div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-icon"><i class="fas fa-calendar-alt"></i></div>
                        <div class="meta-info">
                            <span class="meta-label">Deadline</span>
                            <span class="meta-value">${new Date(p.deadline).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-icon"><i class="fas fa-signal"></i></div>
                        <div class="meta-info">
                            <span class="meta-label">Priority</span>
                            <span class="meta-value priority-${p.priority.toLowerCase()}">${p.priority}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="project-progress-section">
                <div class="progress-bar-container">
                    <div class="progress-header">
                        <span class="progress-label">Global Completion</span>
                        <span class="progress-percentage">${p.progress}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${p.progress}%"></div>
                    </div>
                </div>
            </div>
            
            ${actionButtons}
        </div>

        <style>
            .project-premium-header {
                background: white;
                border-radius: var(--radius-xl);
                padding: 40px;
                box-shadow: var(--shadow-premium);
                animation: fadeIn 0.5s ease-out;
                border: 1px solid var(--gray-100);
            }
            .header-main-content {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 40px;
                margin-bottom: 30px;
                flex-wrap: wrap;
            }
            .project-title-area {
                flex: 1;
                min-width: 300px;
            }
            .project-status-tag {
                display: inline-block;
                padding: 6px 14px;
                border-radius: 100px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 16px;
            }
            .tag-active { background: #dcfce7; color: #166534; }
            .tag-planning { background: #f3e8ff; color: #6b21a8; }
            .tag-on-hold { background: #fef3c7; color: #92400e; }
            
            .project-title-text {
                font-size: 36px;
                font-weight: 800;
                color: var(--gray-900);
                margin-bottom: 12px;
                letter-spacing: -0.5px;
            }
            .project-desc-text {
                font-size: 16px;
                color: var(--gray-600);
                line-height: 1.6;
                max-width: 600px;
            }
            .project-meta-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 20px;
                background: var(--gray-50);
                padding: 24px;
                border-radius: var(--radius-lg);
                border: 1px solid var(--gray-100);
                min-width: 280px;
            }
            .meta-item {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .meta-icon {
                width: 40px;
                height: 40px;
                background: white;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--primary-violet);
                font-size: 18px;
                box-shadow: var(--shadow-sm);
            }
            .meta-info {
                display: flex;
                flex-direction: column;
            }
            .meta-label {
                font-size: 11px;
                font-weight: 600;
                color: var(--gray-400);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .meta-value {
                font-size: 15px;
                font-weight: 700;
                color: var(--gray-900);
            }
            .priority-high { color: #ef4444; }
            .priority-medium { color: #f59e0b; }
            .priority-low { color: #10b981; }

            .project-progress-section {
                margin: 30px 0;
                padding: 30px 0;
                border-top: 1px solid var(--gray-100);
                border-bottom: 1px solid var(--gray-100);
            }
            .progress-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 12px;
            }
            .progress-label {
                font-size: 14px;
                font-weight: 600;
                color: var(--gray-900);
            }
            .progress-percentage {
                font-size: 14px;
                font-weight: 800;
                color: var(--primary-violet);
            }
            .progress-track {
                height: 12px;
                background: var(--gray-100);
                border-radius: 100px;
                overflow: hidden;
            }
            .progress-fill {
                height: 100%;
                background: var(--violet-gradient);
                border-radius: 100px;
                transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .project-actions-row {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
            }
            .project-actions-row .btn {
                width: auto;
                min-width: 160px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            .btn-glass {
                background: white;
                color: var(--gray-900);
                border: 1px solid var(--gray-200);
                box-shadow: var(--shadow-sm);
            }
            .btn-glass:hover {
                background: var(--gray-50);
                border-color: var(--gray-300);
            }
        </style>
    `;
}

function renderPerformanceView(container) { container.innerHTML = '<h2>Performance</h2><p>Analytics loading...</p>'; }

function logout() { localStorage.clear(); window.location.href = 'auth/login.html'; }

// Start
document.addEventListener('DOMContentLoaded', checkAuth);


function renderEmployeeOverview(container) {
    const name = localStorage.getItem("userName") || "Employee";
    const userId = localStorage.getItem("userId");
    const myTasks = FlowSenseState.tasks.filter(t => {
        const tid = t.assigned_to?._id || t.assigned_to?.id || t.assigned_to;
        return String(tid) === String(userId);
    });
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
                    ${myTasks.length > 0 ? myTasks.map(t => renderTaskItem(t.name, t.project_id?.name || 'Project', name, new Date(t.deadline).toLocaleDateString(), t.status)).join("") : "<p>No pending tasks.</p>"}
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>Project Participation</h3>
                </div>
                <div class="workload-list">
                    ${FlowSenseState.projects.filter(p => myTasks.some(t => t.project_id?._id === p._id)).map(p => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f8fafc;">
                            <div>
                                <p style="font-weight:600; font-size:14px;">${p.name}</p>
                                <p style="font-size:12px; color:var(--gray-600);">${p.lead || 'Lead'} (Lead)</p>
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
    const userId = localStorage.getItem("userId");
    
    // Filter projects
    const myProjects = FlowSenseState.projects.filter(p => {
        const teamMembers = Array.isArray(p.team_members) ? p.team_members : [];
        const isMember = teamMembers.some(m => String(m._id || m.id || m) === String(userId));
        const leadVal = p.team_lead;
        const isLead = leadVal && String(leadVal._id || leadVal.id || leadVal) === String(userId);
        return isMember || isLead;
    });

    if (FlowSenseState.projects.length === 0) {
        container.innerHTML = `
        <div class="welcome-header">
            <h2>My Projects</h2>
            <p style="color: var(--primary-violet); font-weight: 500;">No projects found in your workspace.</p>
        </div>`;
        return;
    }

    container.innerHTML = `
        <div class="welcome-header">
            <h2>My Projects</h2>
            <p>You are participating in <strong>${myProjects.length}</strong> active initiatives.</p>
        </div>
        
        <div class="projects-grid">
            ${myProjects.map(p => {
                const leadId = p.team_lead && (p.team_lead._id || p.team_lead.id || p.team_lead);
                const leadEmployee = liveData.employees.find(e => String(e._id || e.id) === String(leadId));
                const leadName = leadEmployee ? leadEmployee.name : 'Unknown';
                const isLead = String(leadId) === String(userId);

                return `
                <div class="project-card-premium" onclick="openProjectDetails('${p._id || p.id}')">
                    <div class="card-header-top">
                        <span class="status-indicator status-${p.status.toLowerCase().replace(' ', '-')}">${p.status}</span>
                        ${isLead ? '<span class="lead-badge"><i class="fas fa-crown"></i> Lead</span>' : ''}
                    </div>
                    
                    <h3 class="card-title">${p.name}</h3>
                    <p class="card-desc">${p.description || 'Secure project data stream.'}</p>
                    
                    <div class="card-progress-zone">
                        <div class="progress-info">
                            <span>Completion</span>
                            <span>${p.progress}%</span>
                        </div>
                        <div class="mini-progress-track">
                            <div class="mini-progress-fill" style="width: ${p.progress}%"></div>
                        </div>
                    </div>
                    
                    <div class="card-footer-meta">
                        <div class="lead-meta">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(leadName)}&background=8b5cf6&color=fff" class="mini-avatar">
                            <div class="lead-text-box">
                                <span class="lead-label">Lead</span>
                                <span class="lead-name">${leadName}</span>
                            </div>
                        </div>
                        <div class="deadline-meta">
                            <span class="meta-label">Deadline</span>
                            <span class="meta-date">${new Date(p.deadline).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                        </div>
                    </div>
                </div>
                `;
            }).join("")}
        </div>

        <style>
            .projects-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
                gap: 25px;
                margin-top: 30px;
            }
            .project-card-premium {
                background: white;
                border-radius: var(--radius-lg);
                padding: 24px;
                border: 1px solid var(--gray-100);
                box-shadow: var(--shadow-sm);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }
            .project-card-premium:hover {
                transform: translateY(-5px);
                box-shadow: var(--shadow-lg);
                border-color: var(--primary-violet);
            }
            .card-header-top {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            .status-indicator {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                padding: 4px 10px;
                border-radius: 100px;
            }
            .status-active { background: #dcfce7; color: #166534; }
            .status-planning { background: #f3e8ff; color: #6b21a8; }
            .status-on-hold { background: #fef3c7; color: #92400e; }
            
            .lead-badge {
                font-size: 10px;
                font-weight: 700;
                color: var(--primary-violet);
                background: var(--primary-light-purple);
                padding: 4px 10px;
                border-radius: 100px;
            }
            .card-title {
                font-size: 20px;
                font-weight: 700;
                color: var(--gray-900);
                margin-bottom: 8px;
            }
            .card-desc {
                font-size: 14px;
                color: var(--gray-600);
                margin-bottom: 20px;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                line-height: 1.5;
            }
            .card-progress-zone {
                margin-bottom: 20px;
            }
            .progress-info {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            .mini-progress-track {
                height: 6px;
                background: var(--gray-100);
                border-radius: 100px;
                overflow: hidden;
            }
            .mini-progress-fill {
                height: 100%;
                background: var(--violet-gradient);
                border-radius: 100px;
            }
            .card-footer-meta {
                padding-top: 16px;
                border-top: 1px solid var(--gray-50);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .lead-meta {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .mini-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: var(--shadow-sm);
            }
            .lead-text-box {
                display: flex;
                flex-direction: column;
            }
            .lead-label {
                font-size: 9px;
                font-weight: 600;
                color: var(--gray-400);
                text-transform: uppercase;
            }
            .lead-name {
                font-size: 13px;
                font-weight: 700;
                color: var(--gray-900);
            }
            .deadline-meta {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }
            .meta-date {
                font-size: 13px;
                font-weight: 700;
                color: var(--gray-900);
            }
        </style>
    `;
}

function renderEmployeeTasksView(container) {
    const userId = localStorage.getItem("userId");
    const activeTasks = FlowSenseState.tasks.filter(t => {
        const tid = t.assigned_to?._id || t.assigned_to?.id || t.assigned_to;
        return String(tid) === String(userId);
    });

    // Get unique projects for the filter
    const myProjects = [];
    const pSet = new Set();
    activeTasks.forEach(t => {
        const pid = t.project_id?._id || t.project_id;
        if (pid && !pSet.has(String(pid))) {
            pSet.add(String(pid));
            const p = FlowSenseState.projects.find(proj => String(proj._id || proj.id) === String(pid));
            myProjects.push(p || { _id: pid, name: t.project_id?.name || 'Assigned Project' });
        }
    });

    const selectedPid = FlowSenseState.currentSelectedProjectForTasks;
    const filteredTasks = selectedPid === 'all' 
        ? activeTasks 
        : activeTasks.filter(t => String(t.project_id?._id || t.project_id) === String(selectedPid));

    const columns = [
        { id: 'Pending', label: 'To Do', color: '#64748b' },
        { id: 'In Progress', label: 'In Progress', color: '#3b82f6' },
        { id: 'Testing', label: 'Testing', color: '#f59e0b' },
        { id: 'Completed', label: 'Completed', color: '#10b981' }
    ];

    container.innerHTML = `
        <div class="welcome-header" style="margin-bottom: 30px; display:flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h2 style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Strategic Kanban</h2>
                <p style="color: var(--gray-600); margin-top: 4px;">Orchestrating ${filteredTasks.length} objectives across ${selectedPid === 'all' ? 'all streams' : 'selected stream'}.</p>
            </div>
            
            <div style="display:flex; gap:12px; align-items:center;">
                <label style="font-size:12px; font-weight:700; color:var(--gray-500); text-transform:uppercase;">Stream Filter:</label>
                <select class="modern-input" id="task-project-filter" style="width: 200px; height: 40px; font-size: 13px; border-radius: 10px; padding: 0 12px;">
                    <option value="all" ${selectedPid === 'all' ? 'selected' : ''}>All Projects</option>
                    ${myProjects.map(p => `<option value="${p._id}" ${selectedPid === String(p._id) ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>
        </div>

        <div class="kanban-board" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; align-items: start;">
            ${columns.map(col => {
                const colTasks = filteredTasks.filter(t => t.status === col.id);
                return `
                    <div class="kanban-column" style="background: rgba(248, 250, 252, 0.5); border-radius: 16px; min-height: 600px; display:flex; flex-direction: column; border: 1px solid #f1f5f9;">
                        <div class="kanban-header" style="padding: 16px; display:flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${col.color}20;">
                            <h3 style="font-size: 13px; font-weight: 800; color: var(--gray-800); text-transform: uppercase; letter-spacing: 0.5px; display:flex; align-items: center; gap: 8px;">
                                <span style="width:8px; height:8px; background:${col.color}; border-radius:50%; display:inline-block;"></span>
                                ${col.label}
                            </h3>
                            <span style="font-size: 11px; font-weight: 700; background: #fff; color: ${col.color}; border: 1px solid ${col.color}40; padding: 2px 8px; border-radius: 20px;">${colTasks.length}</span>
                        </div>
                        <div class="kanban-items" style="padding: 12px; display:flex; flex-direction: column; gap: 12px; flex-grow: 1;">
                            ${colTasks.map(t => `
                                <div class="kanban-card" style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; position:relative;">
                                    <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                        <span style="font-size: 10px; font-weight: 800; color: var(--primary-violet); background: var(--primary-light-purple); padding: 2px 8px; border-radius: 6px;">${t.project_id?.name || 'Task'}</span>
                                        <div class="dropdown-container" style="position:relative;">
                                            <button class="btn-xs" style="background:none; border:none; color:var(--gray-400); cursor:pointer;" onclick="toggleTaskMenu(event, '${t._id}')">
                                                <i class="fas fa-ellipsis-v"></i>
                                            </button>
                                            <div id="menu-${t._id}" class="task-menu" style="display:none; position:absolute; right:0; top:20px; background:white; border-radius:8px; box-shadow: var(--shadow-lg); z-index:100; width:150px; border:1px solid #f1f5f9;">
                                                ${columns.filter(c => c.id !== t.status).map(c => `
                                                    <div class="menu-item-kanban" onclick="updateTaskStatus('${t._id}', '${c.id}')" style="padding:10px 14px; font-size:12px; cursor:pointer; color:var(--gray-700); transition: background 0.2s;">
                                                        <i class="fas fa-arrow-right" style="font-size:10px; margin-right:8px; color:var(--gray-300);"></i> Move to ${c.label}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    </div>
                                    <h4 style="font-size: 15px; font-weight: 700; color: var(--gray-900); margin-bottom: 6px;">${t.name}</h4>
                                    <p style="font-size: 12px; color: var(--gray-600); line-height: 1.5; margin-bottom: 16px;">${t.description ? (t.description.length > 70 ? t.description.substring(0, 67) + '...' : t.description) : 'No details.'}</p>
                                    
                                    <div style="display:flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px dashed #e2e8f0;">
                                        <div style="display:flex; align-items: center; gap: 6px; color: var(--gray-500); font-size: 11px;">
                                            <i class="far fa-calendar-alt"></i>
                                            <span>${new Date(t.deadline).toLocaleDateString()}</span>
                                        </div>
                                        <div style="font-size: 11px; font-weight: 700; color: var(--gray-700);">
                                            ${t.hours}h
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                            ${colTasks.length === 0 ? `<div style="text-align:center; padding: 40px 20px; color: var(--gray-300); font-size: 12px; border: 2px dashed #f1f5f9; border-radius:12px;">No tasks here</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Event Listeners
    document.getElementById('task-project-filter').onchange = (e) => {
        FlowSenseState.currentSelectedProjectForTasks = e.target.value;
        renderEmployeeTasksView(container);
    };
}

// Global functions for Kanban
window.toggleTaskMenu = (e, tid) => {
    e.stopPropagation();
    document.querySelectorAll('.task-menu').forEach(m => { if(m.id !== `menu-${tid}`) m.style.display = 'none'; });
    const menu = document.getElementById(`menu-${tid}`);
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
};

window.updateTaskStatus = async (tid, newStatus) => {
    showToast('Updating objective status...', 'info');
    try {
        const res = await fetch(`http://localhost:5000/api/tasks/${tid}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Strategic board synchronized.', 'success');
            await fetchLiveTasks(); 
            await fetchLiveEmployees(); 
            renderCurrentView();    
        }
    } catch (e) {
        showToast('Communication fault with backend.', 'danger');
    }
};

function requestExtension(taskName) {
    showToast(`Extension request for "${taskName}" sent to your Team Lead.`, 'info');
    // Simulated communication thread update
    setTimeout(() => {
        showToast('Tip: You can track the response in the Discussion thread.', 'info');
    }, 2000);
}

// ── Global Notification System (Enterprise Layout) ──
function showToast(msg, type = 'success', title = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (!title) {
        title = type.charAt(0).toUpperCase() + type.slice(1);
        if (type === 'danger') title = 'Error';
    }

    const toast = document.createElement('div');
    toast.className = `toast-premium ${type}`;
    
    let icon = 'fa-check-circle';
    if (type === 'danger') icon = 'fa-circle-xmark';
    if (type === 'info') icon = 'fa-circle-info';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <div class="toast-side-accent"></div>
        <div class="toast-icon-box">
            <i class="fas ${icon}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${msg}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    
    // Trigger entrance
    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
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

// ── Notification Dropdown Logic (Real-time Contextual) ──

let notificationFilter = 'all';
let expandedNotifId = null;
let FlowSenseNotifications = []; // Purged static notifications

async function addNotification(type, title, desc, longDesc, category, projectLink = null, action = null, targetRole = null, recipientId = null) {
    const companyId = getCompanyId();
    if (!companyId) return;

    try {
        const res = await fetch('http://localhost:5000/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company_id: companyId,
                recipient_id: recipientId,
                targetRole: targetRole,
                type, title, description: desc, longDescription: longDesc, 
                category, projectLink, action
            })
        });
        const data = await res.json();
        if (data.success) {
            // Add to local state
            FlowSenseNotifications.unshift({
                id: data.data._id,
                type: data.data.type,
                title: data.data.title,
                desc: data.data.description,
                longDesc: data.data.longDescription,
                category: data.data.category,
                projectLink: data.data.projectLink,
                action: data.data.action,
                read: data.data.isRead,
                time: 'Just now'
            });
            renderNotificationsList();
        }
    } catch (err) {
        console.error('Failed to save notification:', err);
    }
}

function toggleNotifications(e) {
    if (e) e.stopPropagation();
    const sheet = document.getElementById('notifications-sheet');
    const overlay = document.getElementById('notif-sheet-overlay');
    const isOpen = sheet.classList.contains('show');
    
    // Close Profile Sheet if open
    const profileSheet = document.getElementById('profile-sheet');
    const profileOverlay = document.getElementById('profile-sheet-overlay');
    if (profileSheet && profileSheet.classList.contains('show')) {
        profileSheet.classList.remove('show');
        profileOverlay.classList.remove('show');
    }

    document.querySelectorAll('.project-context-menu').forEach(m => m.classList.remove('show'));
    
    if (!isOpen) {
        sheet.classList.add('show');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden'; // Freeze
        renderNotificationsList();
    } else {
        sheet.classList.remove('show');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function renderNotificationsList() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    let filtered = FlowSenseNotifications;
    if (notificationFilter === 'new') filtered = FlowSenseNotifications.filter(n => !n.read);
    if (notificationFilter === 'read') filtered = FlowSenseNotifications.filter(n => n.read);
    let items = FlowSenseNotifications;
    if (notificationFilter === 'new') items = FlowSenseNotifications.filter(n => !n.read);
    if (notificationFilter === 'read') items = FlowSenseNotifications.filter(n => n.read);

    let listHtml = items.map(n => {
        const isExpanded = expandedNotifId === n.id;
        return `
            <div class="notif-item ${!n.read ? 'unread' : ''} ${isExpanded ? 'expanded' : ''}" onclick="toggleNotifExpand(event, '${n.id}')">
                <div class="notif-item-main">
                    <div class="notif-item-icon ${n.type}">
                        <i class="fas ${n.type === 'danger' ? 'fa-exclamation-circle' : n.type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                    </div>
                    <div class="notif-item-content">
                        <div class="notif-meta">
                            <span class="notif-item-title">${n.title}</span>
                            <span class="notif-item-time">${n.time}</span>
                        </div>
                        <div class="notif-item-desc">${n.desc}</div>
                        ${isExpanded ? `
                            <div class="notif-expanded-area">
                                ${n.longDesc ? `<p class="notif-long-text">${n.longDesc}</p>` : ''}
                                <div class="notif-action-cluster">
                                    ${!n.read ? `<button class="btn-notif-action primary" onclick="markAsRead(event, '${n.id}')">Acknowledge</button>` : ''}
                                    ${n.projectLink ? `<button class="btn-notif-action secondary" onclick="viewProjectContext(event, '${n.projectLink}')">Review Project</button>` : ''}
                                    ${n.action ? `<button class="btn-notif-action secondary" onclick="handleNotifAction(event, '${n.action}')">${n.action}</button>` : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (items.length === 0) {
        listHtml = `
            <div style="padding:40px 20px; text-align:center; color:var(--gray-400);">
                <i class="fas fa-bell-slash" style="font-size:32px; margin-bottom:15px; opacity:0.3;"></i>
                <p style="font-size:13px;">No personal alerts found.</p>
                <p style="font-size:11px;">Your professional feed is clear.</p>
            </div>
        `;
    }

    list.innerHTML = listHtml;

    const unread = FlowSenseNotifications.filter(n => !n.read).length;
    const badge = document.getElementById('suggestion-count');
    if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }
}

function toggleNotifExpand(e, id) {
    if (e) e.stopPropagation();
    if (expandedNotifId === id) expandedNotifId = null;
    else expandedNotifId = id;
    renderNotificationsList();
}

function filterNotifications(e, filter) {
    if (e) e.stopPropagation();
    notificationFilter = filter;
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderNotificationsList();
}

async function markAllRead(e) {
    if (e) e.stopPropagation();
    const companyId = getCompanyId();
    if (!companyId) return;

    try {
        const res = await fetch(`http://localhost:5000/api/notifications/company/${companyId}/read-all`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            FlowSenseNotifications.forEach(n => n.read = true);
            renderNotificationsList();
            showToast('All notifications acknowledged.', 'info');
        }
    } catch (err) {
        console.error('Bulk acknowledgment failed:', err);
    }
}

async function markAsRead(e, id) {
    if (e) e.stopPropagation();
    try {
        const res = await fetch(`http://localhost:5000/api/notifications/${id}/read`, { method: 'PUT' });
        const data = await res.json();
        if (data.success) {
            const n = FlowSenseNotifications.find(x => x.id === id);
            if (n) {
                n.read = true;
                renderNotificationsList();
            }
        }
    } catch (err) {
        console.error('Read acknowledgment failed:', err);
    }
}

function viewProjectContext(e, projectQuery) {
    if (e) e.stopPropagation();
    loadView('projects');
    const p = FlowSenseState.projects.find(proj => proj._id === projectQuery || proj.id === projectQuery || proj.name === projectQuery);
    if (p) {
        toggleNotifications();
        setTimeout(() => {
            openProjectDetails(p._id || p.id);
        }, 100);
    } else {
        showToast('Project details not found in current stream.', 'warning');
    }
}

function handleNotifAction(e, action) {
    if (e) e.stopPropagation();
    showToast(`Initiating ${action} protocols...`, 'info');
    setTimeout(() => {
        showToast(`${action} completed successfully.`, 'success');
    }, 1500);
}

// Global click to close notification drawer & context menus
window.addEventListener('click', (e) => {
    // Check if click was on the sheet or its children
    const sheet = document.getElementById('notifications-sheet');
    const overlay = document.getElementById('notif-sheet-overlay');
    
    // If the element has been removed from the body during the click event 
    // (e.g., renderNotificationsList replacing items), we should not trigger closure.
    if (!document.body.contains(e.target)) return;

    if (sheet && sheet.classList.contains('show')) {
        if (!sheet.contains(e.target) && !e.target.closest('.notification-bell')) {
            sheet.classList.remove('show');
            overlay.classList.remove('show');
        }
    }
    
    document.querySelectorAll('.project-context-menu').forEach(m => m.classList.remove('show'));
});

// ── Profile Sheet Logic (Right Side Drawer - Persistent) ──

async function fetchLiveProfile() {
    const id = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    if (!id || !role) return;

    try {
        const res = await fetch(`http://localhost:5000/api/auth/profile/${id}/${role}`);
        const data = await res.json();
        if (data.success) {
            const user = data.data;
            // Update global display
            document.getElementById('user-name-display').textContent = user.name;
            document.getElementById('sheet-user-name').textContent = user.name;
            document.getElementById('sheet-user-email').textContent = user.email;
            
            // Sync Role Badge
            const roleBadge = document.getElementById('sheet-user-role');
            if (roleBadge) roleBadge.textContent = user.display_role || (role === 'company' ? 'Company Lead' : 'Employee');
            
            const sidebarRole = document.getElementById('user-role-display');
            if (sidebarRole) sidebarRole.textContent = user.display_role || (role === 'company' ? 'Company Lead' : 'Employee');


            // Sync avatars
            if (user.profile_image) {
                const avatars = document.querySelectorAll('#user-avatar, #sheet-avatar-img');
                avatars.forEach(img => img.src = user.profile_image);
                localStorage.setItem('userAvatar', user.profile_image);
            }
            
            // Render Billing if Company
            if (user.billing) {
                renderBillingData(user.billing);
            }
            
            // Cache details
            FlowSenseState.userProfile = user;
            localStorage.setItem('userName', user.name);
            localStorage.setItem('userEmail', user.email);
        }
    } catch (err) {
        console.error('Core identity synchronization failed.', err);
    }
}

function toggleProfileSheet(e) {
    if (e) e.stopPropagation();
    const sheet = document.getElementById('profile-sheet');
    const overlay = document.getElementById('profile-sheet-overlay');
    const isShowing = sheet.classList.contains('show');
    const role = localStorage.getItem('userRole');
    
    // Role-based visibility
    const billingMenuItem = document.getElementById('billing-menu-item');
    if (billingMenuItem) {
        billingMenuItem.style.display = (role === 'employee' ? 'none' : 'flex');
    }

    // Close Notification Sheet if open
    const notifSheet = document.getElementById('notifications-sheet');
    const notifOverlay = document.getElementById('notif-sheet-overlay');
    if (notifSheet && notifSheet.classList.contains('show')) {
        notifSheet.classList.remove('show');
        notifOverlay.classList.remove('show');
    }

    if (!isShowing) {
        sheet.classList.add('show');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden'; 
        
        // Refresh from DB before showing
        fetchLiveProfile();
        
        document.getElementById('edit-name').value = localStorage.getItem('userName') || '';
        document.getElementById('edit-email').value = localStorage.getItem('userEmail') || '';
    } else {
        sheet.classList.remove('show');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
        closeSettingsPanel();
    }
}

async function fetchSkillSuggestions(role) {
    const container = document.getElementById('edit-suggestions-list');
    const group = document.getElementById('edit-suggestions-group');
    if (!container || !group) return;

    try {
        const res = await fetch(`http://localhost:5000/api/auth/skills/${role}`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
            group.style.display = 'block';
            container.innerHTML = data.data.map(skill => `
                <div class="suggestion-badge" style="background:#f5f3ff; border:1px solid #ddd; color:#5b21b6; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:11px;" onclick="addSuggestedSkill('${skill}')">
                    + ${skill}
                </div>
            `).join('');
        } else {
            group.style.display = 'none';
        }
    } catch (err) {
        console.error('Skill suggestion fetch failed:', err);
    }
}

function addSuggestedSkill(skill) {
    const input = document.getElementById('edit-skills');
    let current = input.value.trim();
    let skills = current ? current.split(',').map(s => s.trim()) : [];
    
    if (!skills.includes(skill)) {
        skills.push(skill);
        input.value = skills.join(', ');
        showToast(`Skill "${skill}" added to bridge.`, 'info');
    }
}

function openSettingsPanel() {
    const user = FlowSenseState.userProfile;
    const user_role = localStorage.getItem('userRole');
    
    document.getElementById('profile-view-main').style.display = 'none';
    document.getElementById('profile-view-settings').style.display = 'block';
    document.getElementById('profile-view-billing').style.display = 'none';
    
    // Fill current data
    document.getElementById('edit-name').value = user.name || '';
    document.getElementById('edit-email').value = user.email || '';
    
    // Employee Specific
    const empFields = document.getElementById('edit-employee-fields');
    if (user_role === 'employee') {
        empFields.style.display = 'block';
        const roleSel = document.getElementById('edit-role');
        roleSel.value = user.display_role || 'Developer';
        document.getElementById('edit-skills').value = (user.skills || []).join(', ');
        
        // Load initial suggestions
        fetchSkillSuggestions(roleSel.value);
        
        // Listen for changes
        roleSel.onchange = (e) => fetchSkillSuggestions(e.target.value);
    } else {
        empFields.style.display = 'none';
    }
}

function closeSettingsPanel() {
    document.getElementById('profile-view-main').style.display = 'block';
    document.getElementById('profile-view-settings').style.display = 'none';
}

function openBillingPanel() {
    document.getElementById('profile-view-main').style.display = 'none';
    document.getElementById('profile-view-settings').style.display = 'none';
    document.getElementById('profile-view-billing').style.display = 'block';
}

function closeBillingPanel() {
    document.getElementById('profile-view-main').style.display = 'block';
    document.getElementById('profile-view-billing').style.display = 'none';
}

async function manageSubscription() {
    showToast('Initializing secure subscription gateway...', 'info');
    setTimeout(() => {
        showToast('Gateway ready. Redirecting to stripe-portal...', 'success');
    }, 1500);
}

function addPaymentMethod() {
    console.log('addPaymentMethod triggered');
    showToast('Preparing payment method bridge...', 'info');
}

async function cancelSubscription() {
    const confirmed = await showConfirm(
        'Terminate Subscription?', 
        'This will immediately revoke your enterprise intelligence features and data analytics dashboard.'
    );
    
    if (confirmed) {
        showToast('Subscription scheduled for termination at end of billing cycle.', 'warning');
    }
}

async function handleProfileUpdate(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('edit-name').value;
    const email = document.getElementById('edit-email').value;
    const pass = document.getElementById('edit-pass').value;
    const confirm = document.getElementById('edit-pass-confirm').value;
    
    // New fields
    const role_val = document.getElementById('edit-role').value;
    const skills_val = document.getElementById('edit-skills').value;

    const id = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');

    if (!name || !email) {
        showToast('Identity parameters cannot be null.', 'warning');
        return;
    }

    if (pass && pass !== confirm) {
        showToast('Security mismatch: Alignment failed.', 'danger');
        return;
    }

    try {
        console.log('TRANSMITTING IDENTITY SYNC:', { id, role, name, email, role_field: role_val, skills: skills_val });
        const res = await fetch('http://localhost:5000/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id, 
                role, 
                name, 
                email, 
                password: pass,
                role_field: role_val, // sent to update employee role
                skills: skills_val     // sent to update skills array
            })
        });
        const data = await res.json();
        
        if (data.success) {
            // Update cache and display
            fetchLiveProfile(); // Re-fetch all fresh data
            showToast('Central database updated successfully.', 'success');
            closeSettingsPanel();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Synchronization interrupt: Server offline.', 'danger');
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const id = localStorage.getItem('userId');
        const role = localStorage.getItem('userRole');
        const reader = new FileReader();
        
        reader.onprogress = () => showToast('Transmitting biometric data...', 'info');
        reader.onload = async function(event) {
            const base64 = event.target.result;
            
            try {
                const res = await fetch('http://localhost:5000/api/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, role, profile_image: base64 })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('userAvatar', base64);
                    const avatars = document.querySelectorAll('#user-avatar, #sheet-avatar-img');
                    avatars.forEach(img => img.src = base64);
                    showToast('Biometric record updated forever.', 'success');
                }
            } catch (err) {
                showToast('Failed to persist image to database.', 'danger');
            }
        };
        reader.readAsDataURL(file);
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'auth/login.html';
}

window.addEventListener('click', (e) => {
    const sheet = document.getElementById('profile-sheet');
    const overlay = document.getElementById('profile-sheet-overlay');
    if (!document.body.contains(e.target)) return;
    if (sheet && sheet.classList.contains('show')) {
        if (!sheet.contains(e.target) && !e.target.closest('#profile-trigger')) {
            toggleProfileSheet();
        }
    }
});

