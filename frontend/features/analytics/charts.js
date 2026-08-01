document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // Configuration
    // ==========================================
    const currentUserStr = localStorage.getItem("currentUser");
    const email = currentUserStr ? JSON.parse(currentUserStr).email : null;

    if (!email) {
        alert("Please login first.");
        window.location.href = "../auth/login.html"; // Assumes we are in frontend/features/analytics
        return;
    }

    const API_BASE = `/api/analytics`;

    // ==========================================
    // Header Date
    // ==========================================
    const headerDateSpan = document.getElementById("headerDateSpan");
    if (headerDateSpan) {
        const today = new Date();
        headerDateSpan.textContent = today.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    // ==========================================
    // Global Variables
    // ==========================================
    let dashboardData = null;
    let donutChart = null;
    let trendChart = null;

    const emotionLabels = [
        "anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"
    ];

    const emotionColors = [
        "#e53e3e", "#718096", "#dd6b20", "#38a169", "#3182ce", "#805ad5", "#d53f8c"
    ];

    // ==========================================
    // Initialization: Emotion Doughnut Chart
    // ==========================================
    const emotionCtx = document.getElementById("emotionDonut").getContext("2d");
    donutChart = new Chart(emotionCtx, {
        type: "doughnut",
        data: {
            labels: emotionLabels,
            datasets: [{
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: emotionColors,
                borderWidth: 0,
                cutout: "70%"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return `${context.label}: ${context.parsed}`;
                        }
                    }
                }
            }
        }
    });

    // ==========================================
    // Custom Legend
    // ==========================================
    function renderLegend(values) {
        const legend = document.getElementById("donutLegend");
        legend.innerHTML = "";
        emotionLabels.forEach((label, index) => {
            const row = document.createElement("div");
            row.className = "legend-row";
            row.innerHTML = `
                <div class="legend-label">
                    <span class="legend-dot" style="background:${emotionColors[index]}"></span>
                    ${label}
                </div>
                <div class="legend-val">
                    ${Number(values[index]).toFixed(4)}
                </div>
            `;
            legend.appendChild(row);
        });
    }
    renderLegend([0, 0, 0, 0, 0, 0, 0]);

    // ==========================================
    // Load Text Analysis
    // ==========================================
    async function loadTextAnalysis(id) {
        if (!id) return;
        try {
            const headers = window.getAuthHeaders ? window.getAuthHeaders() : { 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '') };
            const response = await fetch(`${API_BASE}/${email}/analysis?type=text&id=${id}`, { headers });
            const data = await response.json();

            // Stress Level
            const stress = document.getElementById("textStressVal");
            stress.textContent = data.stress || "Unknown";
            stress.className = "metric-val";

            if (data.stress === "Low") {
                stress.classList.add("color-green");
            } else if (data.stress === "Medium" || data.stress === "Moderate") {
                stress.classList.add("color-orange");
            } else {
                stress.classList.add("color-red");
            }

            // Emotion Doughnut
            const emotionsObj = data.emotions || {};
            const emotionData = emotionLabels.map(label =>
                Number(emotionsObj[label] || 0).toFixed(4)
            );

            donutChart.data.datasets[0].data = emotionData;
            donutChart.update();
            renderLegend(emotionData);

            // Recommendation
            if (data.recommendation) {
                document.getElementById("textRecText1").textContent = data.recommendation.text || "";
                if (data.recommendation.link) {
                    document.getElementById("textRecText2").innerHTML = `<a href="${data.recommendation.link}" style="color: var(--primary);">${data.recommendation.linkText}</a>`;
                } else {
                    document.getElementById("textRecText2").textContent = "";
                }
            }


        } catch (err) {
            console.error("Text Analysis Error:", err);
        }
    }

    // ==========================================
    // Load Voice Analysis
    // ==========================================
    async function loadVoiceAnalysis(id) {
        if (!id) return;
        try {
            const headers = window.getAuthHeaders ? window.getAuthHeaders() : { 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '') };
            const response = await fetch(`${API_BASE}/${email}/analysis?type=voice&id=${id}`, { headers });
            const data = await response.json();

            // Stress Level
            const stress = document.getElementById("voiceStressVal");
            stress.textContent = data.stress || "Unknown";
            stress.className = "metric-badge";

            if (data.stress === "Low") {
                stress.classList.add("bg-green-light", "color-green");
            } else {
                stress.classList.add("badge-red");
            }

            // Confidence
            document.getElementById("voiceConfidenceVal").textContent =
                `${Math.round(data.confidence || 0)}%`;

            // Positivity
            document.getElementById("voicePositivityVal").textContent =
                `${Math.round(data.positivity || 0)}/100`;

            // Recommendation
            if (data.recommendation) {
                document.getElementById("voiceRecText1").textContent = data.recommendation.text || "";
                if (data.recommendation.link) {
                    document.getElementById("voiceRecText2").innerHTML = `<a href="${data.recommendation.link}" style="color: var(--primary);">${data.recommendation.linkText}</a>`;
                } else {
                    document.getElementById("voiceRecText2").textContent = "";
                }
            }

        } catch (err) {
            console.error("Voice Analysis Error:", err);
        }
    }

    // ==========================================
    // Initialization: Stress Trend Line Chart
    // ==========================================
    const trendCtx = document.getElementById("stressTrendLine").getContext("2d");
    trendChart = new Chart(trendCtx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Voice",
                    data: [],
                    borderColor: "#38a169",
                    backgroundColor: "#38a169",
                    pointBackgroundColor: "#38a169",
                    borderWidth: 2,
                    tension: 0,
                    spanGaps: true
                },
                {
                    label: "Text",
                    data: [],
                    borderColor: "#805ad5",
                    backgroundColor: "#805ad5",
                    pointBackgroundColor: "#805ad5",
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
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    min: 0.5,
                    max: 4.5,
                    ticks: {
                        stepSize: 1,
                        callback: function (value) {
                            if (value === 1) return "Low";
                            if (value === 2) return "Medium";
                            if (value === 3) return "High";
                            if (value === 4) return "Extreme";
                            return "";
                        },
                        color: function (context) {
                            if (context.tick.value === 1) return "#38a169";
                            if (context.tick.value === 2) return "#dd6b20";
                            if (context.tick.value === 3) return "#e53e3e";
                            if (context.tick.value === 4) return "#e53e3e";
                            return "#718096";
                        },
                        font: { weight: "bold" }
                    },
                    grid: { color: "#edf2f7", drawBorder: false }
                },
                x: {
                    grid: { display: false, drawBorder: true, borderColor: "#cbd5e1" },
                    ticks: { color: "#718096" }
                }
            }
        },
        plugins: [{
            id: "customXAxisLabel",
            afterDraw(chart) {
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = "11px Poppins";
                ctx.textAlign = "center";

                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;

                const textY = yAxis.bottom + 35;
                const textX = (xAxis.left + xAxis.right) / 2;

                const part0 = "Extreme = 4 (Text), ";
                const part1 = "High = 3, ";
                const part2 = "Medium = 2, ";
                const part3 = "Low = 1";

                let currentX = textX - 140;

                ctx.fillStyle = "#c53030";
                ctx.fillText(part0, currentX + ctx.measureText(part0).width / 2, textY);
                currentX += ctx.measureText(part0).width;

                ctx.fillStyle = "#e53e3e";
                ctx.fillText(part1, currentX + ctx.measureText(part1).width / 2, textY);
                currentX += ctx.measureText(part1).width;

                ctx.fillStyle = "#dd6b20";
                ctx.fillText(part2, currentX + ctx.measureText(part2).width / 2, textY);
                currentX += ctx.measureText(part2).width;

                ctx.fillStyle = "#38a169";
                ctx.fillText(part3, currentX + ctx.measureText(part3).width / 2, textY);
                ctx.restore();
            }
        }]
    });

    // ==========================================
    // Fetch Main Dashboard Data
    // ==========================================
    const loadDashboardData = async () => {
        try {
            const headers = window.getAuthHeaders ? window.getAuthHeaders() : { 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '') };
            const response = await fetch(`${API_BASE}/${email}`, { headers, cache: 'no-store' });
            dashboardData = await response.json();

            // 1. Update Summary Cards
            if (dashboardData.summary) {
                // The user specifically noted "total entries means total journal entries only"
                // The backend API handles this, as total_entries is len(text_entries).
                document.getElementById('totalEntriesVal').textContent = dashboardData.summary.total_entries || 0;
                document.getElementById('voiceEntriesVal').textContent = dashboardData.summary.voice_entries || 0;
                if (dashboardData.summary.highest_stress) {
                    document.getElementById('highestStressVal').textContent = dashboardData.summary.highest_stress.level || "N/A";
                    document.getElementById('highestStressDate').textContent = dashboardData.summary.highest_stress.date || "N/A";
                }
            }

            // 2. Populate Text Dropdown
            const textSelect = document.getElementById('textHistorySelect');
            textSelect.innerHTML = ""; // Clear existing
            if (dashboardData.text_history && dashboardData.text_history.length > 0) {
                dashboardData.text_history.forEach((entry, index) => {
                    const option = document.createElement("option");
                    option.value = entry.id;
                    option.textContent = index === 0 ? `${entry.date} (Latest)` : entry.date;
                    textSelect.appendChild(option);
                });
                // Load latest text entry automatically
                loadTextAnalysis(dashboardData.text_history[0].id);
            } else {
                const option = document.createElement("option");
                option.textContent = "No Text Entries";
                textSelect.appendChild(option);
            }

            // 3. Populate Voice Dropdown
            const voiceSelect = document.getElementById('voiceHistorySelect');
            voiceSelect.innerHTML = ""; // Clear existing
            if (dashboardData.voice_history && dashboardData.voice_history.length > 0) {
                dashboardData.voice_history.forEach((entry, index) => {
                    const option = document.createElement("option");
                    option.value = entry.id;
                    option.textContent = index === 0 ? `${entry.date} (Latest)` : entry.date;
                    voiceSelect.appendChild(option);
                });
                // Load latest voice entry automatically
                loadVoiceAnalysis(dashboardData.voice_history[0].id);
            } else {
                const option = document.createElement("option");
                option.textContent = "No Voice Entries";
                voiceSelect.appendChild(option);
            }

            // 4. Update Trend Chart
            if (dashboardData.stress_trend) {
                trendChart.data.labels = dashboardData.stress_trend.days || [];
                trendChart.data.datasets[0].data = dashboardData.stress_trend.voice || [];
                trendChart.data.datasets[1].data = dashboardData.stress_trend.text || [];
                trendChart.update();
            }

            // 5. Add Event Listeners for Dropdowns
            textSelect.addEventListener("change", function () {
                loadTextAnalysis(this.value);
            });

            voiceSelect.addEventListener("change", function () {
                loadVoiceAnalysis(this.value);
            });

        } catch (err) {
            console.error("Dashboard Loading Error:", err);
        }
    }
    // ==========================================
    // Delete Journal Logic
    // ==========================================
    const deleteTextJournalBtn = document.getElementById("deleteTextJournalBtn");
    if (deleteTextJournalBtn) {
        deleteTextJournalBtn.addEventListener("click", async () => {
            const textSelect = document.getElementById('textHistorySelect');
            const journalId = textSelect.value;
            
            // Ignore if there's no valid ID
            if (!journalId || textSelect.options.length === 0 || textSelect.options[0].textContent === "No Text Entries") {
                return;
            }

            if (confirm("Are you sure you want to delete this journal entry?")) {
                try {
                    const res = await fetch(`/api/journal/${journalId}`, {
                        method: "DELETE"
                    });
                    if (res.ok) {
                        alert("Journal entry deleted successfully.");
                        loadDashboardData(); // Refresh the list
                    } else {
                        const data = await res.json();
                        alert("Failed to delete journal: " + (data.error || "Unknown error"));
                    }
                } catch (e) {
                    console.error("Delete error:", e);
                    alert("Error communicating with server.");
                }
            }
        });
    }

    // Fire dashboard load
    loadDashboardData();
});