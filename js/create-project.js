/**
 * create-project.js
 * FlowSense Project Creation — Company Admin only.
 * Team Lead dropdown populated exclusively from real MongoDB employees of this company.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Read token (company derived server-side from JWT — never from URL)
    const token     = localStorage.getItem('token');
    const companyId = localStorage.getItem('companyId'); // kept for project submission only

    const form           = document.getElementById('project-form');
    const leadSelect     = document.getElementById('proj-lead');
    const priorityBtns   = document.querySelectorAll('.priority-btn');
    const priorityInput  = document.getElementById('proj-priority');
    const leadWarning    = document.getElementById('lead-warning');
    const leadInfo       = document.getElementById('lead-info');
    const leadInfoText   = document.getElementById('lead-info-text');
    const leadSuggestions = document.getElementById('lead-suggestions');
    const submitBtn      = document.getElementById('submit-btn');

    let employees = [];

    // ── Auth Guard: Company Admin Only ──
    const role = localStorage.getItem('userRole');
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = 'auth/login.html';
        return;
    }
    if (role === 'employee') {
        showToast('Access Denied: Only Company Admins can create projects.', 'danger');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
        return;
    }
    if (!companyId) {
        showToast('Session error: Company ID missing. Please log in again.', 'danger');
        setTimeout(() => { window.location.href = 'auth/login.html'; }, 2000);
        return;
    }

    // ── Update nav avatar ──
    const navAvatar = document.getElementById('nav-avatar');
    const userName  = localStorage.getItem('userName') || 'A';
    if (navAvatar) navAvatar.textContent = userName.charAt(0).toUpperCase();

    // ── 1. Fetch Employees via secure token endpoint ──
    // Server reads company from JWT — URL cannot be manipulated to see other companies
    const fetchEmployees = async () => {
        leadSelect.innerHTML = '<option value="">Loading company members...</option>';
        leadSelect.disabled = true;

        try {
            const res  = await fetch('/api/team-members', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success && data.data && data.data.length > 0) {
                employees = data.data;
                populateLeadSelect(employees);
            } else {
                // No employees — do NOT fall back to mock data
                leadSelect.innerHTML = '<option value="">— No employees registered yet —</option>';
                leadSelect.disabled = true;
                showToast('No employees found. Ask your team to sign up using your company code first.', 'info');
            }
        } catch (err) {
            console.error('Error fetching employees:', err);
            leadSelect.innerHTML = '<option value="">— Failed to load employees —</option>';
            leadSelect.disabled = true;
            showToast('Could not load employees. Please check your connection.', 'danger');
        }
    };

    const populateLeadSelect = (list) => {
        leadSelect.innerHTML = '<option value="">— Choose a Team Lead —</option>';
        leadSelect.disabled = false;

        // Sort: least workload first
        const sorted = [...list].sort((a, b) => (a.workload_percentage || 0) - (b.workload_percentage || 0));

        sorted.forEach(emp => {
            const option        = document.createElement('option');
            option.value        = emp._id;
            const wl            = emp.workload_percentage || 0;
            const statusIcon    = wl > 100 ? '🔴' : wl >= 70 ? '🟡' : '🟢';
            option.textContent  = `${statusIcon} ${emp.name} — ${emp.role} (${wl}% workload)`;
            leadSelect.appendChild(option);
        });
    };

    // ── 2. Lead Selection Analysis ──
    leadSelect.addEventListener('change', () => {
        const selectedId = leadSelect.value;

        if (!selectedId) {
            leadWarning.classList.remove('show');
            leadInfo.classList.remove('show');
            return;
        }

        const emp = employees.find(e => e._id === selectedId);
        if (!emp) return;

        const wl = emp.workload_percentage || 0;

        if (wl > 100) {
            leadWarning.classList.add('show');
            leadInfo.classList.remove('show');
            suggestAlternativeLeads(emp.role, selectedId);
        } else {
            leadWarning.classList.remove('show');
            leadInfo.classList.add('show');
            const statusTxt = wl >= 70 ? 'Moderately loaded — manageable' : 'Low workload — great choice!';
            leadInfoText.innerHTML = `<strong>${emp.name}</strong> has a current workload of <strong>${wl}%</strong>. ${statusTxt}`;
            leadSuggestions.innerHTML = '';
        }
    });

    const suggestAlternativeLeads = (role, excludeId) => {
        leadSuggestions.innerHTML = '';
        const alternatives = employees
            .filter(e => e._id !== excludeId && (e.workload_percentage || 0) <= 100)
            .sort((a, b) => (a.workload_percentage || 0) - (b.workload_percentage || 0))
            .slice(0, 3);

        if (alternatives.length > 0) {
            const label       = document.createElement('p');
            label.style.cssText = 'font-size:12px;margin-top:10px;font-weight:600;';
            label.textContent = 'Suggested alternatives:';
            leadSuggestions.appendChild(label);

            alternatives.forEach(alt => {
                const chip      = document.createElement('span');
                chip.className  = 'suggestion-chip';
                chip.textContent = `${alt.name} (${alt.workload_percentage || 0}%)`;
                chip.onclick    = () => {
                    leadSelect.value = alt._id;
                    leadSelect.dispatchEvent(new Event('change'));
                };
                leadSuggestions.appendChild(chip);
            });
        }
    };

    // ── 3. Priority Selection ──
    priorityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            priorityBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            priorityInput.value = btn.getAttribute('data-p');
        });
    });

    // ── 4. Form Submission → POST to real API ──
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const projData = {
            name:       document.getElementById('proj-name').value.trim(),
            deadline:   document.getElementById('proj-deadline').value,
            description: document.getElementById('proj-desc').value.trim(),
            team_lead:  leadSelect.value,
            priority:   priorityInput.value || 'Medium',
            company_id: companyId
        };

        if (!projData.name || !projData.deadline || !projData.team_lead) {
            showToast('Please fill in all required fields including the Team Lead.', 'danger');
            return;
        }

        // Loading state
        submitBtn.disabled   = true;
        submitBtn.textContent = 'Creating Project...';

        try {
            const res  = await fetch('/api/projects', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(projData)
            });
            const data = await res.json();

            if (data.success) {
                // Store new project id for optional team-setup redirect
                localStorage.setItem('currentSetupProject', data.data._id);
                showToast(`Project "${projData.name}" created successfully! Redirecting...`, 'success');
                setTimeout(() => {
                    window.location.href = 'team-setup.html';
                }, 1500);
            } else {
                showToast(data.error || 'Failed to create project. Please try again.', 'danger');
                submitBtn.disabled   = false;
                submitBtn.textContent = '✦ Create Project';
            }
        } catch (err) {
            console.error('Project creation error:', err);
            showToast('Could not reach the server. Please try again.', 'danger');
            submitBtn.disabled   = false;
            submitBtn.textContent = '✦ Create Project';
        }
    });

    // Kick off employee fetch
    fetchEmployees();
});

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast        = document.createElement('div');
    toast.className    = `toast ${type}`;
    toast.textContent  = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
