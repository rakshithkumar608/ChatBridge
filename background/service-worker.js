import { saveSession, getAllSessions, getSession } from './session-manager.js';
import { compressSession } from './context-compressor.js';

const tabProviders = {};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const tabId = sender.tab?.id;

    switch (msg.action) {
        case 'PROVIDER_DETECTED':
            tabProviders[tabId] = msg.provider;
            sendResponse({ ok: true });
            break;

        case 'SAVE_SESSION':
            handleSaveSession(msg.session, msg.compress).then(sendResponse);
            return true;

        case 'GET_ALL_SESSIONS':
            getAllSessions().then(sessions => sendResponse({ sessions }));
            return true;

        case 'GET_SESSION':
            getSession(msg.id).then(session => sendResponse({ session }));
            return true;

        case 'DELETE_SESSION':
            deleteSession(msg.id).then(() => sendResponse({ ok: true }));
            return true;

        case 'OPEN_ENHANCER':
            // Open the popup with enhancer tab active
            chrome.action.openPopup();
            sendResponse({ ok: true });
            break;

        case 'FETCH_CLAUDE_API':
            // Called by content script to bypass CSP — background can fetch freely
            fetchClaudeAPI(msg.conversationId).then(sendResponse);
            return true;

        case 'TRANSFER_SESSION':
            chrome.tabs.create({ url: msg.url }, async (newTab) => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);

                        // Inject with retry: try at 3s, then 5s, then 8s
                        // Some sites (Gemini, Groq) load React after page "complete"
                        const tryInject = (delay) => {
                            setTimeout(async () => {
                                const settings = await chrome.storage.local.get('chatbridge_settings');
                                const autoSubmit = settings.chatbridge_settings?.autoSubmit || false;

                                chrome.tabs.sendMessage(newTab.id, {
                                    action: 'INJECT_PROMPT',
                                    text: msg.prompt,
                                    autoSubmit: autoSubmit
                                }, (resp) => {
                                    if (chrome.runtime.lastError || !resp?.success) {
                                        // Silent retry — content script might not be ready yet
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
            sendResponse({ ok: true });
            break;
    }
});


async function handleSaveSession(session, shouldCompress = false) {
    let finalSession = session;
    const data = await chrome.storage.local.get('chatbridge_settings');
    const threshold = data.chatbridge_settings?.compressThreshold || 20;

    if (shouldCompress && session.messages.length > threshold) {
        finalSession = await compressSession(session);
    }

    const id = await saveSession(finalSession);
    return { success: true, id };
}

async function deleteSession(id) {
    const data = await chrome.storage.local.get('chatbridge_sessions');
    const sessions = data.chatbridge_sessions || {};
    delete sessions[id];
    await chrome.storage.local.set({ chatbridge_sessions: sessions });
}

async function fetchClaudeAPI(conversationId) {
    try {
        // Step 1: Get the org ID
        const orgRes = await fetch('https://claude.ai/api/organizations', {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        if (!orgRes.ok) return { success: false, error: `Org fetch failed: ${orgRes.status}` };
        const orgs = await orgRes.json();
        const orgId = orgs[0]?.uuid;
        if (!orgId) return { success: false, error: 'No org ID found' };

        // Step 2: Fetch the conversation tree
        const convRes = await fetch(
            `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true`,
            {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            }
        );
        if (!convRes.ok) return { success: false, error: `Conv fetch failed: ${convRes.status}` };
        const data = await convRes.json();

        // Step 3: Walk the message tree
        const chatMessages = data.chat_messages || [];
        const messageMap = new Map();
        chatMessages.forEach(msg => messageMap.set(msg.uuid, msg));

        const branch = [];
        let currentUuid = data.current_leaf_message_uuid;
        while (currentUuid && messageMap.has(currentUuid)) {
            const msg = messageMap.get(currentUuid);
            branch.unshift(msg);
            currentUuid = msg.parent_message_uuid;
        }

        const messages = [];
        branch.forEach(msg => {
            const role = msg.sender === 'human' ? 'user' : 'assistant';
            let content = '';
            if (Array.isArray(msg.content)) {
                content = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
            } else if (typeof msg.content === 'string') {
                content = msg.content;
            }
            if (content.trim()) messages.push({ role, content: content.trim(), timestamp: Date.now() });
        });

        return { success: true, messages };
    } catch (e) {
        return { success: false, error: e.message };
    }
}