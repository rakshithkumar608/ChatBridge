const STORAGE_KEY = 'chatbridge_sessions';

export async function saveSession(session) {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const sessions = data[STORAGE_KEY] || {};


    sessions[id] = { ...session, id, savedAt: new Date().toISOString() };
    await chrome.storage.local.set({ [STORAGE_KEY]: sessions });
    return id;
}

export async function getAllSession() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const sessions = data[STORAGE_KEY] || {};
    // Return sorted newest first
    return Object.values(sessions).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

export async function getSession(id) {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY]?.[id] || null;
}