// utils/crypto-storage.js — Production-Grade Encrypted Storage
// Uses Web Crypto API (AES-GCM 256-bit) with PBKDF2 key derivation.
// The key is NEVER hardcoded — it is derived from the extension ID + a random salt.
// This means data encrypted on one installation cannot be decrypted on another.

const SALT_KEY  = 'chatbridge_salt';
const IV_LENGTH = 12; // GCM standard: 96-bit IV

// ─── Derive a persistent AES-GCM key from this extension installation ──────
async function getDerivedKey() {
    // Retrieve or generate a persistent random salt
    const saltData = await chrome.storage.local.get(SALT_KEY);
    let salt;

    if (saltData[SALT_KEY]) {
        salt = new Uint8Array(saltData[SALT_KEY]);
    } else {
        salt = crypto.getRandomValues(new Uint8Array(16));
        await chrome.storage.local.set({ [SALT_KEY]: Array.from(salt) });
    }

    // Use the extension's unique runtime ID as the base key material.
    // chrome.runtime.id is unique per installation, so this is NOT hardcoded.
    const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(chrome.runtime.id),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    // Derive a 256-bit AES-GCM key using PBKDF2 with 100,000 iterations
    // (brute-force resistant per NIST SP 800-132)
    return crypto.subtle.deriveKey(
        {
            name:       'PBKDF2',
            salt,
            iterations: 100000,
            hash:       'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,            // not exportable
        ['encrypt', 'decrypt']
    );
}

// ─── Encrypt data and store under storageKey ────────────────────────────────
export async function encryptAndStore(storageKey, data) {
    const key      = await getDerivedKey();
    const iv       = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded  = new TextEncoder().encode(JSON.stringify(data));

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
    );

    // Persist IV alongside the ciphertext (IV is not a secret)
    const payload = {
        iv:      Array.from(iv),
        data:    Array.from(new Uint8Array(encrypted)),
        version: 1   // reserved for future migration
    };

    await chrome.storage.local.set({ [storageKey]: payload });
}

// ─── Decrypt and return data stored under storageKey ───────────────────────
export async function decryptFromStore(storageKey) {
    const stored = await chrome.storage.local.get(storageKey);
    if (!stored[storageKey]) return null;

    const { iv, data } = stored[storageKey];
    const key = await getDerivedKey();

    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            key,
            new Uint8Array(data)
        );

        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (err) {
        // Decryption failure = data is corrupted or tampered with
        console.error('ChatBridge [crypto-storage]: decryption failed —', err.message);
        // Remove the corrupted entry to prevent infinite failures
        await chrome.storage.local.remove(storageKey);
        return null;
    }
}
