// js/ai-assistant.js
const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

let companyId = null;
let userName  = null;
let userRole  = null;
let isThinking = false;
const chatHistory = [];

document.addEventListener('DOMContentLoaded', () => {
    companyId = localStorage.getItem('companyId');
    userName  = localStorage.getItem('userName') || 'You';
    userRole  = localStorage.getItem('userRole') || 'Manager';

    // Redirect to login if not authenticated
    if (!localStorage.getItem('token')) {
        window.location.href = '/auth/login.html';
        return;
    }

    document.getElementById('display-name').textContent = userName;
    document.getElementById('display-role').textContent = userRole === 'company' ? 'Company Lead' : 'Team Lead';
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff`;

    setupTextarea();
});

// ── Auto-resize textarea ──
function setupTextarea() {
    const textarea = document.getElementById('query-input');
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    textarea.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitQuery();
        }
    });
}

// ── Use a quick chip ──
function useChip(text) {
    const textarea = document.getElementById('query-input');
    textarea.value = text;
    textarea.focus();
    submitQuery();
}

// ── Submit Query ──
async function submitQuery() {
    const textarea = document.getElementById('query-input');
    const query = textarea.value.trim();
    if (!query || isThinking) return;

    // Clear welcome message on first query
    const welcome = document.getElementById('welcome-block');
    if (welcome) welcome.remove();

    textarea.value = '';
    textarea.style.height = 'auto';
    isThinking = true;
    document.getElementById('send-btn').disabled = true;

    // Render user message
    appendUserMessage(query);

    // Render thinking indicator
    const thinkingEl = appendThinking();

    try {
        const res = await fetch(`${BASE_URL}/api/nl-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, company_id: companyId })
        });

        const data = await res.json();
        thinkingEl.remove();

        if (data.success) {
            appendBotMessage(data.answer, data.candidates || []);
        } else {
            appendError(data.error || 'Something went wrong.');
        }
    } catch (err) {
        thinkingEl.remove();
        appendError('Could not reach the server. Please check your connection.');
    }

    isThinking = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('query-input').focus();
}

// ── Render user message ──
function appendUserMessage(text) {
    const chat = document.getElementById('chat-window');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initial = userName.charAt(0).toUpperCase();

    const el = document.createElement('div');
    el.className = 'chat-msg user';
    el.innerHTML = `
        <div class="msg-avatar user-av">${initial}</div>
        <div class="msg-content">
            <div class="msg-bubble">${escapeHtml(text)}</div>
            <span class="msg-time">${now}</span>
        </div>
    `;
    chat.appendChild(el);
    scrollToBottom();
}

// ── Render AI message ──
function appendBotMessage(text, candidates = []) {
    const chat = document.getElementById('chat-window');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Format the text: convert markdown-ish bullet points
    const formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^[-•]\s/gm, '• ');

    let candidatesHTML = '';
    if (candidates && candidates.length > 0) {
        candidatesHTML = `<div class="candidates-grid">`;
        candidates.forEach(c => {
            const wl = parseFloat(c.workload) || 0;
            const fillClass = wl <= 70 ? 'fill-green' : wl <= 95 ? 'fill-yellow' : 'fill-red';
            const fillWidth = Math.min(wl, 100);
            candidatesHTML += `
                <div class="candidate-card">
                    <div class="cand-name">👤 ${escapeHtml(c.name || '')}</div>
                    <div class="cand-role">${escapeHtml(c.role || '')}</div>
                    <div class="cand-workload-bar">
                        <div class="cand-workload-fill ${fillClass}" style="width:${fillWidth}%"></div>
                    </div>
                    <div class="cand-wl-label">Workload: ${Math.round(wl)}%</div>
                    <div class="cand-reason">${escapeHtml(c.reason || '')}</div>
                </div>
            `;
        });
        candidatesHTML += `</div>`;
    }

    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.innerHTML = `
        <div class="msg-avatar bot-av">✦</div>
        <div class="msg-content">
            <div class="msg-bubble">${formatted}${candidatesHTML}</div>
            <span class="msg-time">FlowSense AI · ${now}</span>
        </div>
    `;
    chat.appendChild(el);
    scrollToBottom();
}

// ── Render thinking animation ──
function appendThinking() {
    const chat = document.getElementById('chat-window');
    const el = document.createElement('div');
    el.className = 'typing-msg';
    el.innerHTML = `
        <div class="msg-avatar bot-av">✦</div>
        <div class="typing-bubble">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chat.appendChild(el);
    scrollToBottom();
    return el;
}

// ── Render error ──
function appendError(msg) {
    const chat = document.getElementById('chat-window');
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.innerHTML = `
        <div class="msg-avatar bot-av">✦</div>
        <div class="msg-content">
            <div class="error-bubble">⚠ ${escapeHtml(msg)}</div>
        </div>
    `;
    chat.appendChild(el);
    scrollToBottom();
}

function scrollToBottom() {
    const chat = document.getElementById('chat-window');
    chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function logout() {
    localStorage.clear();
    window.location.href = '/auth/login.html';
}
