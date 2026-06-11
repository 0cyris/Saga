/**
 * Extension UI/runtime constants for Saga.
 */

/**
 * The extension folder name under data/default-user/extensions/third-party/.
 * Must match the installed folder name exactly for renderExtensionTemplateAsync.
 */
export const EXTENSION_FOLDER = 'third-party/Saga';

/**
 * Dynamically detects the actual installed extension folder from the script src.
 * Falls back to EXTENSION_FOLDER if detection fails.
 * @param {string} [fallback] - Folder to use if detection fails
 * @returns {string} The detected extension folder path
 */
export function detectExtensionFolder(fallback = EXTENSION_FOLDER) {
    try {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        // Match the actual script location instead of assuming a fixed folder name.
        for (const script of scripts) {
            const rawSrc = script?.src || '';
            if (!/saga/i.test(rawSrc) || !rawSrc.includes('/third-party/')) continue;
            const url = new URL(rawSrc, document.baseURI);
            const match = url.pathname.match(/third-party\/([^/]+)\//);
            if (match?.[1]) {
                return `third-party/${decodeURIComponent(match[1])}`;
            }
        }
    } catch (e) {
        // Silently fall through.
    }
    return fallback;
}

export const LOG_PREFIX = '[Saga]';
