const REDACTED = '<redacted>';

const SENSITIVE_KEY_PATTERNS = Object.freeze([
    /authorization/i,
    /bearer/i,
    /api[-_]?key/i,
    /apikey/i,
    /access[-_]?token/i,
    /refresh[-_]?token/i,
    /client[-_]?secret/i,
    /provider[-_]?headers/i,
    /providerheaders/i,
    /openai.*(?:key|encrypted|salt|iv|cipher|plaintext)/i,
]);

const SECRET_STRING_PATTERNS = Object.freeze([
    /\bBearer\s+[A-Za-z0-9._~+/-]{8,}={0,2}\b/g,
    /\bsk-[A-Za-z0-9_-]{16,}\b/g,
    /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{16,}\b/g,
    /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g,
]);

function isSensitiveKey(key = '') {
    const text = String(key || '');
    return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(text));
}

function redactUrlSecrets(text = '') {
    return String(text || '')
        .replace(/(https?:\/\/)([^/@\s:]+):([^/@\s]+)@/gi, `$1${REDACTED}@`)
        .replace(/([?&](?:api[_-]?key|key|token|access_token|refresh_token|client_secret|authorization)=)([^&#\s]+)/gi, `$1${REDACTED}`);
}

function redactSecretStrings(text = '') {
    return SECRET_STRING_PATTERNS.reduce(
        (output, pattern) => output.replace(pattern, match => match.startsWith('Bearer ') ? `Bearer ${REDACTED}` : REDACTED),
        redactUrlSecrets(text)
    );
}

export function redactDiagnosticText(text = '') {
    return redactSecretStrings(String(text || ''));
}

export function redactDiagnosticValue(value, seen = new WeakSet()) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redactDiagnosticText(value);
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) {
        return value.map(item => redactDiagnosticValue(item, seen));
    }

    const output = {};
    for (const [key, nested] of Object.entries(value)) {
        output[key] = isSensitiveKey(key)
            ? REDACTED
            : redactDiagnosticValue(nested, seen);
    }
    return output;
}

export function stringifyRedactedDiagnostic(value, space = 2) {
    return JSON.stringify(redactDiagnosticValue(value), null, space);
}
