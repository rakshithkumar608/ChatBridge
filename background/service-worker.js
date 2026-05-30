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

        case 'TRANSFER_SESSION':
            chrome.tabs.create({ url: msg.url }, async (newTab) => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        setTimeout(async () => {
                            const settings = await chrome.storage.local.get('chatbridge_settings');
                            const autoSubmit = settings.chatbridge_settings?.autoSubmit || false;
                            
                            chrome.tabs.sendMessage(newTab.id, {
                                action: 'INJECT_PROMPT',
                                text: msg.prompt,
                                autoSubmit: autoSubmit
                            });
                        }, 2000); // Give page JS time to boot
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