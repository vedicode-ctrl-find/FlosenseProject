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

    // ── Detect if this user is a Team Lead of any project ──
    const ledProjects = FlowSenseState.projects.filter(p => {
        const leadId = p.team_lead && (p.team_lead._id || p.team_lead.id || p.team_lead);
        return leadId && String(leadId) === String(userId);
    });
    const isTeamLead = ledProjects.length > 0;

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

        ${isTeamLead ? `
        <!-- Team Stream Panel — injected for Team Leads -->
        <div class="team-stream-section" id="team-stream-section">
            <div class="team-stream-header" onclick="toggleTeamStream()" id="team-stream-header">
                <div class="team-stream-header-left">
                    <div class="ts-crown-icon"><i class="fas fa-crown"></i></div>
                    <div>
                        <h3>Team Stream</h3>
                        <p>Monitor your team members task progress across ${ledProjects.length} project${ledProjects.length > 1 ? 's' : ''} you lead.</p>
                    </div>
                </div>
                <div class="ts-header-right">
                    <span class="ts-total-badge" id="ts-total-badge">Loading...</span>
                    <i class="fas fa-chevron-down ts-toggle-icon" id="ts-toggle-icon"></i>
                </div>
            </div>
            <div class="team-stream-body" id="team-stream-body">
                <div class="team-stream-inner" id="team-stream-inner">
                    <div class="ts-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Synchronizing team data...</span>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
    `;

    // Event Listeners
    document.getElementById('task-project-filter').onchange = (e) => {
        FlowSenseState.currentSelectedProjectForTasks = e.target.value;
        renderEmployeeTasksView(container);
    };

    // If user is a Team Lead, auto-populate the Team Stream section
    if (isTeamLead) {
        renderTeamStreamSection(ledProjects, userId);
    }
}

// ── Toggle Team Stream Panel ──
window.toggleTeamStream = function() {
    const body   = document.getElementById('team-stream-body');
    const icon   = document.getElementById('ts-toggle-icon');
    if (!body || !icon) return;
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    icon.classList.toggle('open', !isOpen);
};

// ── Fetch & Render the Team Stream content ──
async function renderTeamStreamSection(ledProjects, currentUserId) {
    const inner = document.getElementById('team-stream-inner');
    const badge = document.getElementById('ts-total-badge');
    if (!inner) return;

    try {
        // Fetch tasks for all led projects in parallel
        const allProjectData = await Promise.all(
            ledProjects.map(async (proj) => {
                const projId = proj._id || proj.id;
                try {
                    const res  = await fetch(`http://localhost:5000/api/tasks/project/${projId}`);
                    const data = await res.json();
                    return {
                        project: proj,
                        tasks:   data.success ? data.data : []
                    };
                } catch (e) {
                    return { project: proj, tasks: [] };
                }
            })
        );

        // Filter out the Team Lead's own tasks from the stream view
        let grandTotal = 0;
        const projectBlocks = allProjectData.map(({ project, tasks }) => {
            // Only tasks NOT assigned to the current user (the Lead)
            const teamTasks = tasks.filter(t => {
                const assigneeId = t.assigned_to?._id || t.assigned_to?.id || t.assigned_to;
                return String(assigneeId) !== String(currentUserId);
            });
            grandTotal += teamTasks.length;

            if (teamTasks.length === 0) return null;

            // Group by member
            const memberMap = new Map();
            teamTasks.forEach(t => {
                const assignee   = t.assigned_to;
                const assigneeId = assignee?._id || assignee?.id || String(t.assigned_to);
                if (!memberMap.has(String(assigneeId))) {
                    memberMap.set(String(assigneeId), {
                        id:    String(assigneeId),
                        name:  assignee?.name  || 'Team Member',
                        role:  assignee?.role  || 'Employee',
                        tasks: []
                    });
                }
                memberMap.get(String(assigneeId)).tasks.push(t);
            });

            const memberRows = [...memberMap.values()].map(member => {
                const pillsHtml = member.tasks.map(t => {
                    const statusClass = t.status
                        ? t.status.toLowerCase().replace(/\s+/g, '-')
                        : 'pending';
                    const deadline = t.deadline
                        ? new Date(t.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : 'No date';
                    return `
                        <div class="ts-task-pill">
                            <span class="ts-task-name">${t.name}</span>
                            <div class="ts-task-meta">
                                <span class="ts-task-deadline"><i class="far fa-calendar-alt"></i> ${deadline}</span>
                                <span class="ts-status-badge ${statusClass}">${t.status || 'Pending'}</span>
                            </div>
                        </div>
                    `;
                }).join('');

                const avatarColor = member.role === 'Developer' ? '3b82f6'
                    : member.role === 'Designer'  ? 'ec4899'
                    : member.role === 'Tester'    ? 'f59e0b'
                    : member.role === 'DevOps'    ? '10b981'
                    : '8b5cf6';

                return `
                    <div class="ts-member-row">
                        <div class="ts-member-header">
                            <img class="ts-member-avatar"
                                 src="https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=${avatarColor}&color=fff"
                                 alt="${member.name}">
                            <span class="ts-member-name">${member.name}</span>
                            <span class="ts-member-role">${member.role}</span>
                            <span class="ts-member-task-count">${member.tasks.length} task${member.tasks.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="ts-task-pills">${pillsHtml}</div>
                    </div>
                `;
            }).join('');

            return `
                <div class="ts-project-group">
                    <div class="ts-project-label">
                        <div class="ts-project-dot"></div>
                        <h4>${project.name}</h4>
                        <span class="ts-proj-task-count">${teamTasks.length} task${teamTasks.length !== 1 ? 's' : ''}</span>
                    </div>
                    ${memberRows}
                </div>
            `;
        }).filter(Boolean);

        // Update badge count
        if (badge) {
            badge.textContent = grandTotal + ' Team Task' + (grandTotal !== 1 ? 's' : '');
        }

        if (projectBlocks.length === 0) {
            inner.innerHTML = `
                <div class="ts-empty-state">
                    <i class="fas fa-satellite-dish"></i>
                    <p>No team tasks detected. Deploy tasks to your members to monitor them here.</p>
                </div>
            `;
        } else {
            inner.innerHTML = projectBlocks.join('');
        }

    } catch (err) {
        console.error('Team Stream sync failed:', err);
        if (inner) {
            inner.innerHTML = `
                <div class="ts-empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Unable to synchronize team data. Check your connection.</p>
                </div>
            `;
        }
        if (badge) badge.textContent = 'Sync Error';
    }
}
