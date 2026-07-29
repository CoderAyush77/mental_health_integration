document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard: Redirect to login if not authenticated
    const currentUserStr = localStorage.getItem('currentUser');
    if (!currentUserStr) {
        window.location.href = 'features/auth/login.html';
        return;
    }
    const currentUser = JSON.parse(currentUserStr);

    // Update user name in header
    const userNameElement = document.querySelector('.user-info strong');
    if (userNameElement && (currentUser.username || currentUser.name)) {
        userNameElement.textContent = currentUser.username || currentUser.name;
    }

    // 0. Static Daily Check-in Logic
    const daySelect = document.getElementById('daySelect');
    const moods = document.querySelectorAll('.mood');
    const feedbackBox = document.querySelector('.feedback-box');

    const feedbacks = {
        'Sad': { emoji: '🌿 It\'s okay to feel down.', text: 'Take a deep breath and be gentle with yourself today.' },
        'Neutral': { emoji: '🌿 Finding balance.', text: 'A calm mind is the foundation for a good day.' },
        'Calm': { emoji: '🌿 Peaceful and steady.', text: 'Hold onto this tranquility as you go about your day.' },
        'Happy': { emoji: '🌿 Great choice! 😉', text: 'Your positive mindset can make today amazing.' },
        'Very Happy': { emoji: '🌿 Radiant energy! ✨', text: 'Spread that joy to the people around you today.' }
    };

    if (moods && feedbackBox) {
        moods.forEach(mood => {
            mood.addEventListener('click', () => {
                // Remove 'selected' class from all moods
                moods.forEach(m => m.classList.remove('selected'));
                
                // Add 'selected' class to the clicked mood
                mood.classList.add('selected');
                
                // Update feedback box dynamically
                const moodNameElement = mood.querySelector('p');
                if (moodNameElement) {
                    const moodName = moodNameElement.textContent.trim();
                    const feedback = feedbacks[moodName];
                    if (feedback) {
                        feedbackBox.innerHTML = `<h4>${feedback.emoji}</h4><p>${feedback.text}</p>`;
                    }
                }
            });
        });
    }

    // 1. Fetch and Display User Streak
    const fetchUserStreak = async () => {
        const currentUserStr = localStorage.getItem('currentUser');
        if (!currentUserStr) return;
        const email = JSON.parse(currentUserStr).email;

        try {
            const response = await fetch(`http://localhost:5000/api/dashboard/streak/${encodeURIComponent(email)}`);
            const data = await response.json();
            
            if (response.ok) {
                const streakDisplay = document.getElementById('userStreakDisplay');
                if (streakDisplay) {
                    streakDisplay.textContent = `${data.streak || 0} Days`;
                }
            }
        } catch (error) {
            console.error('Error fetching user streak:', error);
        }
    };
    
    // Fetch streak on load
    fetchUserStreak();

    // 3. Logout Redirect Handlers
    const logoutBtns = document.querySelectorAll('.logout-btn, .logout');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'features/auth/login.html';
        });
    });

    // 4. Load and Render Journal History
    const journalHistoryList = document.getElementById('journalHistoryList');
    if (journalHistoryList) {
        const renderJournalHistory = async () => {
            const currentUserStr = localStorage.getItem('currentUser');
            if (!currentUserStr) return;
            const email = JSON.parse(currentUserStr).email;

            try {
                const response = await fetch(`http://localhost:5000/api/journal/${encodeURIComponent(email)}`, {
                    cache: 'no-store'
                });
                const data = await response.json();
                
                const entries = data.journals || [];
                
                if (entries.length === 0) {
                    journalHistoryList.innerHTML = `
                        <div class="no-history">
                            <div class="no-history-icon">📖</div>
                            <p>No journal entries logged yet.</p>
                            <a href="features/journal/journal.html" class="no-history-btn">
                                <i class="fa-solid fa-pen-to-square"></i> Write Your First Entry
                            </a>
                        </div>
                    `;
                } else {
                    // Show up to 3 most recent entries
                    const recentEntries = [...entries].reverse().slice(0, 3);
                    journalHistoryList.innerHTML = recentEntries.map(entry => {
                        const escapeHtml = (str) => {
                            if (!str) return '';
                            return str.replace(/&/g, '&amp;')
                                      .replace(/</g, '&lt;')
                                      .replace(/>/g, '&gt;')
                                      .replace(/"/g, '&quot;')
                                      .replace(/'/g, '&#039;');
                        };
                        const title = escapeHtml(entry.title || 'Untitled Reflection');
                        const cleanContent = entry.content || '';
                        const snippet = escapeHtml(cleanContent.length > 110 ? cleanContent.substring(0, 110) + '...' : cleanContent);
                        const date = escapeHtml(entry.date || 'Today');
                        
                        return `
                            <div class="history-card-wrapper" style="position:relative; margin-bottom: 10px;">
                                <a href="features/journal/journal.html" class="history-card-link" style="display:block;">
                                    <div class="history-item" style="padding-right: 40px;">
                                        <div class="history-header">
                                            <h4 class="history-title">${title}</h4>
                                            <span class="history-date">${date}</span>
                                        </div>
                                        <p class="history-content">${snippet}</p>
                                    </div>
                                </a>
                                <button class="delete-dashboard-journal" data-id="${entry._id}" style="position:absolute; top:20px; right:20px; background:none; border:none; color:#e53e3e; cursor:pointer; font-size:1.1em; z-index:10;" title="Delete Journal Entry">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        `;
                    }).join('');

                    // Attach event listeners for delete buttons
                    document.querySelectorAll('.delete-dashboard-journal').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const journalId = btn.getAttribute('data-id');
                            if (confirm("Are you sure you want to delete this journal entry?")) {
                                try {
                                    const res = await fetch(`http://localhost:5000/api/journal/${journalId}`, {
                                        method: "DELETE"
                                    });
                                    if (res.ok) {
                                        alert("Journal entry deleted successfully.");
                                        renderJournalHistory(); // Refresh the list
                                        if (typeof renderDashboardChart === 'function') renderDashboardChart(); // Refresh the chart if possible
                                    } else {
                                        alert("Failed to delete journal.");
                                    }
                                } catch (err) {
                                    console.error("Delete error:", err);
                                    alert("Error communicating with server.");
                                }
                            }
                        });
                    });
                }
            } catch (error) {
                console.error('Error fetching journal history:', error);
                journalHistoryList.innerHTML = `<p>Failed to load journal history.</p>`;
            }
        };

        renderJournalHistory();
    }

    // 5. Render Dashboard Stress Trend Line Chart (Last 7 Days)
    const dashboardCtx = document.getElementById('dashboardStressTrendLine');
    if (dashboardCtx) {
        const renderDashboardChart = async () => {
            const currentUserStr = localStorage.getItem('currentUser');
            if (!currentUserStr) return;
            const email = JSON.parse(currentUserStr).email;

            try {
                const response = await fetch(`http://localhost:5000/api/analytics/${encodeURIComponent(email)}`);
                const data = await response.json();
                
                if (response.ok && data.stress_trend) {
                    const days = data.stress_trend.days;
                    const textData = data.stress_trend.text;
                    const voiceData = data.stress_trend.voice;

                    new Chart(dashboardCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: days,
                datasets: [
                    {
                        label: "Voice",
                        data: voiceData,
                        borderColor: '#38a169',
                        backgroundColor: '#38a169',
                        pointBackgroundColor: '#38a169',
                        borderWidth: 2,
                        tension: 0,
                        spanGaps: true
                    },
                    {
                        label: "Text",
                        data: textData,
                        borderColor: '#805ad5',
                        backgroundColor: '#805ad5',
                        pointBackgroundColor: '#805ad5',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0,
                        spanGaps: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { bottom: 20 } },
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        min: 0.5,
                        max: 4.5,
                        ticks: {
                            stepSize: 1,
                            callback: function (value) {
                                if (value === 1) return 'Low';
                                if (value === 2) return 'Medium';
                                if (value === 3) return 'High';
                                if (value === 4) return 'Extreme';
                                return '';
                            },
                            color: function (context) {
                                if (context.tick.value === 1) return '#38a169'; 
                                if (context.tick.value === 2) return '#dd6b20'; 
                                if (context.tick.value === 3) return '#e53e3e'; 
                                if (context.tick.value === 4) return '#e53e3e'; 
                                return '#718096';
                            },
                            font: { weight: 'bold' }
                        },
                        grid: { color: '#edf2f7', drawBorder: false }
                    },
                    x: {
                        grid: { display: false, drawBorder: true, borderColor: '#cbd5e1' },
                        ticks: { color: '#718096' }
                    }
                }
            },
            plugins: [{
                id: 'customXAxisLabelDashboard',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.font = '11px Poppins, sans-serif';
                    ctx.textAlign = 'center';

                    const xAxis = chart.scales.x;
                    const yAxis = chart.scales.y;
                    const textY = yAxis.bottom + 35;
                    const textX = (xAxis.left + xAxis.right) / 2;

                    const part0 = "Extreme = 4 (Text), ";
                    const part1 = "High = 3, ";
                    const part2 = "Medium = 2, ";
                    const part3 = "Low = 1";

                    let currentX = textX - 140; 
                    
                    ctx.fillStyle = '#c53030'; 
                    ctx.fillText(part0, currentX + ctx.measureText(part0).width / 2, textY);
                    currentX += ctx.measureText(part0).width;

                    ctx.fillStyle = '#e53e3e'; 
                    ctx.fillText(part1, currentX + ctx.measureText(part1).width / 2, textY);
                    currentX += ctx.measureText(part1).width;

                    ctx.fillStyle = '#dd6b20'; 
                    ctx.fillText(part2, currentX + ctx.measureText(part2).width / 2, textY);
                    currentX += ctx.measureText(part2).width;

                    ctx.fillStyle = '#38a169'; 
                    ctx.fillText(part3, currentX + ctx.measureText(part3).width / 2, textY);
                    ctx.restore();
                }
            }]
        });
                }
            } catch (error) {
                console.error("Error fetching dashboard stress trend:", error);
            }
        };
        renderDashboardChart();
    }

});
    // 5. Sidebar Nav Toggle
    const navParent = document.querySelector(".nav-item-parent");
    const navSubmenu = document.querySelector(".nav-submenu");
    if (navParent && navSubmenu) {
        navParent.addEventListener("click", (e) => {
            e.preventDefault();
            const isHidden = navSubmenu.style.display === "none";
            navSubmenu.style.display = isHidden ? "flex" : "none";
            const icon = navParent.querySelector(".parent-icon");
            if (icon) {
                icon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
                icon.style.transition = "transform 0.2s";
            }
        });
    }

