// ── Application State ──
// NOTE: employees/projects are intentionally empty — all data comes from the real API.
// DO NOT add mock data here; it causes cross-company data leakage.
let FlowSenseState = {
    employees: [],   // DEPRECATED — use liveData.employees
    projects:  [],   // DEPRECATED — use liveData.projects
    tasks:     [],   // Live tasks (fetched per view)
    currentView:  'overview',
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
        const data = await res.json();
        if (data.success) {
            liveData.projects = data.data;
            FlowSenseState.projects = data.data; // Sync
            liveData.loaded = true;
            return data.data;
        }
    } catch (err) {
        console.error('Failed to fetch live projects:', err);
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

    renderCurrentView();
    fetchLiveNotifications();
    fetchLiveProfile();
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

async function openTeamSetupModal(projectId) {
    const projects = await fetchLiveProjects();
    const p = projects.find(proj => proj._id === projectId);
    if (!p) return;
    
    currentCreatingProject = p;
    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'flex';
    renderTeamSetupStep();
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
async function handleTaskAssignment(e) {
    e.preventDefault();
    const title = document.getElementById('t-name').value;
    const project = document.getElementById('t-project').value;
    const assigneeId = document.getElementById('t-assignee').value;
    const hours = parseInt(document.getElementById('t-hours').value);
    const priority = document.getElementById('t-priority').value;

    // Smart Alert check
    const emp = FlowSenseState.employees.find(e => e.id === assigneeId);
    if (emp && emp.workload + (hours * 2.5) > 130) {
        const confirmed = await showConfirm('Capacity Alert', `${emp.name} is already near capacity. Assigning this will cause severe overload. Proceed anyway?`, 'Abort', 'Continue');
        if (!confirmed) {
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
        hours,
        priority
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
    // Show premium skeleton while loading
    container.innerHTML = `
        <div class="welcome-header">
            <h2 style="font-size: 32px; font-weight: 800; letter-spacing: -1px; background: var(--violet-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Organization Health</h2>
            <p style="color: var(--gray-600); font-weight: 500;">Intelligence platform analyzing team capacity and delivery risk.</p>
        </div>
        <div class="stats-grid">
            ${[1,2,3,4].map(() => `
                <div class="stat-card" style="opacity:0.6;">
                    <div class="stat-icon violet" style="animation: pulse 2s infinite;"><i class="fas fa-spinner fa-spin"></i></div>
                    <div><div class="stat-value" style="width:40px; height:24px; background:var(--gray-100); border-radius:4px;"></div><div class="stat-label">Syncing...</div></div>
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
            <h2 style="font-size: 32px; font-weight: 800; letter-spacing: -1px; background: var(--violet-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Organization Health</h2>
            <p style="color: var(--gray-600); font-weight: 500;">Intelligence platform analyzing team capacity and delivery risk.</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card hover-lift">
                <div class="stat-icon violet"><i class="fas fa-project-diagram"></i></div>
                <div>
                    <div class="stat-value">${projCount}</div>
                    <div class="stat-label">Active Streams</div>
                </div>
            </div>
            <div class="stat-card hover-lift">
                <div class="stat-icon blue"><i class="fas fa-users"></i></div>
                <div>
                    <div class="stat-value">${empCount}</div>
                    <div class="stat-label">Human Capital</div>
                </div>
            </div>
            <div class="stat-card hover-lift">
                <div class="stat-icon green"><i class="fas fa-tasks"></i></div>
                <div>
                    <div class="stat-value">${FlowSenseState.tasks.length}</div>
                    <div class="stat-label">Active Tasks</div>
                </div>
            </div>
            <div class="stat-card hover-lift">
                <div class="stat-icon amber"><i class="fas fa-exclamation-triangle"></i></div>
                <div>
                    <div class="stat-value">${overloaded.length}</div>
                    <div class="stat-label">Critical Alerts</div>
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
        <div class="welcome-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h2 style="font-size: 32px; font-weight: 800; letter-spacing: -1px; background: var(--violet-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Team Hub</h2>
                <p style="color: var(--gray-600); font-weight: 500;">Managing <strong>${filtered.length}</strong> registered members in the ecosystem.</p>
            </div>
            <div style="background:var(--surface-glass); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.4); padding:8px 18px; border-radius:100px; font-size:13px; color:var(--primary-violet); font-weight:800; box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:10px;">
                <i class="fas fa-users-viewfinder"></i> ${filtered.length} ACTIVE
            </div>
        </div>
        <div class="team-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; margin-top: 32px;">
            ${filtered.map(e => renderTeamCard(e)).join('')}
        </div>
    `;
}

function renderTasksView(container) {
    container.innerHTML = `
        <div class="welcome-header">
            <h2 style="font-size: 32px; font-weight: 800; letter-spacing: -1px; background: var(--violet-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Task Optimizer</h2>
            <p style="color: var(--gray-600); font-weight: 500;">Smart task allocation engine with real-time overload detection.</p>
        </div>

        <div class="dashboard-grid" style="grid-template-columns: 350px 1fr; gap: 32px; align-items: start;">
            <div class="card hover-lift" style="padding: 28px; background: rgba(255,255,255,0.5);">
                <h3 style="margin-bottom:24px; font-size:18px; font-weight:800; color:var(--gray-900);">New Assignment</h3>
                <form onsubmit="handleTaskAssignment(event)">
                    <div class="form-group">
                        <label style="font-size:12px; font-weight:700; color:var(--gray-600); margin-bottom:8px; display:block;">Task Name</label>
                        <input type="text" id="t-name" class="styled-input" placeholder="e.g. Design System" required style="width:100%; padding:14px 18px; border:1px solid rgba(255,255,255,0.6); background:var(--surface-glass); backdrop-filter:blur(10px); border-radius:12px; margin-bottom:20px; font-weight:600; outline:none; transition:all 0.3s;">
                    </div>
                    <div class="form-group">
                        <label style="font-size:12px; font-weight:700; color:var(--gray-600); margin-bottom:8px; display:block;">Hours Required</label>
                        <input type="number" id="t-hours" class="styled-input" value="10" required style="width:100%; padding:14px 18px; border:1px solid rgba(255,255,255,0.6); background:var(--surface-glass); backdrop-filter:blur(10px); border-radius:12px; margin-bottom:20px; font-weight:600; outline:none; transition:all 0.3s;">
                    </div>
                    <div class="form-group">
                        <label style="font-size:12px; font-weight:700; color:var(--gray-600); margin-bottom:8px; display:block;">Project</label>
                        <select id="t-project" class="styled-input" style="width:100%; padding:14px 18px; border:1px solid rgba(255,255,255,0.6); background:var(--surface-glass); backdrop-filter:blur(10px); border-radius:12px; margin-bottom:20px; font-weight:600; outline:none; transition:all 0.3s;">
                            ${FlowSenseState.projects.map(p => `<option>${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="font-size:12px; font-weight:700; color:var(--gray-600); margin-bottom:8px; display:block;">Assignee</label>
                        <select id="t-assignee" class="styled-input" style="width:100%; padding:14px 18px; border:1px solid rgba(255,255,255,0.6); background:var(--surface-glass); backdrop-filter:blur(10px); border-radius:12px; margin-bottom:24px; font-weight:600; outline:none; transition:all 0.3s;" onchange="checkTaskOverload(this.value)">
                            ${FlowSenseState.employees.map(e => `<option value="${e.id}">${e.name} (${Math.round(e.workload)}%)</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Priority</label>
                        <select id="t-priority" class="styled-input" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:15px;">
                            <option value="Low">Low</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                    <div id="smart-alert-container"></div>
                    <button class="btn btn-primary" style="margin-top:10px; width:100%; padding:14px; font-size:14px; border-radius:14px;">Assign Task</button>
                </form>
            </div>

            <div class="card hover-lift" style="padding:0; overflow:hidden;">
                <div style="padding:24px 28px; background:rgba(255,255,255,0.6); border-bottom:1px solid rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--gray-900);">Pending Tasks</h3>
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
    const workload = e.workload_percentage !== undefined ? e.workload_percentage : (e.workload || 0);
    const statusColor = workload > 100 ? '#ef4444' : (workload < 70 ? '#3b82f6' : '#10b981');
    const statusLabel = workload > 100 ? 'Overloaded' : (workload < 70 ? 'Available' : 'Balanced');
    const avatarBg = workload > 100 ? 'ef4444' : workload < 70 ? '3b82f6' : '8b5cf6';

    return `
    <div class="team-card hover-lift" style="background:var(--surface-glass); backdrop-filter:blur(12px); border-radius:var(--radius-lg); border:1px solid rgba(255,255,255,0.6); box-shadow:var(--shadow-premium); overflow:hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
        <div class="team-card-header" style="padding:24px; display:flex; align-items:center; gap:16px; border-bottom:1px solid var(--gray-50);">
            <div style="position:relative;">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(e.name)}&background=${avatarBg}&color=fff" 
                     style="width:56px; height:56px; border-radius:16px; object-fit:cover; border:2px solid white; box-shadow:var(--shadow-sm);">
                <div style="position:absolute; bottom:-2px; right:-2px; width:14px; height:14px; border-radius:50%; background:${statusColor}; border:2px solid white;"></div>
            </div>
            <div style="flex:1;">
                <h4 style="font-size:16px; font-weight:800; color:var(--gray-900); letter-spacing:-0.5px; margin:0;">${e.name}</h4>
                <p style="font-size:11px; color:var(--gray-500); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin:2px 0 0;">${e.role}</p>
            </div>
        </div>
        <div class="team-card-body" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px; font-weight:700;">
                <span style="color:var(--gray-400);">UTILIZATION</span>
                <span style="color:${statusColor}">${workload}%</span>
            </div>
            <div style="height:6px; background:var(--gray-100); border-radius:10px; overflow:hidden; margin-bottom:20px;">
                <div style="width:${Math.min(workload, 100)}%; background:${statusColor}; height:100%; border-radius:10px; transition: width 1s ease;"></div>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${(e.skills || []).slice(0, 3).map(s => `
                    <span style="background:rgba(139, 92, 246, 0.05); color:var(--primary-violet); font-size:10px; padding:3px 8px; border-radius:6px; font-weight:700; border:1px solid rgba(139, 92, 246, 0.1);">${s}</span>
                `).join('')}
                ${(e.skills || []).length > 3 ? `<span style="font-size:10px; color:var(--gray-400); font-weight:600;">+${e.skills.length - 3}</span>` : ''}
            </div>
        </div>
        <div style="padding:16px 20px; background:rgba(255,255,255,0.3); border-top:1px solid var(--gray-50); display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; font-weight:700; color:var(--gray-500);">${statusLabel}</span>
            <button class="btn-primary" style="padding:5px 12px; font-size:10px; border-radius:6px; font-weight:800; letter-spacing:0.5px;" onclick="selectDirectChat('${e._id || e.id}', '${e.name.replace(/'/g, "\\'")}')">MESSAGE</button>
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
function openTaskDetails(name) { showToast(`Thread for: ${name}\nSystem: No active messages.`, 'info'); }
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

// ── Project Menu Actions ──
function toggleProjectMenu(event, pid) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${pid}`);
    const allMenus = document.querySelectorAll('.project-context-menu');
    
    const isOpen = menu.classList.contains('show');
    allMenus.forEach(m => m.classList.remove('show'));
    
    if (!isOpen) menu.classList.add('show');
}

async function showConfirm(title, text, abortLabel = 'Cancel', proceedLabel = 'Proceed') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-modal-overlay');
        const titleEl = document.getElementById('confirm-title');
        const textEl = document.getElementById('confirm-text');
        const abortBtn = document.getElementById('confirm-btn-abort');
        const proceedBtn = document.getElementById('confirm-btn-proceed');

        titleEl.textContent = title;
        textEl.textContent = text;
        abortBtn.textContent = abortLabel;
        proceedBtn.textContent = proceedLabel;
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
        'This will permanently purge all telemetry and resource allocations for this project. This action is irreversible.',
        'Cancel',
        'Terminate'
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
window.addEventListener('click', () => {
    document.querySelectorAll('.project-context-menu').forEach(m => m.classList.remove('show'));
});

function openProjectDetails(projectId) {
    const p = FlowSenseState.projects.find(proj => (proj._id === projectId || proj.id === projectId));
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
                <button class="btn btn-primary" onclick="showToast('Overview view placeholder', 'info')">Overview</button>
                <button class="btn btn-secondary" onclick="openTeamSetupModal('${p.id}')">Manage Team</button>
                <button class="btn btn-secondary" onclick="window.location.href='assign-task.html'">Assign Tasks</button>
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
                <button class="btn btn-secondary" onclick="toggleChatPanel(event)">Chat / Requests</button>
            </div>
            <div class="project-details-section" style="margin-top:20px;">
                <button class="btn btn-secondary btn-sm" onclick="loadView('projects')">Back to Projects</button>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="welcome-header">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h2>${p.name}</h2>
                    <p>${p.description}</p>
                    <p style="font-size:12px; color:var(--primary-violet); margin-top:5px;"><i class="fas fa-crown"></i> Lead: ${p.lead}</p>
                </div>
                <div style="text-align:right;">
                    <div class="progress-circle-mini" style="--p:${p.progress || 0}; width:60px; height:60px;">
                        <span class="p-text" style="font-size:14px;">${p.progress || 0}%</span>
                    </div>
                    <p style="font-size:11px; color:var(--gray-400); margin-top:4px;">Stream Progress</p>
                </div>
            </div>
        </div>
        ${tabsContent}
    `;
}

// ── Insights Module (Advanced Graphs) ──

let insightsCharts = {
    workload: null,
    status: null,
    performance: null
};

async function renderPerformanceView(container) {
    const projects = await fetchLiveProjects();
    
    container.innerHTML = `
        <div class="welcome-header">
            <h2>Enterprise Insights</h2>
            <p>Visualizing team performance, workload distribution, and project velocity.</p>
        </div>

        <div class="insights-header">
            <div class="header-info">
                <h3 style="margin:0; font-size:18px;">Project Analytics</h3>
                <p style="margin:4px 0 0 0; font-size:13px; color:var(--gray-500);">Select a project stream to synchronize telemetry.</p>
            </div>
            <div class="insights-controls">
                <div class="project-selector-wrapper" id="insights-project-selector-container">
                    <div class="custom-select-wrapper" id="insights-project-select">
                        <div class="custom-select-trigger">
                            <span>— Select Project Stream —</span>
                            <i class="fas fa-chevron-down" style="color:var(--gray-300); font-size:12px;"></i>
                        </div>
                        <div class="custom-options"></div>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="refreshInsights()" id="btn-refresh-insights" style="display:none;">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
        </div>

        <div id="insights-display-area">
            <div class="insights-empty-state">
                <i class="fas fa-chart-pie"></i>
                <p>Select a project to visualize intelligence data.</p>
            </div>
        </div>
    `;

    // Initialize Custom Select for Project
    const options = projects.map(p => ({ value: p._id, label: p.name }));
    initializeCustomSelect('insights-project-select', options, (projectId) => {
        loadInsightsForProject(projectId);
    });

    // If a project is already active in state (optional, for better UX)
    if (projects.length > 0) {
        // Auto-select first project for demo purposes or keep empty?
        // Let's keep it empty for "Select a project" flow unless user wants otherwise.
    }
}

async function loadInsightsForProject(projectId) {
    const displayArea = document.getElementById('insights-display-area');
    const refreshBtn = document.getElementById('btn-refresh-insights');
    
    displayArea.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:400px; flex-direction:column; gap:20px;">
            <i class="fas fa-spinner fa-spin" style="font-size:40px; color:var(--primary-violet);"></i>
            <p style="color:var(--gray-500); font-weight:500;">Synthesizing project telemetry...</p>
        </div>
    `;
    refreshBtn.style.display = 'block';

    try {
        // Fetch tasks and members in parallel
        const [tasksRes, membersRes] = await Promise.all([
            fetch(`http://localhost:5000/api/tasks/project/${projectId}`),
            fetch(`http://localhost:5000/api/projects/${projectId}/members`)
        ]);

        const tasksData = await tasksRes.json();
        const membersData = await membersRes.json();

        if (tasksData.success && membersData.success) {
            renderInsightsDashboard(displayArea, membersData.data, tasksData.data);
        } else {
            displayArea.innerHTML = `<div class="alert-box danger">Failed to fetch project data.</div>`;
        }
    } catch (err) {
        console.error('Insights fetch error:', err);
        displayArea.innerHTML = `<div class="alert-box danger">Communication fault with analytics server.</div>`;
    }
}

function renderInsightsDashboard(container, members, tasks) {
    container.innerHTML = `
        <div class="charts-grid">
            <!-- Team Workload Bar Chart -->
            <div class="chart-card">
                <div class="chart-card-header">
                    <h3>Team Workload</h3>
                    <div class="info-tooltip" title="Calculated based on assigned hours in this project relative to 40h/week capacity.">
                        <i class="fas fa-info-circle" style="color:var(--gray-300);"></i>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="workloadChart"></canvas>
                </div>
            </div>

            <!-- Task Status Pie Chart -->
            <div class="chart-card">
                <div class="chart-card-header">
                    <h3>Task Status Overview</h3>
                    <div style="font-size:12px; color:var(--gray-500); font-weight:600;" id="total-tasks-count">Total: ${tasks.length} Tasks</div>
                </div>
                <div class="pie-chart-container">
                    <canvas id="statusChart"></canvas>
                </div>
                <div class="total-tasks-display" id="tasks-percentage-display">
                    <!-- Dynamic text -->
                </div>
            </div>

            <!-- Performance Bar Chart -->
            <div class="chart-card full-width">
                <div class="chart-card-header">
                    <h3>Team Performance Efficiency</h3>
                    <div id="top-performer-container"></div>
                </div>
                <div class="chart-container" style="height: 280px;">
                    <canvas id="performanceChart"></canvas>
                </div>
            </div>
        </div>
    `;

    // 1. Process Data for Workload
    const workloadData = members.map(m => {
        const memberTasks = tasks.filter(t => t.assigned_to && (t.assigned_to._id === m._id || t.assigned_to === m._id));
        const totalHours = memberTasks.reduce((sum, t) => sum + (t.hours || 0), 0);
        const percentage = Math.round((totalHours / 40) * 100);
        return { name: m.name, percentage };
    });

    // 2. Process Data for Status
    const statusCounts = {
        'Pending': 0, // To Do
        'In Progress': 0,
        'Testing': 0,
        'Completed': 0 // Done
    };
    tasks.forEach(t => {
        if (statusCounts.hasOwnProperty(t.status)) {
            statusCounts[t.status]++;
        } else {
            statusCounts['Pending']++; // Fallback
        }
    });

    // 3. Process Data for Performance
    const performanceData = members.map(m => {
        const memberTasks = tasks.filter(t => t.assigned_to && (t.assigned_to._id === m._id || t.assigned_to === m._id));
        const completed = memberTasks.filter(t => t.status === 'Completed').length;
        const total = memberTasks.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { name: m.name, percentage };
    });

    // Find top performer
    const topPerformer = performanceData.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current, {percentage: -1});
    if (topPerformer.percentage > 0) {
        document.getElementById('top-performer-container').innerHTML = `
            <div class="top-performer-badge">
                <i class="fas fa-crown"></i> Top Performer: ${topPerformer.name}
            </div>
        `;
    }

    // --- Render Charts ---

    // Destroy existing charts if they exist
    Object.values(insightsCharts).forEach(chart => { if(chart) chart.destroy(); });

    // Helper: Create Gradient
    const createGradient = (ctx, colorStart, colorEnd) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    };

    // Workload Chart
    const ctxWl = document.getElementById('workloadChart').getContext('2d');
    insightsCharts.workload = new Chart(ctxWl, {
        type: 'bar',
        data: {
            labels: workloadData.map(d => d.name),
            datasets: [{
                label: 'Workload (%)',
                data: workloadData.map(d => d.percentage),
                backgroundColor: workloadData.map(d => {
                    if (d.percentage > 120) return createGradient(ctxWl, '#ef4444', '#b91c1c');
                    if (d.percentage >= 80) return createGradient(ctxWl, '#f59e0b', '#d97706');
                    return createGradient(ctxWl, '#10b981', '#059669');
                }),
                borderRadius: 12,
                barThickness: 28,
                hoverBackgroundColor: '#8b5cf6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `Workload Intensity: ${context.raw}%`,
                        afterLabel: () => 'System optimized resource allocation'
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    max: Math.max(150, ...workloadData.map(d => d.percentage + 20)), 
                    grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false },
                    ticks: { font: { weight: '600' }, color: '#94a3b8' }
                },
                x: { 
                    grid: { display: false },
                    ticks: { font: { weight: '600' }, color: '#64748b' }
                }
            }
        }
    });

    // Status Chart
    const ctxSt = document.getElementById('statusChart').getContext('2d');
    insightsCharts.status = new Chart(ctxSt, {
        type: 'doughnut',
        data: {
            labels: ['To Do', 'In Progress', 'Testing', 'Done'],
            datasets: [{
                data: [statusCounts['Pending'], statusCounts['In Progress'], statusCounts['Testing'], statusCounts['Completed']],
                backgroundColor: [
                    createGradient(ctxSt, '#3b82f6', '#1d4ed8'),
                    createGradient(ctxSt, '#f59e0b', '#d97706'),
                    createGradient(ctxSt, '#f97316', '#c2410c'),
                    createGradient(ctxSt, '#10b981', '#047857')
                ],
                borderWidth: 0,
                hoverOffset: 15,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            animation: { animateRotate: true, animateScale: true, duration: 1500 },
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { usePointStyle: true, padding: 25, font: { weight: '600', size: 12 } } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    cornerRadius: 12,
                    callbacks: {
                        label: (context) => {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const val = context.raw;
                            const perc = total > 0 ? Math.round((val / total) * 100) : 0;
                            return ` ${context.label}: ${val} (${perc}%)`;
                        }
                    }
                }
            }
        }
    });

    // Performance Chart
    const ctxPerf = document.getElementById('performanceChart').getContext('2d');
    const perfGradient = ctxPerf.createLinearGradient(0, 0, 400, 0);
    perfGradient.addColorStop(0, '#8b5cf6');
    perfGradient.addColorStop(1, '#7c3aed');

    insightsCharts.performance = new Chart(ctxPerf, {
        type: 'bar',
        data: {
            labels: performanceData.map(d => d.name),
            datasets: [{
                label: 'Efficiency (%)',
                data: performanceData.map(d => d.percentage),
                backgroundColor: perfGradient,
                borderRadius: 12,
                barThickness: 32,
                hoverBackgroundColor: '#6d28d9'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    cornerRadius: 12
                }
            },
            scales: {
                x: { 
                    beginAtZero: true, 
                    max: 100, 
                    grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false },
                    ticks: { font: { weight: '600' }, color: '#94a3b8' }
                },
                y: { 
                    grid: { display: false },
                    ticks: { font: { weight: '600' }, color: '#64748b' }
                }
            }
        }
    });
}

function refreshInsights() {
    const trigger = document.querySelector('#insights-project-select .custom-select-trigger span');
    const projects = liveData.projects;
    const selectedProjectName = trigger.textContent;
    const p = projects.find(proj => proj.name === selectedProjectName);
    if (p) loadInsightsForProject(p._id);
}


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
                        <div style="padding:12px 0; border-bottom:1px solid #f8fafc;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <div>
                                    <p style="font-weight:600; font-size:14px;">${p.name}</p>
                                    <p style="font-size:12px; color:var(--gray-600);">${p.lead} (Lead)</p>
                                </div>
                                <div style="text-align:right;">
                                    <span class="badge" style="background:#f3f4f6; color:var(--gray-600); font-size:11px; padding:4px 8px; border-radius:10px; display:block; margin-bottom:4px;">${p.status}</span>
                                    <span style="font-size:12px; font-weight:700; color:var(--primary-violet);">${p.progress || 0}%</span>
                                </div>
                            </div>
                            <div class="line-progress-bg" style="height:4px;">
                                <div class="line-progress-fill" style="width: ${p.progress || 0}%"></div>
                            </div>
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
                        <span style="font-size:12px; font-weight:700; color:var(--primary-violet);">${p.progress || 0}% Complete</span>
                    </div>
                    <h3 style="margin-bottom:8px;">${p.name}</h3>
                    <p style="font-size:13px; color:var(--gray-600); margin-bottom:20px;">${p.description}</p>
                    
                    <div style="margin-bottom:20px;">
                        <div class="line-progress-bg" style="margin-bottom:8px;">
                            <div class="line-progress-fill" style="width: ${p.progress || 0}%"></div>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:10px; border-top:1px solid #f3f4f6; padding-top:15px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.lead)}&background=8b5cf6&color=fff" style="width:32px; height:32px; border-radius:50%;">
                        <div style="flex:1;">
                            <p style="font-size:12px; font-weight:600;">${p.lead}</p>
                            <p style="font-size:11px; color:var(--gray-600);">Project Lead</p>
                        </div>
                        <button class="btn btn-outline btn-xs" onclick="event.stopPropagation(); showToast('Sending contact request to ${p.lead}', 'info')">Contact Lead</button>
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

async function addNotification(type, title, desc, longDesc, category, projectLink = null, action = null) {
    const companyId = getCompanyId();
    if (!companyId) return;

    try {
        const res = await fetch('http://localhost:5000/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company_id: companyId,
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

    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding:60px 40px; text-align:center;">
            <i class="fas fa-bell-slash" style="font-size:32px; color:var(--gray-200); margin-bottom:16px; display:block;"></i>
            <p style="color:var(--gray-400); font-size:14px; font-weight:600;">System is currently clear</p>
            <p style="color:var(--gray-300); font-size:12px; margin-top:4px;">No active alerts or updates found in the current stream.</p>
        </div>`;
        return;
    }

    list.innerHTML = filtered.map(n => {
        const isExpanded = expandedNotifId === n.id;
        return `
            <div class="notif-item ${n.read ? 'read' : ''} ${isExpanded ? 'expanded' : ''}" onclick="toggleNotifExpand(event, '${n.id}')">
                <div class="notif-top-row">
                    <div class="notif-icon-box ${n.type}">
                        <i class="fas ${n.type === 'success' ? 'fa-check' : (n.type === 'danger' ? 'fa-exclamation' : 'fa-info')}"></i>
                    </div>
                    <div class="notif-body-content">
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
        'This will immediately revoke your enterprise intelligence features and data analytics dashboard.',
        'Cancel',
        'Terminate'
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

// ══════════════════════════════════════════════════════════
// GLOBAL HYBRID CHAT SYSTEM
// ══════════════════════════════════════════════════════════

let chatActiveProjectId = null;
let chatSelectedType = 'project'; // 'project', 'direct', 'task'
let chatSelectedMemberId = null;
let chatSelectedTaskId = null;
let chatMessages = [];
let chatPollInterval = null;

function toggleChatPanel(e) {
    if (e) e.stopPropagation();
    const sheet = document.getElementById('chat-sheet');
    const overlay = document.getElementById('chat-sheet-overlay');
    if (!sheet || !overlay) return;
    const isOpen = sheet.classList.contains('show');

    // Close other panels
    const notifSheet = document.getElementById('notifications-sheet');
    const notifOverlay = document.getElementById('notif-sheet-overlay');
    if (notifSheet && notifSheet.classList.contains('show')) {
        notifSheet.classList.remove('show');
        if (notifOverlay) notifOverlay.classList.remove('show');
    }
    const profileSheet = document.getElementById('profile-sheet');
    const profileOverlay = document.getElementById('profile-sheet-overlay');
    if (profileSheet && profileSheet.classList.contains('show')) {
        profileSheet.classList.remove('show');
        if (profileOverlay) profileOverlay.classList.remove('show');
    }

    if (!isOpen) {
        sheet.classList.add('show');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Auto-select current project context
        const ctxId = FlowSenseState.globalSelectedProjectId;
        if (ctxId && ctxId !== 'all' && FlowSenseState.projects.some(p => String(p._id) === ctxId)) {
            selectChatProject(ctxId);
        } else if (FlowSenseState.projects.length > 0) {
            selectChatProject(FlowSenseState.projects[0]._id);
        } else {
            renderChatProjectSelector();
            renderChatMembersList();
        }

        // Start polling
        if (chatPollInterval) clearInterval(chatPollInterval);
        chatPollInterval = setInterval(() => {
            if (chatActiveProjectId) loadChatMessages(true);
        }, 8000);
    } else {
        sheet.classList.remove('show');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
        if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
    }
}

function renderChatProjectSelector() {
    const selector = document.getElementById('chat-project-selector');
    if (!selector) return;
    
    const currentUserId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole'); // 'company', 'employee', etc.

    // FILTER: Admins see all, others only see assigned projects
    const myProjects = (FlowSenseState.projects || []).filter(p => {
        if (userRole === 'company') return true; // Company Admin sees all

        const leadId = p.team_lead && (p.team_lead._id || p.team_lead.id || p.team_lead);
        const teamMembers = Array.isArray(p.team_members) ? p.team_members : [];
        const isLead = leadId && String(leadId) === String(currentUserId);
        const isMember = teamMembers.some(m => String(m._id || m.id || m) === String(currentUserId));
        return isLead || isMember;
    });

    if (myProjects.length === 0) {
        selector.innerHTML = '<span style="font-size:11px; color:var(--gray-400); padding:8px 16px;">No projects</span>';
        return;
    }
    selector.innerHTML = myProjects.map(p => `
        <div class="chat-proj-chip ${chatActiveProjectId === String(p._id) && chatSelectedType === 'project' ? 'active' : ''}" 
             onclick="selectChatProject('${p._id}')">
            <i class="fas fa-hashtag" style="margin-right:8px; font-size:10px; opacity:0.5;"></i>
            ${p.name}
        </div>
    `).join('');
}

async function renderChatMembersList() {
    const list = document.getElementById('chat-members-list');
    if (!list) return;
    
    if (!chatActiveProjectId) {
        list.innerHTML = '<span style="font-size:11px; color:var(--gray-400); padding:8px 16px;">Select a project first</span>';
        return;
    }

    const project = FlowSenseState.projects.find(p => String(p._id) === chatActiveProjectId);
    if (!project) return;

    const currentUserId = localStorage.getItem('userId');
    const allEmployees = await fetchLiveEmployees();
    
    // Get members of this project
    const memberIds = (project.team_members || []).map(m => String(m._id || m.id || m));
    const leadId = project.team_lead && (project.team_lead._id || project.team_lead.id || project.team_lead);
    
    if (leadId && !memberIds.includes(String(leadId))) {
        memberIds.push(String(leadId));
    }

    // Filter out self
    const projectMembers = allEmployees.filter(e => memberIds.includes(String(e._id)) && String(e._id) !== currentUserId);

    if (projectMembers.length === 0) {
        list.innerHTML = '<span style="font-size:11px; color:var(--gray-400); padding:8px 16px;">No other members</span>';
        return;
    }

    list.innerHTML = projectMembers.map(m => `
        <div class="chat-member-item ${chatSelectedType === 'direct' && chatSelectedMemberId === String(m._id) ? 'active' : ''}" 
             onclick="selectDirectChat('${m._id}', '${m.name.replace(/'/g, "\\'")}')">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=8b5cf6&color=fff" class="chat-member-avatar">
            <div class="chat-member-info">
                <span class="chat-member-name">${m.name}</span>
                <span class="chat-member-role">${m.role || 'Member'}</span>
            </div>
        </div>
    `).join('');
}

async function selectChatProject(projectId) {
    chatActiveProjectId = String(projectId);
    chatSelectedType = 'project';
    chatSelectedMemberId = null;
    chatSelectedTaskId = null;
    
    const p = FlowSenseState.projects.find(proj => String(proj._id) === chatActiveProjectId);
    const label = document.getElementById('chat-project-label');
    if (label) label.textContent = p ? `Channel: ${p.name}` : 'Enterprise Chat';
    
    document.getElementById('chat-input-bar').style.display = 'flex';
    
    renderChatProjectSelector();
    renderChatMembersList();
    await loadChatMessages();
}

async function selectDirectChat(memberId, memberName) {
    chatSelectedType = 'direct';
    chatSelectedMemberId = String(memberId);
    chatSelectedTaskId = null;
    
    const label = document.getElementById('chat-project-label');
    if (label) label.textContent = `Direct: ${memberName}`;
    
    document.getElementById('chat-input-bar').style.display = 'flex';
    
    renderChatProjectSelector();
    renderChatMembersList();
    await loadChatMessages();
}

async function loadChatMessages(silent = false) {
    if (!chatActiveProjectId) return;
    
    let url = '';
    const apiBase = 'http://localhost:5000';
    if (chatSelectedType === 'project') {
        url = `${apiBase}/api/messages/project/${chatActiveProjectId}`;
    } else if (chatSelectedType === 'direct') {
        const currentUserId = localStorage.getItem('userId');
        url = `${apiBase}/api/messages/direct/${chatActiveProjectId}/${currentUserId}/${chatSelectedMemberId}`;
    } else if (chatSelectedType === 'task') {
        url = `${apiBase}/api/messages/task/${chatSelectedTaskId}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            const prevLen = chatMessages.length;
            chatMessages = data.data || [];
            renderChatMessagesList();
            // Auto-scroll on new messages or first load
            if (!silent || chatMessages.length > prevLen) {
                const container = document.getElementById('chat-messages');
                if (container) setTimeout(() => container.scrollTop = container.scrollHeight, 50);
            }
        }
    } catch (err) {
        console.error('Chat load failed:', err);
    }
}

function renderChatMessagesList() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const userId = localStorage.getItem('userId');

    if (chatMessages.length === 0) {
        container.innerHTML = `
            <div class="chat-empty-state">
                <i class="fas fa-comment-dots"></i>
                <p>No messages yet</p>
                <span>Start a conversation ${chatSelectedType === 'direct' ? 'privately' : 'with your team'}</span>
            </div>`;
        return;
    }

    let lastDate = '';
    let html = '';
    
    // Get active project name for context tags
    const activeProject = FlowSenseState.projects.find(p => String(p._id) === chatActiveProjectId);
    const projectName = activeProject ? activeProject.name : 'Unknown Project';

    chatMessages.forEach(msg => {
        // Date separator
        const msgDate = new Date(msg.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        if (msgDate !== lastDate) {
            html += `<div class="chat-date-sep"><span>${msgDate}</span></div>`;
            lastDate = msgDate;
        }

        const isMine = String(msg.senderId) === String(userId);
        const isLead = (msg.senderRole || '').toLowerCase().includes('lead') || (msg.senderRole || '').toLowerCase().includes('company');
        const alignment = isMine ? 'align-right' : 'align-left';
        
        // Dynamic bubble style
        let bubbleClass = 'chat-bubble-other';
        if (isMine) bubbleClass = 'chat-bubble-mine';
        else if (isLead) bubbleClass = 'chat-bubble-lead';

        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const typeBadge = msg.messageType && msg.messageType !== 'General'
            ? `<div class="chat-req-badge" style="background: rgba(255,255,255,0.2); font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-bottom: 5px; display: inline-block;">${msg.messageType}</div>` : '';

        // Project Context Tag for Direct Messages
        const contextTag = (chatSelectedType === 'direct') 
            ? `<div class="chat-context-tag"><i class="fas fa-layer-group"></i> # ${projectName}</div>` 
            : '';

        html += `
            <div class="chat-message-row ${alignment}">
                <div class="chat-bubble ${bubbleClass}">
                    ${!isMine ? `<div class="chat-meta">${msg.senderName || 'Team Member'} · ${msg.senderRole || 'Employee'}</div>` : ''}
                    ${contextTag}
                    ${typeBadge}
                    <div class="chat-msg-text">${msg.message}</div>
                    <div class="chat-time">${timeStr}</div>
                </div>
            </div>`;
    });

    container.innerHTML = html;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const typeSelect = document.getElementById('chat-msg-type');
    if (!input || !chatActiveProjectId) return;
    const text = input.value.trim();
    if (!text) return;

    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName') || 'User';
    const userRole = localStorage.getItem('userRole');
    const displayRole = FlowSenseState.userProfile?.display_role || (userRole === 'company' ? 'Company Lead' : 'Employee');
    const senderModel = userRole === 'company' ? 'Company' : 'Employee';

    const payload = {
        projectId: chatActiveProjectId,
        senderId: userId,
        senderModel: senderModel,
        senderName: userName,
        senderRole: displayRole,
        message: text,
        messageType: typeSelect ? typeSelect.value : 'General',
        chatType: chatSelectedType,
        receiverId: chatSelectedMemberId,
        taskId: chatSelectedTaskId
    };

    input.value = '';
    input.focus();

    try {
        const res = await fetch('http://localhost:5000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            chatMessages.push(data.data);
            renderChatMessagesList();
            const container = document.getElementById('chat-messages');
            if (container) setTimeout(() => container.scrollTop = container.scrollHeight, 50);
        } else {
            showToast(data.error || 'Failed to send message.', 'danger');
        }
    } catch (err) {
        showToast('Network error: Message not sent.', 'danger');
    }

    // Reset type select
    if (typeSelect) typeSelect.value = 'General';
}

// Close chat panel on outside click
window.onChatOutsideClick = function(e) {
    const sheet = document.getElementById('chat-sheet');
    const overlay = document.getElementById('chat-sheet-overlay');
    if (!document.body.contains(e.target)) return;
    if (sheet && sheet.classList.contains('show')) {
        if (!sheet.contains(e.target) && !e.target.closest('.chat-bell') && !e.target.closest('#chat-bell-btn')) {
            sheet.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
            document.body.style.overflow = '';
            if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
        }
    }
};
window.addEventListener('click', window.onChatOutsideClick);

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

