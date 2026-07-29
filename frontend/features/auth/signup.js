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

    if (passVal !== confirmPassVal) {
        alert("Passwords do not match. Please verify your password entry.");
        return;
    }

    // Passwords match and fields are valid: directly submit the signup request
    fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameVal, email: emailVal, password: passVal })
    })
    .then(response => response.json().then(data => ({ status: response.status, ok: response.ok, data })))
    .then(({ status, ok, data }) => {
        if (ok || status === 201) {
            // Set current active user session details
            localStorage.setItem('currentUser', JSON.stringify({
                name: nameVal,
                username: data.user?.username || nameVal,
                email: emailVal,
                agreedToTerms: true,
                signupDate: new Date().toISOString()
            }));

            alert(`Sign Up Successful!\n\nWelcome to SereneMind, ${nameVal}. Your mental health monitoring logs are end-to-end encrypted and completely secure.`);
            
            // Redirect to home/dashboard
            window.location.href = '../../index.html';
        } else {
            alert('Sign up failed: ' + (data.message || 'Unknown error'));
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
        const response = await fetch('http://localhost:5000/api/auth/login_with_google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();
        if (response.ok) {
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
            alert('Google Login failed: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Backend server offline. Please ensure the backend server is running.');
    }
});
