import { saveSession, getAllSessions, getSession } from './session-manager.js';
import { compressSession } from './context-compressor.js';

const tabProviders = {};

chrome.runtime.onMessage.addListener((meg, sender, sendResponse) => {
    const tabId = sender.tab?.id;

    switch (msg.action) {
        case 'PROVIDER_DETECTED':
            tabProviders[tabId] = msg.provider;
            sendResponse({ ok: true });
            break;

        case 'OPEN_ENHANCER':
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
    }
});


async function handleSaveSession(session, shouldCompress = false) {
    let finalSession = session;

    if (shouldCompress && session.messages.length > 20) {
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