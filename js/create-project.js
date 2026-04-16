/**
 * create-project.js
 * FlowSense Project Creation logic
 */

const API_BASE = '/api';
const companyId = localStorage.getItem('company_id') || '643e2f8e1234567890abcdef'; // Mock or fallback

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('project-form');
    const leadSelect = document.getElementById('proj-lead');
    const priorityBtns = document.querySelectorAll('.priority-btn');
    const priorityInput = document.getElementById('proj-priority');
    const leadWarning = document.getElementById('lead-warning');
    const leadInfo = document.getElementById('lead-info');
    const leadInfoText = document.getElementById('lead-info-text');
    const leadSuggestions = document.getElementById('lead-suggestions');

    let employees = [];

    // Check Role
    const role = localStorage.getItem('userRole');
    if (role === 'employee') {
        alert("Access Denied: Only Company Admins can create projects.");
        window.location.href = 'dashboard.html';
        return;
    }

    // 1. Fetch Employees for Lead Dropdown
    const fetchEmployees = async () => {
        try {
            const res = await fetch(`${API_BASE}/projects/employees/${companyId}`);
            const data = await res.json();
            if (data.success && data.data && data.data.length > 0) {
                employees = data.data;
                populateLeadSelect(employees);
            } else {
                console.warn('No employees found in database, using mock data.');
                useMockEmployees();
            }
        } catch (err) {
            console.error('Error fetching employees:', err);
            useMockEmployees();
        }
    };

    const useMockEmployees = () => {
        showToast('Using simulated data for demo purposes.', 'info');
        employees = [
            { _id: '1', name: 'Rahul Sharma', role: 'Developer', workload_percentage: 60, efficiency: 95 },
            { _id: '2', name: 'Priya Patel', role: 'Developer', workload_percentage: 130, efficiency: 88 },
            { _id: '3', name: 'Amit Kumar', role: 'Tester', workload_percentage: 45, efficiency: 92 },
            { _id: '4', name: 'Sneha Rao', role: 'Production', workload_percentage: 80, efficiency: 90 },
            { _id: '5', name: 'Arjun Singh', role: 'Developer', workload_percentage: 50, efficiency: 98 }
        ];
        populateLeadSelect(employees);
    };

    const populateLeadSelect = (list) => {
        leadSelect.innerHTML = '<option value="">— Choose a Team Lead —</option>';
        list.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp._id;
            option.textContent = `${emp.name} — ${emp.role} (${emp.workload_percentage}% workload)`;
            leadSelect.appendChild(option);
        });
    };

    // 2. Lead Selection Analysis
    leadSelect.addEventListener('change', () => {
        const selectedId = leadSelect.value;
        if (!selectedId) {
            leadWarning.classList.remove('show');
            leadInfo.classList.remove('show');
            return;
        }

        const emp = employees.find(e => e._id === selectedId);
        if (emp) {
            if (emp.workload_percentage > 120) {
                leadWarning.classList.add('show');
                leadInfo.classList.remove('show');
                suggestAlternativeLeads(emp.role);
            } else {
                leadWarning.classList.remove('show');
                leadInfo.classList.add('show');
                leadInfoText.innerHTML = `<strong>Balanced Workload:</strong> ${emp.name} has a current workload of ${emp.workload_percentage}%. This is a safe assignment.`;
            }
        }
    });

    const suggestAlternativeLeads = (role) => {
        leadSuggestions.innerHTML = '';
        const alternatives = employees
            .filter(e => e.role === role && e.workload_percentage <= 100)
            .sort((a, b) => a.workload_percentage - b.workload_percentage)
            .slice(0, 2);

        if (alternatives.length > 0) {
            const p = document.createElement('p');
            p.style.fontSize = '12px';
            p.style.marginTop = '10px';
            p.textContent = 'Suggested alternatives:';
            leadSuggestions.appendChild(p);

            alternatives.forEach(alt => {
                const chip = document.createElement('span');
                chip.className = 'suggestion-chip';
                chip.textContent = `${alt.name} (${alt.workload_percentage}%)`;
                chip.onclick = () => {
                    leadSelect.value = alt._id;
                    leadSelect.dispatchEvent(new Event('change'));
                };
                leadSuggestions.appendChild(chip);
            });
        }
    };

    // 3. Priority Selection
    priorityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            priorityBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            priorityInput.value = btn.getAttribute('data-p');
        });
    });

    // 4. Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const projData = {
            name: document.getElementById('proj-name').value,
            deadline: document.getElementById('proj-deadline').value,
            description: document.getElementById('proj-desc').value,
            team_lead: leadSelect.value,
            priority: priorityInput.value,
            company_id: companyId
        };

        if (!projData.name || !projData.deadline || !projData.team_lead) {
            showToast('Please fill in all required fields.', 'danger');
            return;
        }

        // Store in localStorage for the next page to use (Team Setup)
        localStorage.setItem('temp_project', JSON.stringify(projData));

        showToast('Saving project details...', 'success');

        // Simulate backend delay then redirect
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);
    });

    fetchEmployees();
});

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
