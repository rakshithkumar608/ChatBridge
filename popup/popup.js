// popup/popup.js — ChatBridge Popup Controller
// Now integrated with:
//   • Sensitive data detection + redaction before every transfer
//   • Secure-delete via service worker (2-pass wipe)
//   • Target provider passed to compression so per-model limits are respected

import { buildContinuityPrompt } from '../utils/continuity-prompt.js';
import { scanForSensitiveData, redactSensitiveData, groupFindingsBySeverity }
    from '../utils/sensitive-detector.js';

// ─── Tab switching ───────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab, .tab-content').forEach(el => {
            el.classList.remove('active');
            if (el.classList.contains('tab-content')) el.classList.add('hidden');
        });
        tab.classList.add('active');
        const content = document.getElementById(`tab-${tab.dataset.tab}`);
        content.classList.remove('hidden');
        content.classList.add('active');
    });
});

// ─── Detect which AI provider is open in the current tab ────────────────────
async function detectProvider() {
    const [tab]  = await chrome.tabs.query({ active: true, currentWindow: true });
    const badge  = document.getElementById('provider-badge');
    const url    = tab.url || '';

    if      (url.includes('claude.ai'))                        badge.textContent = '🟠 Claude';
    else if (url.includes('chatgpt.com') || url.includes('openai.com')) badge.textContent = '🟢 ChatGPT';
    else if (url.includes('gemini.google.com'))                badge.textContent = '🔵 Gemini';
    else if (url.includes('groq.com'))                         badge.textContent = '⚡ Groq';
    else if (url.includes('deepseek.com'))                     badge.textContent = '🐋 DeepSeek';
    else if (url.includes('perplexity.ai'))                    badge.textContent = '🧭 Perplexity';
    else if (url.includes('mistral.ai'))                       badge.textContent = '🌪️ Mistral';
    else if (url.includes('grok.com') || url.includes('x.com/i/grok')) badge.textContent = '✖️ Grok';
    else if (url.includes('cohere.com'))                       badge.textContent = '🌿 Cohere';
    else if (url.includes('meta.ai'))                          badge.textContent = '♾️ Meta AI';
    else if (url.includes('copilot.microsoft.com'))            badge.textContent = '🤖 Copilot';
    else if (url.includes('poe.com'))                          badge.textContent = '👻 Poe';
    else {
        badge.textContent  = '⚠️ No AI detected';
        badge.style.color  = 'orange';
    }
}

detectProvider();

// ─── Capture button ──────────────────────────────────────────────────────────
document.getElementById('capture-btn').addEventListener('click', async () => {
    const [tab]    = await chrome.tabs.query({ active: true, currentWindow: true });
    const compress = document.getElementById('compress-opt').checked;
    const status   = document.getElementById('capture-status');

    try {
        status.textContent = '⏳ Capturing...';
        status.style.color = '#888';
        status.classList.remove('hidden');

        const resp = await chrome.tabs.sendMessage(tab.id, { action: 'SCRAPE_CHAT' });

        if (!resp?.success) {
            throw new Error(resp?.error || 'Scrape failed — unknown error');
        }

        if (!resp.session.messages.length) {
            status.textContent = '⚠️ Connected but 0 messages found. Make sure you are inside an open chat (not the home page).';
            status.style.color = 'orange';
            status.classList.remove('hidden');
            return;
        }

        await chrome.runtime.sendMessage({
            action:   'SAVE_SESSION',
            session:  resp.session,
            compress
        });

        status.textContent = `✅ Saved! ${resp.session.messages.length} messages captured.`;
        status.style.color = 'green';
        status.classList.remove('hidden');

    } catch (err) {
        if (err.message.includes('Receiving end does not exist')) {
            status.textContent = '❌ Please refresh the page then try again.';
        } else {
            status.textContent = `❌ Error: ${err.message}`;
        }
        status.style.color = 'red';
        status.classList.remove('hidden');
    }
});

