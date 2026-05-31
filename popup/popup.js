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
  else if (url.includes('groq.com')) badge.textContent = '⚡ Groq';
  else if (url.includes('deepseek.com')) badge.textContent = '🐋 DeepSeek';
  else if (url.includes('perplexity.ai')) badge.textContent = '🧭 Perplexity';
  else if (url.includes('mistral.ai')) badge.textContent = '🌪️ Mistral';
  else if (url.includes('grok.com') || url.includes('x.com/i/grok')) badge.textContent = '✖️ Grok';
  else if (url.includes('cohere.com')) badge.textContent = '🌿 Cohere';
  else if (url.includes('meta.ai')) badge.textContent = '♾️ Meta AI';
  else if (url.includes('copilot.microsoft.com')) badge.textContent = '🤖 Copilot';
  else if (url.includes('poe.com')) badge.textContent = '👻 Poe';
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
    claude:     'https://claude.ai/new',
  chatgpt:    'https://chatgpt.com/',
  gemini:     'https://gemini.google.com/app',
  groq:       'https://groq.com/',
  deepseek:   'https://chat.deepseek.com/',
  perplexity: 'https://www.perplexity.ai/',
  mistral:    'https://chat.mistral.ai/',
  grok:       'https://grok.com/',
  cohere:     'https://coral.cohere.com/',
  meta:       'https://meta.ai/',
  copilot:    'https://copilot.microsoft.com/',
  poe:        'https://poe.com/'
  };

  // Delegate opening tab and injecting to background script
  chrome.runtime.sendMessage({
    action: 'TRANSFER_SESSION',
    target: target,
    url: URLS[target],
    prompt: prompt
  });
}

// Prompt enhancer
document.getElementById('enhance-btn').addEventListener('click', () => {
  const input = document.getElementById('enhance-input').value.trim();
  const mode = document.getElementById('enhance-mode').value;
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