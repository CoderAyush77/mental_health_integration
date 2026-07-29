// Existing Password Toggle Logic
        const togglePassword = document.querySelector('#togglePassword');
        const password = document.querySelector('#password');
        togglePassword.addEventListener('click', function () {
            const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
            password.setAttribute('type', type);
            this.style.fill = type === 'text' ? 'var(--primary)' : '#94a3b8';
        });

        // Existing Standard Login Submit with Frontend LocalStorage Integration
        const loginForm = document.querySelector('#loginForm');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.querySelector('#email').value.trim();
            const passValue = document.querySelector('#password').value;

            try {
                const response = await fetch('http://localhost:5000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password: passValue }),
                });

                const data = await response.json();
                if (response.ok) {
                    alert('Login successful!');
                    localStorage.setItem('currentUser', JSON.stringify({
                        name: data.user?.name || 'User',
                        username: data.user?.username || 'User',
                        email
                    }));
                    window.location.href = '../../index.html';
                } else {
                    alert('Login failed: ' + (data.message || 'Invalid credentials'));
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Backend server offline. Please ensure the backend server is running.');
            }
        });

        // --- New Modal & Offline Demo Mechanism ---
        const triggerGoogleModalBtn = document.getElementById('triggerGoogleModal');
        const googleDemoModal = document.getElementById('googleDemoModal');
        const submitDemoEmailBtn = document.getElementById('submitDemoEmail');
        const demoEmailInput = document.getElementById('demoEmailInput');

        // Open Modal
        triggerGoogleModalBtn.addEventListener('click', () => {
            googleDemoModal.classList.add('active');
            // Auto-focus input for convenience
            setTimeout(() => demoEmailInput.focus(), 100);
        });

        // Close Modal if clicking outside the card
        googleDemoModal.addEventListener('click', (e) => {
            if (e.target === googleDemoModal) {
                googleDemoModal.classList.remove('active');
            }
        });

        // Handle Submit Demo Action (Matches Video Behavior)
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
                        email: email
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