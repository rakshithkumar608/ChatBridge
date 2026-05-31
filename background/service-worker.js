// background/service-worker.js — ChatBridge Background Service Worker
// Handles all message passing between popup, content scripts, and storage.
// Now uses:
//   • Advanced semantic-hierarchical compression (context-compressor.js)
//   • Encrypted session storage (session-manager.js → crypto-storage.js)
//   • Two-pass secure deletion (secure-delete.js)

import { saveSession, getAllSessions, getSession } from './session-manager.js';
import { compressSession }                          from './context-compressor.js';
import { secureDeleteSession }                      from '../utils/secure-delete.js';

const tabProviders = {};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const tabId = sender.tab?.id;

    switch (msg.action) {

        // ── Provider detection from content scripts ─────────────────────────
        case 'PROVIDER_DETECTED':
            tabProviders[tabId] = msg.provider;
            sendResponse({ ok: true });
            break;

        // ── Save (and optionally compress) a captured session ───────────────
        case 'SAVE_SESSION':
            handleSaveSession(msg.session, msg.compress, msg.targetProvider)
                .then(sendResponse);
            return true;

        // ── Return all stored sessions ──────────────────────────────────────
        case 'GET_ALL_SESSIONS':
            getAllSessions().then(sessions => sendResponse({ sessions }));
            return true;

        // ── Return a single session by ID ───────────────────────────────────
        case 'GET_SESSION':
            getSession(msg.id).then(session => sendResponse({ session }));
            return true;

        // ── Secure-delete a session (2-pass wipe) ───────────────────────────
        case 'DELETE_SESSION':
            secureDeleteSession(msg.id).then(() => sendResponse({ ok: true }));
            return true;

        // ── Open the popup programmatically ─────────────────────────────────
        case 'OPEN_ENHANCER':
            chrome.action.openPopup();
            sendResponse({ ok: true });
            break;

        // ── Proxy Claude API calls from content scripts (bypasses CSP) ──────
        case 'FETCH_CLAUDE_API':
            fetchClaudeAPI(msg.conversationId).then(sendResponse);
            return true;

        // ── Open target AI tab and inject the continuity prompt ─────────────
        case 'TRANSFER_SESSION':
            handleTransfer(msg);
            sendResponse({ ok: true });
            break;
    }
});

// ─── Save + optional advanced compression ───────────────────────────────────
async function handleSaveSession(session, shouldCompress = false, targetProvider) {
    let finalSession = session;

    const data      = await chrome.storage.local.get('chatbridge_settings');
    const settings  = data.chatbridge_settings || {};
    const threshold = settings.compressThreshold || 20;
    // If a targetProvider is known, use it; otherwise use the most-restrictive
    // limit as the conservative default
    const provider  = targetProvider || session.provider || 'groq';

    if (shouldCompress && session.messages.length > threshold) {
        console.log(
            `ChatBridge [service-worker]: compressing ${session.messages.length} msgs ` +
            `for provider "${provider}"`
        );
        finalSession = await compressSession(session, provider);
        console.log(
            `ChatBridge [service-worker]: compressed to ` +
            `${finalSession.messages.length} msgs`
        );
    }

    const id = await saveSession(finalSession);
    return { success: true, id };
}

// ─── Open a new tab, wait for it to load, then inject the prompt ─────────────
function handleTransfer(msg) {
    chrome.tabs.create({ url: msg.url }, async (newTab) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === newTab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);

                // Retry strategy: 3 s, 5.5 s, 9 s
                // Some SPAs (Gemini, Groq) render their input after "complete"
                const tryInject = (delay) => {
                    setTimeout(async () => {
                        const settings  = await chrome.storage.local.get('chatbridge_settings');
                        const autoSubmit = settings.chatbridge_settings?.autoSubmit || false;

                        chrome.tabs.sendMessage(newTab.id, {
                            action:     'INJECT_PROMPT',
                            text:       msg.prompt,
                            autoSubmit
                        }, (resp) => {
                            if (chrome.runtime.lastError || !resp?.success) {
                                // Silent — content script may not be ready yet
                            }
                        });
                    }, delay);
                };

                tryInject(3000);
                tryInject(5500);
                tryInject(9000);
            }
        });
    });
}

// ─── Fetch Claude conversation via API (background bypasses page CSP) ────────
async function fetchClaudeAPI(conversationId) {
    try {
        // 1. Get the org UUID
        const orgRes = await fetch('https://claude.ai/api/organizations', {
            credentials: 'include',
            headers:     { 'Accept': 'application/json' }
        });
        if (!orgRes.ok) return { success: false, error: `Org fetch failed: ${orgRes.status}` };

        const orgs  = await orgRes.json();
        const orgId = orgs[0]?.uuid;
        if (!orgId) return { success: false, error: 'No org ID found' };

        // 2. Fetch the conversation tree
        const convRes = await fetch(
            `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}` +
            `?tree=True&rendering_mode=messages&render_all_tools=true`,
            {
                credentials: 'include',
                headers:     { 'Accept': 'application/json' }
            }
        );
        if (!convRes.ok) return { success: false, error: `Conv fetch failed: ${convRes.status}` };

        const data = await convRes.json();

        // 3. Walk the message tree to reconstruct the active branch
        const chatMessages = data.chat_messages || [];
        const messageMap   = new Map();
        chatMessages.forEach(m => messageMap.set(m.uuid, m));

        const branch = [];
        let currentUuid = data.current_leaf_message_uuid;
        while (currentUuid && messageMap.has(currentUuid)) {
            const m = messageMap.get(currentUuid);
            branch.unshift(m);
            currentUuid = m.parent_message_uuid;
        }

        const messages = [];
        branch.forEach(m => {
            const role = m.sender === 'human' ? 'user' : 'assistant';
            let content = '';
            if (Array.isArray(m.content)) {
                content = m.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
            } else if (typeof m.content === 'string') {
                content = m.content;
            }
            if (content.trim()) {
                messages.push({ role, content: content.trim(), timestamp: Date.now() });
            }
        });

        return { success: true, messages };

    } catch (e) {
        return { success: false, error: e.message };
    }
}