// ─── Load sessions list ──────────────────────────────────────────────────────
async function loadSessions() {
    const { sessions } = await chrome.runtime.sendMessage({ action: 'GET_ALL_SESSIONS' });
    const list         = document.getElementById('sessions-list');

    if (!sessions.length) {
        list.innerHTML = '<p class="empty">No saved sessions yet.</p>';
        return;
    }

    list.innerHTML = sessions.map(s => `
        <div class="session-card" data-id="${s.id}">
            <div class="session-title">${s.title || 'Untitled'}</div>
            <div class="session-meta">${s.provider} · ${s.messages.length} messages · ${new Date(s.savedAt).toLocaleDateString()}</div>
            ${s.compressionMetadata ? `
            <div class="session-meta compression-info">
                🧠 Compressed: ${s.compressionMetadata.originalCount} → ${s.compressionMetadata.compressedCount} msgs
                (${s.compressionMetadata.episodeCount} episodes, ${s.compressionMetadata.strategy})
            </div>` : ''}
            ${s.redacted ? '<div class="session-meta redacted-badge">🔒 Sensitive data redacted</div>' : ''}
            <div class="session-actions">
                <select class="target-select" data-id="${s.id}">
                    <option value="">Transfer to...</option>
                    <optgroup label="Anthropic">
                        <option value="claude">Claude (new account)</option>
                    </optgroup>
                    <optgroup label="OpenAI">
                        <option value="chatgpt">ChatGPT</option>
                    </optgroup>
                    <optgroup label="Google">
                        <option value="gemini">Gemini</option>
                    </optgroup>
                    <optgroup label="xAI">
                        <option value="grok">Grok</option>
                    </optgroup>
                    <optgroup label="Other">
                        <option value="groq">Groq</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="perplexity">Perplexity</option>
                        <option value="mistral">Mistral (Le Chat)</option>
                        <option value="cohere">Cohere (Coral)</option>
                        <option value="meta">Meta AI</option>
                        <option value="copilot">Microsoft Copilot</option>
                        <option value="poe">Poe</option>
                    </optgroup>
                </select>
                <button class="btn small transfer-btn" data-id="${s.id}">🚀 Transfer</button>
                <button class="btn small danger delete-btn"   data-id="${s.id}">🗑️</button>
            </div>
        </div>
    `).join('');

    // Transfer buttons
    list.querySelectorAll('.transfer-btn').forEach(btn => {
        btn.addEventListener('click', () => transferSession(btn.dataset.id));
    });

    // Delete buttons — use secure 2-pass wipe via service worker
    list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await chrome.runtime.sendMessage({ action: 'DELETE_SESSION', id: btn.dataset.id });
            loadSessions();
        });
    });
}

