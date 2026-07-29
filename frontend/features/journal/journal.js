document.addEventListener('DOMContentLoaded', async () => {
    const titleInput = document.getElementById('entryTitle');
    const contentInput = document.getElementById('entryContent');
    const createBtn = document.getElementById('createEntryBtn');

    const currentUserStr = localStorage.getItem('currentUser');
    if (!currentUserStr) {
        alert("Please log in to use the journal.");
        window.location.href = '../features/auth/login.html';
        return;
    }
    const email = JSON.parse(currentUserStr).email;

    // Enforce 1 journal entry per day limit
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });

    let hasWrittenToday = false;
    try {
        const response = await fetch(`http://localhost:5000/api/journal/${encodeURIComponent(email)}`, {
            cache: 'no-store'
        });
        if (response.ok) {
            const data = await response.json();
            const entries = data.journals || [];
            // Backend might send dates in a different format, adjust if necessary, but this matches offline logic
            hasWrittenToday = entries.some(entry => entry.date === formattedDate);
        }
    } catch (error) {
        console.error('Error fetching journals:', error);
    }

    if (hasWrittenToday) {
        if (titleInput) {
            titleInput.disabled = true;
            titleInput.value = "Daily Check-in Complete";
        }
        if (contentInput) {
            contentInput.disabled = true;
            contentInput.value = "You have already written your journal entry for today! Great job staying consistent with your mindfulness routine. Come back tomorrow to write again.";
        }
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Come Back Tomorrow';
            createBtn.style.opacity = '0.6';
            createBtn.style.cursor = 'not-allowed';
        }
    } else {
        // Auto-fill from Voice Reflection if data exists
        const tempTitle = localStorage.getItem('tempJournalTitle');
        const tempContent = localStorage.getItem('tempJournalContent');
        if (tempTitle && titleInput) {
            titleInput.value = tempTitle;
            localStorage.removeItem('tempJournalTitle');
        }
        if (tempContent && contentInput) {
            contentInput.value = tempContent;
            localStorage.removeItem('tempJournalContent');
        }

        if (createBtn) {
            createBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const titleVal = titleInput ? titleInput.value.trim() : '';
                const contentVal = contentInput ? contentInput.value.trim() : '';

                if (!titleVal || !contentVal) {
                    alert('Please enter both a title and some reflections for your journal entry.');
                    return;
                }

                try {
                    const response = await fetch('http://localhost:5000/api/journal/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, title: titleVal, content: contentVal })
                    });

                    const data = await response.json();

                    if (response.ok || response.status === 201) {
                        // Clear form
                        if (titleInput) titleInput.value = '';
                        if (contentInput) contentInput.value = '';

                        alert('Your journal entry has been created successfully!');
                        window.location.href = '../../index.html';
                    } else {
                        alert('Failed to create journal entry: ' + (data.message || 'Unknown error'));
                    }
                } catch (error) {
                    console.error('Error creating journal:', error);
                    alert('Backend server offline. Please ensure the backend server is running.');
                }
            });
        }
    }
});
