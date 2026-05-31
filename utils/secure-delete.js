// utils/secure-delete.js — Cryptographic-Quality Session Deletion
// Works with the encrypted storage layer (crypto-storage.js).
// Two-pass deletion:
//   Pass 1 — overwrite the target session's messages with random garbage
//   Pass 2 — remove the entry entirely and re-encrypt

import { encryptAndStore, decryptFromStore } from './crypto-storage.js';

const STORAGE_KEY = 'chatbridge_sessions';

// ─── Generate random hex garbage ────────────────────────────────────────────
function randomHex(bytes = 32) {
    return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
}

// ─── Secure-wipe a single session by ID ─────────────────────────────────────
export async function secureDeleteSession(id) {
    const sessions = (await decryptFromStore(STORAGE_KEY)) || {};
    if (!sessions[id]) return; // nothing to delete

    const msgCount = sessions[id].messages?.length || 0;

    // Pass 1 — overwrite with random garbage (encrypted, so even storage is noisy)
    sessions[id] = {
        id,
        messages: Array.from({ length: msgCount }, () => ({
            role:    'user',
            content: randomHex(32)
        })),
        _wiped:   true,
        _wipedAt: Date.now()
    };
    await encryptAndStore(STORAGE_KEY, sessions);

    // Pass 2 — remove the entry and re-encrypt without it
    delete sessions[id];
    await encryptAndStore(STORAGE_KEY, sessions);

    console.log(`ChatBridge [secure-delete]: session "${id}" wiped in 2 passes.`);
}

// ─── Wipe ALL sessions ──────────────────────────────────────────────────────
export async function secureDeleteAllSessions() {
    const sessions = (await decryptFromStore(STORAGE_KEY)) || {};
    const ids      = Object.keys(sessions);

    // Pass 1 — overwrite all at once
    ids.forEach(id => {
        const msgCount = sessions[id].messages?.length || 0;
        sessions[id] = {
            id,
            messages: Array.from({ length: msgCount }, () => ({
                role:    'user',
                content: randomHex(32)
            })),
            _wiped: true
        };
    });
    await encryptAndStore(STORAGE_KEY, sessions);

    // Pass 2 — delete the entire key
    await chrome.storage.local.remove(STORAGE_KEY);
    // Also remove the encryption salt so old data is permanently unrecoverable
    await chrome.storage.local.remove('chatbridge_salt');

    console.log(`ChatBridge [secure-delete]: ${ids.length} session(s) nuked.`);
}
