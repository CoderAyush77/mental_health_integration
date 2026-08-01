document.addEventListener('DOMContentLoaded', async () => {
    const currentUserStr = localStorage.getItem('currentUser');
    if (!currentUserStr) {
        alert("Please log in to access settings.");
        window.location.href = '../auth/login.html';
        return;
    }
    const email = JSON.parse(currentUserStr).email;

    // Elements
    const fullNameInput = document.getElementById('fullNameInput');
    const emailInput = document.getElementById('emailInput');
    const usernameInput = document.getElementById('usernameInput');
    
    const currentPasswordInput = document.getElementById('currentPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    
    const emailNotificationsToggle = document.getElementById('emailNotificationsToggle');
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    const saveBtn = document.querySelector('.btn-save');
    const deleteBtn = document.querySelector('.btn-delete');

    // 1. Fetch settings on load
    try {
        const response = await fetch(`/api/settings/${encodeURIComponent(email)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.ProfileInformation) {
                if (fullNameInput) fullNameInput.value = data.ProfileInformation.fullName || '';
                if (emailInput) emailInput.value = data.ProfileInformation.email || email;
                if (usernameInput) usernameInput.value = data.ProfileInformation.username || '';
            }
            if (data.preferences) {
                if (emailNotificationsToggle) emailNotificationsToggle.checked = !!data.preferences.email_notifications;
                if (darkModeToggle) {
                    darkModeToggle.checked = !!data.preferences.dark_mode;
                    if (data.preferences.dark_mode) {
                        document.documentElement.classList.add('dark-mode');
                        localStorage.setItem('darkMode', 'enabled');
                    } else {
                        document.documentElement.classList.remove('dark-mode');
                        localStorage.setItem('darkMode', 'disabled');
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
    }

    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.remove('ph-eye');
                this.classList.add('ph-eye-slash');
            } else {
                input.type = 'password';
                this.classList.remove('ph-eye-slash');
                this.classList.add('ph-eye');
            }
        });
    });

    // Dark Mode Toggle Logic (immediate visual update)
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                document.documentElement.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                document.documentElement.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    // Reminder Frequency Persistence (Local only as per contract)
    const reminderFrequency = document.getElementById('reminderFrequency');
    if (reminderFrequency) {
        const savedFreq = localStorage.getItem('reminderFrequency');
        if (savedFreq) {
            reminderFrequency.value = savedFreq;
        }
        reminderFrequency.addEventListener('change', () => {
            localStorage.setItem('reminderFrequency', reminderFrequency.value);
        });
    }

    // Save all changes when Save button is clicked
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="ph ph-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;

            try {
                // 1. Update Profile & Preferences
                const updateRes = await fetch('/api/settings/update', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        fullName: fullNameInput ? fullNameInput.value.trim() : '',
                        username: usernameInput ? usernameInput.value.trim() : '',
                        email_notifications: emailNotificationsToggle ? emailNotificationsToggle.checked : true,
                        dark_mode: darkModeToggle ? darkModeToggle.checked : false
                    })
                });

                if (!updateRes.ok) {
                    throw new Error('Failed to update profile settings.');
                }

                // 2. Change Password (if fields are filled)
                const currentPwd = currentPasswordInput ? currentPasswordInput.value : '';
                const newPwd = newPasswordInput ? newPasswordInput.value : '';
                const confirmPwd = confirmPasswordInput ? confirmPasswordInput.value : '';

                if (currentPwd || newPwd || confirmPwd) {
                    if (newPwd !== confirmPwd) {
                        alert("New passwords do not match.");
                    } else if (!currentPwd || !newPwd) {
                        alert("Please fill in both current and new password fields.");
                    } else {
                        const pwdRes = await fetch('/api/settings/change-password', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: email,
                                current_password: currentPwd,
                                new_password: newPwd
                            })
                        });
                        if (!pwdRes.ok) {
                            const errData = await pwdRes.json();
                            alert('Password update failed: ' + (errData.message || 'Unknown error'));
                        } else {
                            if (currentPasswordInput) currentPasswordInput.value = '';
                            if (newPasswordInput) newPasswordInput.value = '';
                            if (confirmPasswordInput) confirmPasswordInput.value = '';
                            alert("Password updated successfully.");
                        }
                    }
                }

                saveBtn.innerHTML = '<i class="ph ph-check-circle"></i> Saved!';
                setTimeout(() => {
                    saveBtn.innerHTML = originalText;
                    saveBtn.disabled = false;
                }, 2000);

                // Update current user in local storage if name changed
                const currentUser = JSON.parse(localStorage.getItem('currentUser'));
                currentUser.name = fullNameInput ? fullNameInput.value.trim() : currentUser.name;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

            } catch (error) {
                console.error("Error saving settings:", error);
                alert("An error occurred while saving settings.");
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        });
    }

    // Delete Account Logic
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const pwd = prompt("Please enter your password to confirm account deletion:");
            if (!pwd) return;

            if (confirm("Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
                try {
                    const response = await fetch('/api/settings/delete', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email, password: pwd })
                    });
                    
                    if (response.ok) {
                        alert("Account deleted successfully.");
                        localStorage.clear();
                        window.location.href = '../auth/login.html';
                    } else {
                        const data = await response.json();
                        alert("Failed to delete account: " + (data.message || 'Incorrect password'));
                    }
                } catch (error) {
                    console.error("Error deleting account:", error);
                    alert("An error occurred while deleting the account.");
                }
            }
        });
    }
});