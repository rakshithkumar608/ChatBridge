// background/session-manager.js — Encrypted Session Storage
// All session data is encrypted with AES-GCM 256-bit before being written to
// chrome.storage.local. Keys are derived via PBKDF2 — see utils/crypto-storage.js.
//
// NOTE: crypto-storage.js uses Web Crypto API which is available in service workers
// (Manifest V3 background scripts) and in extension pages, but NOT in content scripts.

import { encryptAndStore, decryptFromStore } from '../utils/crypto-storage.js';

const STORAGE_KEY = 'chatbridge_sessions';

// ─── Save a session (encrypted) ─────────────────────────────────────────────
export async function saveSession(session) {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Read the current encrypted sessions blob, decrypt it
    const sessions = (await decryptFromStore(STORAGE_KEY)) || {};

    sessions[id] = { ...session, id, savedAt: new Date().toISOString() };

    // Re-encrypt and persist
    await encryptAndStore(STORAGE_KEY, sessions);

    return id;
}

// ─── Get all sessions (decrypted), sorted newest first ──────────────────────
export async function getAllSessions() {
    const sessions = (await decryptFromStore(STORAGE_KEY)) || {};
    return Object.values(sessions).sort(
        (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
    );
}

// ─── Get a single session by ID ─────────────────────────────────────────────
export async function getSession(id) {
    const sessions = (await decryptFromStore(STORAGE_KEY)) || {};
    return sessions[id] || null;
}

// ─── Delete a session — raw removal (secure-delete.js does the wipe pass) ──
// This is the lightweight version; for a wiped delete use secureDeleteSession.
export async function deleteSessionRaw(id) {
    const sessions = (await decryptFromStore(STORAGE_KEY)) || {};
    delete sessions[id];
    await encryptAndStore(STORAGE_KEY, sessions);
}