// ─── Transfer a session to a target AI ──────────────────────────────────────
async function transferSession(id) {
    const card   = document.querySelector(`.session-card[data-id="${id}"]`);
    const target = card.querySelector('.target-select').value;
    if (!target) { alert('Please select a target model first.'); return; }

    let { session } = await chrome.runtime.sendMessage({ action: 'GET_SESSION', id });

    // ── Sensitive data guard ─────────────────────────────────────────────────
    const findings         = scanForSensitiveData(session);
    const grouped          = groupFindingsBySeverity(findings);
    const criticalFindings = grouped.critical;
    const highFindings     = grouped.high;

    if (criticalFindings.length > 0 || highFindings.length > 0) {
        const allSevere = [...criticalFindings, ...highFindings];
        const typeList  = [...new Set(allSevere.map(f => f.type))].join(', ');
        const totalHits = allSevere.reduce((n, f) => n + f.count, 0);

        const choice = confirm(
            `⚠️  SENSITIVE DATA DETECTED\n\n` +
            `Found ${totalHits} occurrence(s) of: ${typeList}\n\n` +
            `OK     → Auto-redact before transfer (recommended)\n` +
            `Cancel → Abort transfer`
        );

        if (!choice) {
            // User chose to abort — do not transfer
            const status = document.getElementById('transfer-status-' + id) ||
                           card.querySelector('.session-meta');
            return;
        }

        // Auto-redact before sending
        session = redactSensitiveData(session);

        console.log('ChatBridge [popup]: session redacted before transfer.', {
            types: typeList, count: totalHits
        });
    } else if (findings.length > 0) {
        // Medium findings — warn but don't block
        const mediumTypes = [...new Set(findings.map(f => f.type))].join(', ');
        console.warn(
            `ChatBridge [popup]: medium-severity data found (${mediumTypes}) — ` +
            `proceeding without redaction per user default.`
        );
    }

    // ── Build continuity prompt and open target tab ──────────────────────────
    const prompt = buildContinuityPrompt(session, { targetProvider: target });

    const URLS = {
        claude:     'https://claude.ai/new',
        chatgpt:    'https://chatgpt.com/',
        gemini:     'https://gemini.google.com/app',
        groq:       'https://groq.com/chat',
        deepseek:   'https://chat.deepseek.com/',
        perplexity: 'https://www.perplexity.ai/',
        mistral:    'https://chat.mistral.ai/chat',
        grok:       'https://grok.com/',
        cohere:     'https://coral.cohere.com/',
        meta:       'https://meta.ai/',
        copilot:    'https://copilot.microsoft.com/',
        poe:        'https://poe.com/'
    };

    chrome.runtime.sendMessage({
        action:         'TRANSFER_SESSION',
        target,
        url:            URLS[target],
        prompt,
        targetProvider: target  // passed to compressor for correct token limit
    });
}

// ─── Prompt enhancer ─────────────────────────────────────────────────────────
document.getElementById('enhance-btn').addEventListener('click', () => {
    const input = document.getElementById('enhance-input').value.trim();
    const mode  = document.getElementById('enhance-mode').value;
    if (!input) return;

    const TEMPLATES = {
        clarity: `Please execute the following task with extreme clarity and precision.

# Task
${input}

# Instructions
- Break down the response into simple, easy-to-understand terms.
- Avoid ambiguity, jargon, and ensure the core answer is straightforward.
- Provide concrete examples where necessary to ensure crystal-clear understanding.`,

        detailed: `Please execute the following task by providing a highly detailed and comprehensive response.

# Task
${input}

# Instructions
- Cover all relevant edge cases, nuances, and background context related to the topic.
- Provide step-by-step explanations and deep-dive into the underlying concepts.
- Anticipate potential follow-up questions and address them proactively.`,

        structured: `Please execute the following task. Format your response strictly according to the structure requested below.

# Task / Objective
${input}

# Guidelines
1. Be highly organized, logical, and systematic in your approach.
2. Use clear headings, bullet points, and markdown formatting for readability.
3. Ensure all constraints are respected.

# Desired Output Format
- **Executive Summary:** A brief 1-2 sentence overview.
- **Main Content:** The core answer or code, structured logically.
- **Key Takeaways / Conclusion:** A brief summary of the most important points.`,

        concise: `Please execute the following task as concisely and directly as possible.

# Task
${input}

# Instructions
- Eliminate all fluff, filler words, and conversational pleasantries.
- Get straight to the point immediately.
- Provide the absolute minimum text required to answer accurately and completely.`
    };

    const enhanced = TEMPLATES[mode];
    const output   = document.getElementById('enhanced-output');
    const copyBtn  = document.getElementById('copy-enhanced');

    output.textContent = enhanced;
    output.classList.remove('hidden');
    copyBtn.classList.remove('hidden');
});

document.getElementById('copy-enhanced').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('enhanced-output').textContent);
    document.getElementById('copy-enhanced').textContent = '✅ Copied!';
    setTimeout(() => {
        document.getElementById('copy-enhanced').textContent = '📋 Copy';
    }, 2000);
});

// ─── Wire up tab and settings button ─────────────────────────────────────────
document.querySelector('[data-tab="sessions"]').addEventListener('click', loadSessions);
document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});