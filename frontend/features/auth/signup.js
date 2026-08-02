// Prevent pre-filled browser autofill values on page load
function clearSignupForm() {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.reset();
    const nameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const confirmPassInput = document.getElementById('confirmPassword');
    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';
}

document.addEventListener('DOMContentLoaded', clearSignupForm);
window.addEventListener('pageshow', clearSignupForm);

// Password visibility toggle logic
const togglePassword = document.querySelector('#togglePassword');
const password = document.querySelector('#password');
togglePassword.addEventListener('click', function () {
    const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
    password.setAttribute('type', type);
    this.style.fill = type === 'text' ? 'var(--primary)' : '#94a3b8';
});

// Confirm Password visibility toggle logic
const toggleConfirmPassword = document.querySelector('#toggleConfirmPassword');
const confirmPassword = document.querySelector('#confirmPassword');
toggleConfirmPassword.addEventListener('click', function () {
    const type = confirmPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    confirmPassword.setAttribute('type', type);
    this.style.fill = type === 'text' ? 'var(--primary)' : '#94a3b8';
});

// Approved email domains whitelist
const ALLOWED_EMAIL_DOMAINS = [
    'gmail.com',
    'outlook.com',
    'yahoo.com',
    'hotmail.com',
    'icloud.com',
    'live.com',
    'protonmail.com'
];

function validateEmailDomain(email) {
    if (!email || typeof email !== 'string') return false;
    const parts = email.trim().toLowerCase().split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const domain = parts[1];
    return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

function validatePasswordStrength(pwd) {
    if (pwd.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter.";
    if (!/[0-9]/.test(pwd)) return "Password must contain at least one number.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return "Password must contain at least one special character (!@#$%^&*).";
    return null;
}

// Select UI Elements
const signupForm = document.getElementById('signupForm');
const termsOverlay = document.getElementById('termsOverlay');
const agreeSecurityPolicy = document.getElementById('agreeSecurityPolicy');
const agreeTermsOfService = document.getElementById('agreeTermsOfService');
const acceptTermsBtn = document.getElementById('acceptTerms');
const declineTermsBtn = document.getElementById('declineTerms');

// Intercept signup submission
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const nameVal = document.getElementById('fullName').value.trim();
    const emailVal = document.getElementById('email').value.trim();
    const passVal = password.value;
    const confirmPassVal = confirmPassword.value;

    if (!nameVal || !emailVal || !passVal || !confirmPassVal) {
        alert("Please fill in all details.");
        return;
    }

    if (!validateEmailDomain(emailVal)) {
        alert("Please use a valid email from Gmail, Outlook, Yahoo, iCloud, or another supported provider.");
        return;
    }

    const pwdErr = validatePasswordStrength(passVal);
    if (pwdErr) {
        alert(`Weak Password:\n\n${pwdErr}`);
        return;
    }

    if (passVal !== confirmPassVal) {
        alert("Passwords do not match. Please verify your password entry.");
        return;
    }

    // Passwords match and fields are valid: directly submit the signup request
    fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameVal, email: emailVal, password: passVal })
    })
    .then(response => response.json().then(data => ({ status: response.status, ok: response.ok, data })))
    .then(({ status, ok, data }) => {
        if (ok || status === 201) {
            // Save authentication JWT token
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }

            // Set current active user session details
            localStorage.setItem('currentUser', JSON.stringify({
                name: nameVal,
                username: data.user?.username || nameVal,
                email: emailVal,
                agreedToTerms: true,
                signupDate: new Date().toISOString()
            }));

            alert(`Sign Up Successful!\n\nWelcome to SereneMind, ${nameVal}. Your session is authenticated and completely secure.`);
            
            // Redirect to home/dashboard
            window.location.href = '../../index.html';
        } else {
            alert('Sign up failed: ' + (data.error || data.message || 'Unknown error'));
        }
    })
    .catch(err => {
        console.error('Error during signup:', err);
        alert('Backend server offline. Please ensure the backend server is running.');
    });
});


// --- Google Offline Demo Modal Logic (Maintains parity with login.js behavior) ---
const triggerGoogleModalBtn = document.getElementById('triggerGoogleModal');
const googleDemoModal = document.getElementById('googleDemoModal');
const submitDemoEmailBtn = document.getElementById('submitDemoEmail');
const demoEmailInput = document.getElementById('demoEmailInput');

triggerGoogleModalBtn.addEventListener('click', () => {
    googleDemoModal.classList.add('active');
    demoEmailInput.value = '';
    setTimeout(() => demoEmailInput.focus(), 100);
});

googleDemoModal.addEventListener('click', (e) => {
    if (e.target === googleDemoModal) {
        googleDemoModal.classList.remove('active');
    }
});

submitDemoEmailBtn.addEventListener('click', async () => {
    const email = demoEmailInput.value.trim();
    
    if (email === "") {
        alert("Please enter an email address.");
        return;
    }

    try {
        const response = await fetch(apiUrl('/api/auth/login_with_google'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();
        if (response.ok) {
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }
            alert(`Login successful! Welcome ${data.user?.name || 'Google User'}`);
            localStorage.setItem('currentUser', JSON.stringify({
                name: data.user?.name || 'Google User',
                username: data.user?.username || 'Google User',
                email: email,
                agreedToTerms: true,
                signupDate: new Date().toISOString()
            }));
            
            googleDemoModal.classList.remove('active');
            window.location.href = '../../index.html';
        } else {
            alert('Google Login failed: ' + (data.error || data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Backend server offline. Please ensure the backend server is running.');
    }
});
