// =========================================================================
// SereneMind Global Configuration (Unified Origin & Protocol Auto-Resolution)
// =========================================================================

(function initApiConfig() {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol;
    const hostname = window.location.hostname || 'localhost';
    const port = window.location.port;
    const host = window.location.host;

    let apiBase;
    if (port === '8000') {
        // Local dual-server setup: frontend on port 8000, API on port 5000
        apiBase = `${protocol}//${hostname}:5000/api`;
    } else if (port === '5000' || !port) {
        // Unified server (port 5000 or public tunneled domain like loca.lt/ngrok)
        apiBase = `${protocol}//${host}/api`;
    } else {
        apiBase = `${protocol}//${hostname}:5000/api`;
    }

    window.API_BASE_URL = apiBase;

    /** Resolve an /api/... path to the backend base URL (port 5000 in local dev). */
    window.apiUrl = function (path) {
        const base = window.API_BASE_URL || '/api';
        if (path.startsWith('/api/')) return base + path.slice(4);
        if (path.startsWith('/api')) return base;
        return base + (path.startsWith('/') ? path : '/' + path);
    };
})();
