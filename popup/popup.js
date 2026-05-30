import { buildContinuityPrompt } from '../utils/continuity-prompt.js';

// Tab switching
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

// Detect provider of active tab
async function detectProvider() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const badge = document.getElementById('provider-badge');
  const url = tab.url || '';

  if (url.includes('claude.ai')) badge.textContent = '🟠 Claude';
  else if (url.includes('chatgpt.com') || url.includes('openai.com')) badge.textContent = '🟢 ChatGPT';
  else if (url.includes('gemini.google.com')) badge.textContent = '🔵 Gemini';
  else { badge.textContent = '⚠️ No AI detected'; badge.style.color = 'orange'; }
}

detectProvider();

// Capture button
document.getElementById('capture-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const compress = document.getElementById('compress-opt').checked;
  const status = document.getElementById('capture-status');

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { action: 'SCRAPE_CHAT' });

    if (!resp?.success) throw new Error('Scrape failed');

    await chrome.runtime.sendMessage({
      action: 'SAVE_SESSION',
      session: resp.session,
      compress
    });

    status.textContent = `✅ Saved! ${resp.session.messages.length} messages captured.`;
    status.style.color = 'green';
    status.classList.remove('hidden');
  } catch (err) {
    status.textContent = `❌ Error: ${err.message}`;
    status.style.color = 'red';
    status.classList.remove('hidden');
  }
});

// Load sessions list
async function loadSessions() {
  const { sessions } = await chrome.runtime.sendMessage({ action: 'GET_ALL_SESSIONS' });
  const list = document.getElementById('sessions-list');

  if (!sessions.length) { list.innerHTML = '<p class="empty">No saved sessions yet.</p>'; return; }

  list.innerHTML = sessions.map(s => `
    <div class="session-card" data-id="${s.id}">
      <div class="session-title">${s.title || 'Untitled'}</div>
      <div class="session-meta">${s.provider} · ${s.messages.length} messages · ${new Date(s.savedAt).toLocaleDateString()}</div>
      <div class="session-actions">
        <select class="target-select" data-id="${s.id}">
          <option value="">Transfer to...</option>
          <option value="claude">Claude (new account)</option>
          <option value="chatgpt">ChatGPT</option>
          <option value="gemini">Gemini</option>
        </select>
        <button class="btn small transfer-btn" data-id="${s.id}">🚀 Transfer</button>
        <button class="btn small danger delete-btn" data-id="${s.id}">🗑️</button>
      </div>
    </div>
  `).join('');

  // Transfer buttons
  list.querySelectorAll('.transfer-btn').forEach(btn => {
    btn.addEventListener('click', () => transferSession(btn.dataset.id));
  });

  // Delete buttons
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'DELETE_SESSION', id: btn.dataset.id });
      loadSessions();
    });
  });
}

async function transferSession(id) {
  const card = document.querySelector(`.session-card[data-id="${id}"]`);
  const target = card.querySelector('.target-select').value;
  if (!target) { alert('Please select a target model first.'); return; }

  const { session } = await chrome.runtime.sendMessage({ action: 'GET_SESSION', id });
  const prompt = buildContinuityPrompt(session, { targetProvider: target });

  const URLS = {
    claude: 'https://claude.ai/new',
    chatgpt: 'https://chat.openai.com/',
    gemini: 'https://gemini.google.com/app'
  };

  // Open new tab and inject after load
  const newTab = await chrome.tabs.create({ url: URLS[target] });

  // Wait for the new tab to finish loading then inject
  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId === newTab.id && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      setTimeout(() => {
        chrome.tabs.sendMessage(newTab.id, {
          action: 'INJECT_PROMPT',
          text: prompt,
          autoSubmit: false // Let user review before sending
        });
      }, 1500); // Give page JS time to boot
    }
  });
}

// Prompt enhancer
document.getElementById('enhance-btn').addEventListener('click', () => {
  const input = document.getElementById('enhance-input').value.trim();
  const mode = document.getElementById('enhance-mode').value;
  if (!input) return;

  const TEMPLATES = {
    clarity: `Rewrite the following prompt to be clearer and more specific, without changing the intent:\n\n"${input}"\n\nClearer version:`,
    detailed: `Expand this prompt with more detail and context:\n\n"${input}"`,
    structured: `Rewrite this as a well-structured prompt with clear objective, context, and desired output:\n\n"${input}"`,
    concise: `Make this prompt shorter and more direct while keeping all key information:\n\n"${input}"`
  };

  const enhanced = TEMPLATES[mode];
  const output = document.getElementById('enhanced-output');
  const copyBtn = document.getElementById('copy-enhanced');

  output.textContent = enhanced;
  output.classList.remove('hidden');
  copyBtn.classList.remove('hidden');
});

document.getElementById('copy-enhanced').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('enhanced-output').textContent);
  document.getElementById('copy-enhanced').textContent = '✅ Copied!';
  setTimeout(() => { document.getElementById('copy-enhanced').textContent = '📋 Copy'; }, 2000);
});

// Load sessions when sessions tab is clicked
document.querySelector('[data-tab="sessions"]').addEventListener('click', loadSessions);
document.getElementById('settings-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});