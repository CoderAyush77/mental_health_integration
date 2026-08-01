// =========================================================================
// SereneMind Centralized Auth Guard & Logout Management System
// =========================================================================

/**
 * Helper to compute correct login page path based on current URL location.
 */
function getLoginUrl() {
    const path = window.location.pathname.toLowerCase();
    if (window.location.protocol === 'file:') {
        if (path.includes('/features/auth/')) {
            return 'login.html';
        } else if (path.includes('/features/')) {
            return '../auth/login.html';
        } else {
            return 'features/auth/login.html';
        }
    }
    // Web server HTTP/HTTPS execution: Absolute root path
    return '/features/auth/login.html';
}

/**
 * Destroys the current user session and purges all credentials.
 */
function handleLogout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    window.location.href = getLoginUrl();
}

/**
 * Checks if a valid session and token exist. Redirects immediately if missing or invalid.
 */
function checkAuthGuard() {
    const currentUserStr = localStorage.getItem('currentUser');
    const authTokenStr = localStorage.getItem('authToken');

    let isValid = false;

    if (currentUserStr && authTokenStr && 
        currentUserStr !== 'null' && currentUserStr !== 'undefined' && currentUserStr !== '{}' &&
        authTokenStr !== 'null' && authTokenStr !== 'undefined' && authTokenStr.trim().length > 5) {
        try {
            const userObj = JSON.parse(currentUserStr);
            if (userObj && typeof userObj === 'object' && (userObj.email || userObj.username || userObj.name)) {
                isValid = true;
            }
        } catch (e) {
            isValid = false;
        }
    }

    if (!isValid) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        sessionStorage.clear();
        window.location.href = getLoginUrl();
        return false;
    }
    return true;
}

function getAuthHeaders(extraHeaders = {}) {
    const token = localStorage.getItem('authToken') || '';
    return {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
        'ngrok-skip-browser-warning': 'true',
        ...extraHeaders,
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

if (typeof window !== 'undefined') {
    window.getAuthHeaders = getAuthHeaders;
}

// Immediately execute Auth Guard on page load for all protected routes
(function initAuthGuard() {
    const path = window.location.pathname.toLowerCase();
    // Skip guard for public authentication pages
    if (path.includes('login.html') || path.includes('signup.html')) {
        return;
    }
    checkAuthGuard();
})();

// Attach event listeners to all logout buttons and links on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const logoutElements = document.querySelectorAll('.logout-btn, .logout, a[href*="login.html"]');
    logoutElements.forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    });
});
