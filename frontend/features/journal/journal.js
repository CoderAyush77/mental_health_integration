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
    // Match the backend's "YYYY-MM-DD" UTC date format
    const formattedDate = today.toISOString().split('T')[0];

    const getHeaders = (extra = {}) => window.getAuthHeaders ? window.getAuthHeaders(extra) : { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || ''), ...extra };

    let hasWrittenJournalToday = false;
    let hasWrittenVoiceToday = false;
    try {
        const response = await fetch(apiUrl(`/api/dashboard/daily_checkin_status/${encodeURIComponent(email)}`), {
            headers: getHeaders(),
            cache: 'no-store'
        });
        if (response.ok) {
            const statusData = await response.json();
            hasWrittenJournalToday = !!statusData.has_journal;
            hasWrittenVoiceToday = !!statusData.has_voice;
        }
    } catch (error) {
        console.error('Error fetching daily check-in status:', error);
    }

    if (hasWrittenJournalToday || hasWrittenVoiceToday) {
        if (titleInput) {
            titleInput.disabled = true;
            titleInput.value = hasWrittenVoiceToday 
                ? "Daily Check-in Complete (Voice Reflection Used)" 
                : "Daily Check-in Complete (Journal Used)";
        }
        if (contentInput) {
            contentInput.disabled = true;
            contentInput.value = hasWrittenVoiceToday
                ? "You have already completed your daily check-in today using Voice Reflection! Since you chose Voice Reflection today, Journal Writing is locked until tomorrow. Great job staying consistent!"
                : "You have already written your journal entry for today! Great job staying consistent with your mindfulness routine. Come back tomorrow to write again.";
        }
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.innerHTML = hasWrittenVoiceToday
                ? '<i class="fa-solid fa-lock"></i> Completed via Voice Reflection'
                : '<i class="fa-solid fa-lock"></i> Completed via Journal';
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
                    const response = await fetch(apiUrl('/api/journal/create'), {
                        method: 'POST',
                        headers: getHeaders({ 'Content-Type': 'application/json' }),
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
