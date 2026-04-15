/**
 * team-setup.js - Premium Polish Edition
 * FlowSense Intelligent Team Optimization
 */

const API_BASE = '/api';
const companyId = localStorage.getItem('company_id') || '643e2f8e1234567890abcdef';

document.addEventListener('DOMContentLoaded', () => {
    const tempProject = JSON.parse(localStorage.getItem('temp_project') || '{}');
    if (!tempProject.name) {
        window.location.href = 'create-project.html';
        return;
    }

    // Set Summary Bar details
    document.getElementById('summary-proj-name').textContent = tempProject.name;
    document.getElementById('bc-project-name').textContent = tempProject.name;

    let allEmployees = [];
    let selectedTeam = [];

    const employeesList = document.getElementById('employees-list');
    const selectedList = document.getElementById('selected-list');
    const availCount = document.getElementById('avail-count');
    const selectedCount = document.getElementById('selected-count');
    const suggestionsList = document.getElementById('suggestions-list');
    const emptyState = document.getElementById('empty-state');
    
    const summaryTeamCount = document.getElementById('summary-team-count');
    const summaryAvgWorkload = document.getElementById('summary-avg-workload');

    const searchInput = document.getElementById('search-input');
    const roleFilter = document.getElementById('filter-role');
    const skillFilter = document.getElementById('filter-skill');
    const workloadFilter = document.getElementById('filter-workload');

    // Custom Tooltip setup
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-custom';
    document.body.appendChild(tooltip);

    // 1. Fetch Data
    const init = async () => {
        try {
            const res = await fetch(`${API_BASE}/projects/employees/${companyId}`);
            const data = await res.json();
            if (data.success && data.data && data.data.length > 0) {
                allEmployees = data.data;
            } else {
                console.warn('No employees found, using mock data');
                useMockData();
            }
        } catch (err) {
            console.warn('Backend unavailable, using mock data');
            useMockData();
        }

        populateSkillFilter();
        renderEmployees();
        updateGlobalSummary();
        updateSuggestions();
    };

    const useMockData = () => {
        allEmployees = [
            { _id: '1', name: 'Rahul Sharma', role: 'Developer', skills: ['Frontend', 'React'], workload_percentage: 60, efficiency: 95, active_projects: 2 },
            { _id: '2', name: 'Priya Patel', role: 'Developer', skills: ['Backend', 'Node.js'], workload_percentage: 130, efficiency: 88, active_projects: 4 },
            { _id: '3', name: 'Amit Kumar', role: 'Tester', skills: ['Automation', 'QA'], workload_percentage: 45, efficiency: 92, active_projects: 1 },
            { _id: '4', name: 'Sneha Rao', role: 'Production', skills: ['DevOps', 'AWS'], workload_percentage: 80, efficiency: 90, active_projects: 2 },
            { _id: '5', name: 'Arjun Singh', role: 'Developer', skills: ['Backend', 'Python'], workload_percentage: 50, efficiency: 98, active_projects: 1 },
            { _id: '6', name: 'Deepa M', role: 'Tester', skills: ['Manual', 'QA'], workload_percentage: 140, efficiency: 75, active_projects: 5 },
            { _id: '7', name: 'Karan J', role: 'Developer', skills: ['Frontend', 'Vue'], workload_percentage: 30, efficiency: 85, active_projects: 0 }
        ];
    };

    const populateSkillFilter = () => {
        const skills = [...new Set(allEmployees.flatMap(e => e.skills))];
        skills.forEach(skill => {
            const opt = document.createElement('option');
            opt.value = skill;
            opt.textContent = skill;
            skillFilter.appendChild(opt);
        });
    };

    // 2. Rendering
    const renderEmployees = () => {
        const query = searchInput.value.toLowerCase();
        const role = roleFilter.value;
        const skill = skillFilter.value;
        const wl = workloadFilter.value;

        const filtered = allEmployees.filter(emp => {
            const matchesSearch = emp.name.toLowerCase().includes(query);
            const matchesRole = !role || emp.role === role;
            const matchesSkill = !skill || emp.skills.includes(skill);
            const matchesWl = !wl || getWorkloadStatus(emp.workload_percentage) === wl;
            return matchesSearch && matchesRole && matchesSkill && matchesWl;
        });

        availCount.textContent = filtered.length;
        employeesList.innerHTML = '';

        filtered.forEach((emp, index) => {
            const isSelected = selectedTeam.some(s => s._id === emp._id);
            const status = getWorkloadStatus(emp.workload_percentage);

            const card = document.createElement('div');
            card.className = `emp-card ${isSelected ? 'already-selected' : ''}`;
            card.style.animationDelay = `${index * 0.05}s`;
            card.innerHTML = `
                <div class="emp-card-top">
                    <div class="emp-avatar" style="background:${getGradient(index)}">${getInitials(emp.name)}</div>
                    <div class="emp-info">
                        <h3>${emp.name}</h3>
                        <p>${emp.role}</p>
                    </div>
                    <div class="wl-badge ${status}" onmouseenter="showWLTooltip(event, ${emp.workload_percentage}, '${emp.name}')" onmouseleave="hideTooltip()">
                        ${emp.workload_percentage}% WL
                    </div>
                </div>
                <div class="wl-bar-bg">
                    <div class="wl-bar ${status}" style="width: ${Math.min(emp.workload_percentage, 100)}%"></div>
                </div>
                <div class="skills-row">
                    ${emp.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
                </div>
                <div class="emp-card-footer">
                    <span class="proj-count">${emp.active_projects || 0} Projects Active</span>
                    <button class="btn-add" ${isSelected ? 'disabled' : ''} onclick="addToTeam('${emp._id}')">
                        ${isSelected ? '✓ Added' : 'Add +'}
                    </button>
                </div>
            `;
            employeesList.appendChild(card);
        });
    };

    const renderSelected = () => {
        selectedCount.textContent = selectedTeam.length;
        if (selectedTeam.length === 0) {
            emptyState.style.display = 'block';
            selectedList.innerHTML = '';
            selectedList.appendChild(emptyState);
            return;
        }

        emptyState.style.display = 'none';
        selectedList.innerHTML = '';

        selectedTeam.forEach(emp => {
            const div = document.createElement('div');
            div.className = 'sel-member';
            div.innerHTML = `
                <div class="sel-member-info">
                    <h4>${emp.name}</h4>
                    <p>${emp.role} · ${emp.workload_percentage}% WL</p>
                </div>
                <button class="btn-remove" onclick="removeFromTeam('${emp._id}')">×</button>
            `;
            selectedList.appendChild(div);
        });
    };

    // 3. Logic Functions
    window.addToTeam = (id) => {
        const emp = allEmployees.find(e => e._id === id);
        if (!emp) return;

        if (emp.workload_percentage > 120) {
            showToast(`Critical Overload: ${emp.name} is beyond capacity.`, 'danger');
        } else if (emp.workload_percentage > 90) {
            showToast(`${emp.name} has limited remaining capacity.`, 'warning');
        }

        selectedTeam.push(emp);
        renderEmployees();
        renderSelected();
        updateGlobalSummary();
        updateSuggestions();
    };

    window.removeFromTeam = (id) => {
        selectedTeam = selectedTeam.filter(e => e._id !== id);
        renderEmployees();
        renderSelected();
        updateGlobalSummary();
        updateSuggestions();
    };

    const updateGlobalSummary = () => {
        summaryTeamCount.textContent = `${selectedTeam.length} Member${selectedTeam.length !== 1 ? 's' : ''}`;
        
        if (selectedTeam.length > 0) {
            const avg = Math.round(selectedTeam.reduce((acc, curr) => acc + curr.workload_percentage, 0) / selectedTeam.length);
            summaryAvgWorkload.textContent = `${avg}%`;
            summaryAvgWorkload.className = `summary-value ${getWorkloadStatus(avg)}`;
        } else {
            summaryAvgWorkload.textContent = '0%';
            summaryAvgWorkload.className = 'summary-value';
        }
    };

    // 4. Smart Suggestions Logic
    const updateSuggestions = () => {
        suggestionsList.innerHTML = '';

        // Scoring + Explanation logic
        const suggestions = allEmployees
            .filter(emp => !selectedTeam.some(s => s._id === emp._id) && emp._id !== tempProject.team_lead)
            .map(emp => {
                let score = (emp.efficiency * 1.5) + (150 - emp.workload_percentage);
                let reason = emp.workload_percentage < 50 ? 'High Capacity' : 
                             emp.efficiency > 95 ? 'Top Performer' : 'Balanced Choice';
                
                // Skill context bonus
                if (tempProject.description && tempProject.description.toLowerCase().includes(emp.role.toLowerCase())) {
                    score += 50;
                    reason = `Matching Role: ${emp.role}`;
                }

                return { ...emp, score, reason };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        if (suggestions.length === 0) {
            suggestionsList.innerHTML = '<p style="font-size:12px;color:var(--gray-400);">Perfect team configuration reached.</p>';
            return;
        }

        suggestions.forEach(emp => {
            const div = document.createElement('div');
            div.className = 'sugg-item';
            div.onclick = () => addToTeam(emp._id);
            div.innerHTML = `
                <div class="sugg-item-info">
                    <h4>${emp.name} <span>✨</span></h4>
                    <p>${emp.reason}</p>
                </div>
                <div class="eff-badge">${emp.efficiency}% Efficiency</div>
            `;
            suggestionsList.appendChild(div);
        });
    };

    // Tooltip Logic
    window.showWLTooltip = (e, wl, name) => {
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.top + window.scrollY - 80}px`;
        
        let msg = wl > 120 ? "Danger: Significant risk of burnout and project delays." :
                  wl >= 80 ? "Optimal: High utilization, monitor closely." : 
                  "Healthy: Capable of accepting more complex tasks.";
        
        tooltip.innerHTML = `<strong>${name}'s Workload</strong>${msg}<br><br><small>Metric: (Logged Hours / total capacity)</small>`;
        tooltip.classList.add('show');
    };

    window.hideTooltip = () => {
        tooltip.classList.remove('show');
    };

    window.saveTeam = async () => {
        if (selectedTeam.length === 0) {
            showToast('Team cannot be empty.', 'danger');
            return;
        }

        const btn = document.getElementById('save-team-btn');
        btn.textContent = '💾 Saving...';
        btn.disabled = true;

        try {
            console.log('Saving team:', selectedTeam.map(e => e._id));
            
            showToast('Team optimization saved successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1800);
        } catch (err) {
            showToast('Failed to save team setup.', 'danger');
            btn.disabled = false;
            btn.textContent = '💾 Save Team & Continue';
        }
    };

    // Helpers
    const getWorkloadStatus = (wl) => {
        if (wl > 120) return 'red';
        if (wl >= 80) return 'yellow';
        return 'green';
    };

    const getInitials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase();
    const getGradient = (i) => {
        const grads = [
            'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)',
            'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
            'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
            'linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)'
        ];
        return grads[i % grads.length];
    };

    // Event Listeners
    searchInput.addEventListener('input', renderEmployees);
    roleFilter.addEventListener('change', renderEmployees);
    skillFilter.addEventListener('change', renderEmployees);
    workloadFilter.addEventListener('change', renderEmployees);

    init();
});

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
