// utils/sensitive-detector.js — Sensitive Data Detection & Redaction
// Scans sessions for PII / secrets before they leave the browser.
// Severity levels: 'critical' | 'high' | 'medium'

const SENSITIVE_PATTERNS = [
    {
        name:     'Credit Card',
        pattern:  /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
        severity: 'critical'
    },
    {
        name:     'API Key',
        // Matches common prefixes: OpenAI sk-/pk-, Google AIza, Bearer tokens
        pattern:  /\b(sk-|pk-|AIza|Bearer\s)[a-zA-Z0-9_\-]{20,}\b/g,
        severity: 'critical'
    },
    {
        name:     'Password Mention',
        pattern:  /\b(password|passwd|pwd)\s*[:=]\s*\S+/gi,
        severity: 'high'
    },
    {
        name:     'Private Key',
        pattern:  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
        severity: 'critical'
    },
    {
        name:     'AWS Access Key',
        pattern:  /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
        severity: 'critical'
    },
    {
        name:     'GitHub Token',
        pattern:  /\bghp_[a-zA-Z0-9]{36}\b/g,
        severity: 'critical'
    },
    {
        name:     'Email Address',
        pattern:  /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
        severity: 'medium'
    },
    {
        name:     'Phone Number',
        pattern:  /\b(\+\d{1,3}[\s\-])?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g,
        severity: 'medium'
    },
    {
        name:     'Aadhar / SSN',
        // Matches 12-digit Aadhar and 9-digit SSN patterns
        pattern:  /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
        severity: 'critical'
    },
    {
        name:     'IP Address',
        pattern:  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        severity: 'medium'
    }
];

// ─── Scan a session object for sensitive data ───────────────────────────────
// Returns an array of findings: { messageIndex, role, type, severity, count }
export function scanForSensitiveData(session) {
    const findings = [];

    session.messages.forEach((msg, msgIndex) => {
        SENSITIVE_PATTERNS.forEach(({ name, pattern, severity }) => {
            // Reset lastIndex for global regex (safe for multiple calls)
            pattern.lastIndex = 0;
            const matches = msg.content.match(pattern);
            if (matches) {
                findings.push({
                    messageIndex: msgIndex,
                    role:         msg.role,
                    type:         name,
                    severity,
                    count:        matches.length
                });
            }
        });
    });

    return findings;
}

// ─── Redact all sensitive data in-place ─────────────────────────────────────
// Returns a NEW session object (does not mutate the original).
export function redactSensitiveData(session) {
    return {
        ...session,
        messages: session.messages.map(msg => ({
            ...msg,
            content: SENSITIVE_PATTERNS.reduce((text, { pattern, name }) => {
                pattern.lastIndex = 0;
                return text.replace(pattern, `[REDACTED:${name}]`);
            }, msg.content)
        })),
        redacted: true
    };
}

// ─── Group findings by severity for UI display ──────────────────────────────
export function groupFindingsBySeverity(findings) {
    return {
        critical: findings.filter(f => f.severity === 'critical'),
        high:     findings.filter(f => f.severity === 'high'),
        medium:   findings.filter(f => f.severity === 'medium')
    };
}
