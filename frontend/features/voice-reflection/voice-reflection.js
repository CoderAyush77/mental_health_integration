import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const btnRecord = document.getElementById('btnRecord');
    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnStop = document.getElementById('btnStop');
    const btnCancel = document.getElementById('btnCancel');
    const btnDelete = document.getElementById('btnDelete');
    const btnUpload = document.getElementById('btnUpload');
    const fileUpload = document.getElementById('fileUpload');
    const dropZone = document.getElementById('dropZone');
    
    const vrDot = document.getElementById('vrDot');
    const statusText = document.getElementById('voiceStatusText');
    const timerDisplay = document.getElementById('voiceTimer');
    
    // Action buttons
    const btnAutofillJournal = document.getElementById('btnAutofillJournal');
    const btnSaveToDatabase = document.getElementById('btnSaveToDatabase');
    const btnDownloadReport = document.getElementById('btnDownloadReport');
    
    // Stats elements
    const statWords = document.getElementById('statWords');
    const statDuration = document.getElementById('statDuration');
    const statPauses = document.getElementById('statPauses');
    const statPitch = document.getElementById('statPitch');
    const statVolume = document.getElementById('statVolume');
    const statRate = document.getElementById('statRate');

    // Tone Bars
    const barConfidence = document.getElementById('barConfidence');
    const valConfidence = document.getElementById('valConfidence');
    const barEnergy = document.getElementById('barEnergy');
    const valEnergy = document.getElementById('valEnergy');
    const barStress = document.getElementById('barStress');
    const valStress = document.getElementById('valStress');
    const barPace = document.getElementById('barPace');
    const valPace = document.getElementById('valPace');
    const barPositivity = document.getElementById('barPositivity');
    const valPositivity = document.getElementById('valPositivity');

    // AI & Emotion Elements
    const transcriptBox = document.getElementById('transcriptBox');
    const overallEmotion = document.getElementById('overallEmotion');
    const overallEmotionIcon = document.getElementById('overallEmotionIcon');
    const aiReasoningBox = document.getElementById('aiReasoningBox');
    const aiLoadingOverlay = document.getElementById('aiLoadingOverlay');
    const aiLoadingSubtext = document.getElementById('aiLoadingSubtext');
    
    // Classes
    const audioAnalyzer = new AudioAnalyzer();
    const toneAnalyzer = new ToneAnalyzer('toneGrid'); // the grid ID isn't used much if we override getEmotionProbabilities
    const visualizer = new WaveformVisualizer(); // this works with any canvas id='waveformCanvas' by default inside WaveformVisualizer.js, but wait, visualizer defaults to 'waveformCanvas'
    
    // State
    let mediaRecorder = null;
    let audioChunks = [];
    let audioBlob = null;
    let audioUrl = null;
    let stream = null;
    let currentRecordId = null;
    
    let timerInterval = null;
    let secondsElapsed = 0;
    
    let statsInterval = null;
    let smoothedVolume = 0;

    // Web Speech API
    let recognition = null;
    let currentTranscript = "";
    let currentInterimTranscript = "";

    // Chart instance
    let timelineChartInst = null;
    let emotionHistory = { labels: [], sad: [], happy: [], neutral: [] };
    
    // Initialization
    function init() {
        if (btnRecord) btnRecord.addEventListener('click', startRecording);
        if (btnPause) btnPause.addEventListener('click', pauseRecording);
        if (btnResume) btnResume.addEventListener('click', resumeRecording);
        if (btnStop) btnStop.addEventListener('click', stopRecording);
        if (btnCancel) btnCancel.addEventListener('click', cancelRecording);
        if (btnDelete) btnDelete.addEventListener('click', deleteRecording);
        
        if (btnUpload && fileUpload) {
            btnUpload.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent double click if dropZone is also clicked
                fileUpload.click();
            });
            fileUpload.addEventListener('change', handleFileUpload);
        }
        
        if (dropZone && fileUpload) {
            dropZone.addEventListener('click', () => fileUpload.click());
            
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, preventDefaults, false);
            });
            
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => dropZone.classList.add('active'), false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => dropZone.classList.remove('active'), false);
            });
            
            dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    fileUpload.files = files; // Assign to input
                    handleFileUpload({ target: { files: files } });
                }
            }, false);
        }
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (btnDownloadReport) btnDownloadReport.addEventListener('click', downloadRecording);
        if (btnAutofillJournal) btnAutofillJournal.addEventListener('click', handleAutofillJournal);
        if (btnSaveToDatabase) btnSaveToDatabase.addEventListener('click', handleSaveToDatabase);

        // Init Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            
            recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    currentTranscript += finalTranscript + ' ';
                }
                currentInterimTranscript = interimTranscript;
                
                // Live update transcript box
                if (transcriptBox) {
                    transcriptBox.innerHTML = `<strong>${currentTranscript}</strong> <span style="color:#9ca3af;">${interimTranscript}</span>`;
                    transcriptBox.scrollTop = transcriptBox.scrollHeight;
                }
            };
        }

        initTimelineChart();
    }

    function initTimelineChart() {
        const ctx = document.getElementById('emotionTimelineCanvas');
        if (!ctx) return;
        
        timelineChartInst = new Chart(ctx, {
            type: 'line',
            data: {
                labels: emotionHistory.labels,
                datasets: [
                    { label: 'Positivity', data: emotionHistory.happy, borderColor: '#48bb78', tension: 0.4, fill: false },
                    { label: 'Stress', data: emotionHistory.sad, borderColor: '#ed8936', tension: 0.4, fill: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: true, grid: { display: false } },
                    y: { display: false, min: 0, max: 1 }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateTimelineChart(stats) {
        if (!timelineChartInst) return;
        
        // Push every few seconds
        if (secondsElapsed % 3 === 0 && stats.isSpeaking) {
            const timeStr = new Date(secondsElapsed * 1000).toISOString().substr(14, 5);
            emotionHistory.labels.push(timeStr);
            
            // Trigger live text analysis periodically
            analyzeTextLive();
            
            const probs = toneAnalyzer.getEmotionProbabilities();
            
            // Use blended probs for timeline
            const W_TEXT = 0.65, W_VOICE = 0.35;
            const fusedHappy = (liveTextEmotion.Happy * W_TEXT) + (probs.Happy * W_VOICE);
            const fusedSad = (liveTextEmotion.Sad * W_TEXT) + (probs.Sad * W_VOICE);
            const fusedFear = (liveTextEmotion.Fear * W_TEXT) + (probs.Fear * W_VOICE);
            const fusedAngry = (liveTextEmotion.Angry * W_TEXT) + (probs.Angry * W_VOICE);
            
            emotionHistory.happy.push(fusedHappy);
            emotionHistory.sad.push(fusedSad + fusedFear + fusedAngry); // Proxy for stress
            
            if (emotionHistory.labels.length > 20) {
                emotionHistory.labels.shift();
                emotionHistory.happy.shift();
                emotionHistory.sad.shift();
            }
            timelineChartInst.update();
        }
    }
    
    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        updateUIState('finished');
        if (statusText) statusText.textContent = 'Processing Upload...';
        
        let formData = new FormData();
        formData.append('audio', file);
        formData.append('content', "Uploaded Audio File. Transcript not available.");
        
        let userEmail = 'abc@gmail.com'; // Fallback
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try { userEmail = JSON.parse(userStr).email || ''; } catch(e) {}
        }
        formData.append('email', userEmail);
        
        try {
            const response = await fetch('http://localhost:5000/api/voice/create', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error("Backend server error");
            
            const data = await response.json();
            if (data.id) {
                currentRecordId = data.id;
            }
            const finalEmotion = data.overall_emotion || "Neutral";
            
            if (data.metrics) {
                setProgress(barConfidence, valConfidence, data.metrics.confidence);
                setProgress(barEnergy, valEnergy, data.metrics.energy);
                setProgress(barStress, valStress, data.metrics.stress_level, true);
                setProgress(barPace, valPace, data.metrics.speech_pace);
                setProgress(barPositivity, valPositivity, data.metrics.positivity);
                
                updateEmotionBadge(finalEmotion);
                
                if (btnDownloadReport) btnDownloadReport.disabled = false;
                if (btnAutofillJournal) btnAutofillJournal.disabled = false;
                
                if (transcriptBox) transcriptBox.innerHTML = `<em>Uploaded File Analyzed. No transcript available.</em>`;
            }
            if (statusText) statusText.textContent = 'Upload Processed';
        } catch (error) {
            console.error('Upload Error:', error);
            if (statusText) statusText.textContent = 'Upload Failed';
            updateUIState('ready');
        }
        
        fileUpload.value = ""; // Reset input
    }

    async function startRecording() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            let options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'audio/webm' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: '' }; 
                }
            }
            
            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];
            currentTranscript = "";
            emotionHistory = { labels: [], sad: [], happy: [], neutral: [] };
            if (timelineChartInst) {
                timelineChartInst.data.labels = emotionHistory.labels;
                timelineChartInst.data.datasets[0].data = emotionHistory.happy;
                timelineChartInst.data.datasets[1].data = emotionHistory.sad;
                timelineChartInst.update();
            }
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = handleRecordingStop;
            
            // Start components
            audioAnalyzer.init(stream);
            toneAnalyzer.reset();
            visualizer.start(audioAnalyzer);
            
            if (recognition) {
                try { recognition.start(); } catch(e) { console.error("Recognition start err", e); }
            }

            mediaRecorder.start(100);
            
            updateUIState('recording');
            startTimer();
            startStatsUpdater();
            
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                audioUrl = null;
            }
            
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access the microphone. Please ensure permissions are granted.');
        }
    }
    
    function pauseRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            audioAnalyzer.isProcessing = false;
            updateUIState('paused');
            clearInterval(timerInterval);
            if (recognition) recognition.stop();
        }
    }
    
    function resumeRecording() {
        if (mediaRecorder && mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            audioAnalyzer.isProcessing = true;
            audioAnalyzer.lastFrameTime = performance.now();
            updateUIState('recording');
            startTimer();
            if (recognition) {
                try { recognition.start(); } catch(e) {}
            }
        }
    }
    
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            audioAnalyzer.stop();
            visualizer.stop();
            stopStream();
            
            updateUIState('finished');
            stopTimer();
            stopStatsUpdater();
            if (recognition) recognition.stop();
            
            updateLiveStats();
        }
    }
    
    function cancelRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        audioAnalyzer.stop();
        visualizer.stop();
        stopStream();
        if (recognition) recognition.stop();
        
        audioChunks = [];
        updateUIState('ready');
        stopTimer();
        secondsElapsed = 0;
        updateTimerDisplay();
        stopStatsUpdater();
        
        if (transcriptBox) transcriptBox.innerHTML = "Press the microphone icon to begin your voice reflection. Your transcript will appear here as you speak.";
    }
    
    async function deleteRecording() {
        if (!currentRecordId) {
            cancelRecording();
            return;
        }
        
        try {
            const response = await fetch(`http://localhost:5000/api/voice/${currentRecordId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                if(window.showToast) window.showToast('Recording deleted successfully', 'success');
                currentRecordId = null;
                cancelRecording();
            } else {
                if(window.showToast) window.showToast('Failed to delete recording', 'error');
            }
        } catch(e) {
            console.error('Delete error:', e);
            if(window.showToast) window.showToast('Error deleting recording', 'error');
        }
    }
    
    function stopStream() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }
    
    function handleRecordingStop() {
        if (audioChunks.length === 0) return; // Cancelled
        
        const type = mediaRecorder.mimeType || 'audio/webm';
        audioBlob = new Blob(audioChunks, { type: type });
        audioUrl = URL.createObjectURL(audioBlob);
        
        runBackendAnalysis();
    }
    
    function downloadRecording() {
        if (!audioUrl) return;
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = audioUrl;
        
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        let ext = 'webm';
        if (audioBlob.type.includes('mp4')) ext = 'mp4';
        else if (audioBlob.type.includes('ogg')) ext = 'ogg';
        
        a.download = `voice-reflection-${dateStr}-${timeStr}.${ext}`;
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => document.body.removeChild(a), 100);
    }
    
    // --- UI Helpers ---
    
    function updateUIState(state) {
        if (btnRecord) {
            btnRecord.disabled = true;
            btnRecord.classList.remove('recording');
        }
        if (btnPause) btnPause.disabled = true;
        if (btnResume) btnResume.style.display = 'none';
        if (btnPause) btnPause.style.display = 'flex';
        if (btnStop) btnStop.disabled = true;
        if (btnCancel) btnCancel.disabled = true;
        if (btnDelete) btnDelete.style.display = 'none';
        if (vrDot) vrDot.className = 'vr-dot';
        
        switch (state) {
            case 'ready':
                statusText.textContent = 'Ready to record';
                if (btnRecord) btnRecord.disabled = false;
                break;
            case 'recording':
                statusText.textContent = 'Recording in progress...';
                if (vrDot) vrDot.classList.add('recording');
                if (btnRecord) btnRecord.classList.add('recording');
                if (btnPause) btnPause.disabled = false;
                if (btnStop) btnStop.disabled = false;
                if (btnCancel) btnCancel.disabled = false;
                break;
            case 'paused':
                statusText.textContent = 'Paused';
                if (btnPause) btnPause.style.display = 'none';
                if (btnResume) btnResume.style.display = 'flex';
                if (btnStop) btnStop.disabled = false;
                if (btnCancel) btnCancel.disabled = false;
                break;
            case 'finished':
                statusText.textContent = 'Processing...';
                if (btnRecord) btnRecord.disabled = false;
                if (btnDelete) btnDelete.style.display = 'inline-flex';
                if (btnCancel) btnCancel.style.display = 'none';
                break;
        }
    }
    
    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            secondsElapsed++;
            updateTimerDisplay();
        }, 1000);
    }
    
    function stopTimer() {
        clearInterval(timerInterval);
    }
    
    function updateTimerDisplay() {
        const mins = Math.floor((secondsElapsed % 3600) / 60);
        const secs = secondsElapsed % 60;
        if (timerDisplay) {
            timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} / 05:00`;
        }
        if (statDuration) {
            statDuration.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    function startStatsUpdater() {
        stopStatsUpdater();
        statsInterval = setInterval(() => {
            updateLiveStats();
        }, 100);
    }
    
    function stopStatsUpdater() {
        clearInterval(statsInterval);
    }
    
    function setProgress(barEl, valEl, percent, thresholdRed = false) {
        if (!barEl || !valEl) return;
        const clamped = Math.min(100, Math.max(0, percent));
        barEl.style.width = `${clamped}%`;
        valEl.textContent = `${Math.round(clamped)}%`;
        
        if (thresholdRed) {
            if (clamped > 70) {
                barEl.className = 'vr-progress-bar bg-red-500';
            } else if (clamped > 40) {
                barEl.className = 'vr-progress-bar bg-orange-400';
            } else {
                barEl.className = 'vr-progress-bar bg-green-500';
            }
        }
    }

    function updateLiveStats() {
        if (!audioAnalyzer) return;
        
        audioAnalyzer.process();
        const stats = audioAnalyzer.getStats();
        toneAnalyzer.update(stats);
        
        const wordsCount = currentTranscript.trim().split(/\s+/).filter(w => w.length > 0).length;
        if (statWords) statWords.textContent = wordsCount;
        if (statPitch) statPitch.textContent = `${Math.round(stats.pitch)} Hz`;
        if (statVolume) statVolume.textContent = `${Math.round(stats.currentVolume)}%`;
        if (statPauses) statPauses.textContent = stats.pauseCount;

        // Estimate rate (words per minute)
        const wpm = secondsElapsed > 5 ? Math.round((wordsCount / secondsElapsed) * 60) : 0;
        let rateText = "Normal";
        if (wpm > 150) rateText = "Fast";
        if (wpm > 0 && wpm < 100) rateText = "Slow";
        if (statRate) statRate.textContent = rateText;

        // Tone Bars Map
        const probs = toneAnalyzer.getEmotionProbabilities();
        
        // Blend with live text emotion
        const W_TEXT = 0.65;
        const W_VOICE = 0.35;
        const fusedProbs = {
            Sad: (liveTextEmotion.Sad * W_TEXT) + (probs.Sad * W_VOICE),
            Happy: (liveTextEmotion.Happy * W_TEXT) + (probs.Happy * W_VOICE),
            Angry: (liveTextEmotion.Angry * W_TEXT) + (probs.Angry * W_VOICE),
            Fear: (liveTextEmotion.Fear * W_TEXT) + (probs.Fear * W_VOICE),
            Neutral: (liveTextEmotion.Neutral * W_TEXT) + (probs.Neutral * W_VOICE)
        };
        
        // Derive Confidence (proxy: high energy + low fear + moderate pitch)
        smoothedVolume = smoothedVolume * 0.9 + stats.currentVolume * 0.1;
        const confScore = (smoothedVolume / 100 * 0.4) + ((1 - fusedProbs.Fear) * 0.6) * 100;
        setProgress(barConfidence, valConfidence, confScore || 0);

        // Derive Energy directly from volume and pace
        const engScore = smoothedVolume;
        setProgress(barEnergy, valEnergy, engScore || 0);

        // Derive Stress (proxy: high sad + high fear + high angry)
        let stressScore = (fusedProbs.Sad + fusedProbs.Fear + fusedProbs.Angry) * 100;
        // Suppress stress heavily if positivity is high
        stressScore = Math.max(0, stressScore - (fusedProbs.Happy * 70));
        setProgress(barStress, valStress, stressScore || 0, true);

        // Speech Pace score (normalized wpm 0-200)
        setProgress(barPace, valPace, (wpm / 200) * 100 || 0);

        // Positivity score (Happy)
        setProgress(barPositivity, valPositivity, fusedProbs.Happy * 100 || 0);

        // Overall Emotion badge
        updateOverallEmotionBadge(fusedProbs);

        // Chart
        updateTimelineChart(stats);
    }

    function updateOverallEmotionBadge(probs) {
        if (!overallEmotion || !overallEmotionIcon) return;
        
        let dominantLabel = 'Neutral';
        let maxScore = 0;
        for (const [emo, score] of Object.entries(probs)) {
            if (score > maxScore) {
                maxScore = score;
                dominantLabel = emo;
            }
        }

        overallEmotion.textContent = dominantLabel;
        if (dominantLabel === 'Happy') {
            overallEmotionIcon.className = "fa-regular fa-face-laugh-beam";
        } else if (dominantLabel === 'Sad') {
            overallEmotionIcon.className = "fa-regular fa-face-frown";
        } else if (dominantLabel === 'Angry') {
            overallEmotionIcon.className = "fa-regular fa-face-angry";
        } else if (dominantLabel === 'Fear') {
            overallEmotionIcon.className = "fa-regular fa-face-flushed";
        } else {
            overallEmotionIcon.className = "fa-regular fa-face-smile";
        }
    }

    // AI Pipeline & Fusion logic
    let emotionPipeline = null;
    let liveTextEmotion = { Sad: 0, Happy: 0, Angry: 0, Fear: 0, Neutral: 0.1 };
    let lastAnalyzedText = "";
    let isAnalyzingText = false;

    async function analyzeTextLive() {
        if (isAnalyzingText) return;
        const textToAnalyze = (currentTranscript + " " + currentInterimTranscript).trim();
        if (textToAnalyze === lastAnalyzedText || textToAnalyze.length === 0) return;
        
        isAnalyzingText = true;
        let newTextEmotion = { Sad: 0, Happy: 0, Angry: 0, Fear: 0, Neutral: 0.1 };
        
        // 1. Keyword heuristics first (acts as fallback if ML fails)
        const lower = textToAnalyze.toLowerCase();
        if (lower.includes('no stress') || lower.includes('not stressed')) {
            newTextEmotion.Happy += 0.5;
        }
        if (lower.includes('excited') || lower.includes('great day') || lower.includes('confident') || lower.includes('happy') || lower.includes('happiest')) {
            newTextEmotion.Happy += 0.8;
        }
        if (lower.includes('sad') || lower.includes('depressed')) {
            newTextEmotion.Sad += 0.5;
        }
        if (lower.includes('angry') || lower.includes('mad') || lower.includes('frustrated')) {
            newTextEmotion.Angry += 0.5;
        }

        // 2. Try ML Pipeline
        try {
            if (!emotionPipeline) {
                emotionPipeline = await pipeline('text-classification', 'Xenova/emotion-english-distilroberta-base');
            }
            const out = await emotionPipeline(textToAnalyze, { topk: null });
            const preds = Array.isArray(out[0]) ? out[0] : (Array.isArray(out) ? out : [out]);
            
            preds.forEach(pred => {
                const label = pred.label;
                if (['sadness', 'grief', 'disappointment', 'remorse'].includes(label)) newTextEmotion.Sad += pred.score;
                if (['joy', 'love', 'amusement', 'excitement', 'optimism', 'caring', 'pride', 'relief', 'admiration'].includes(label)) newTextEmotion.Happy += pred.score;
                if (['anger', 'annoyance', 'disapproval', 'disgust'].includes(label)) newTextEmotion.Angry += pred.score;
                if (['fear', 'surprise', 'nervousness', 'embarrassment'].includes(label)) newTextEmotion.Fear += pred.score;
                if (label === 'neutral') newTextEmotion.Neutral += pred.score;
            });
        } catch(err) {
            console.error("Live text analysis error (using heuristic fallback)", err);
        } finally {
            // 3. Normalize and Apply
            const sumText = Object.values(newTextEmotion).reduce((a, b) => a + b, 0);
            for (let k in newTextEmotion) newTextEmotion[k] = newTextEmotion[k] / sumText;
            
            liveTextEmotion = newTextEmotion;
            lastAnalyzedText = textToAnalyze;
            isAnalyzingText = false;
        }
    }

    async function convertBlobToWav(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBufferToWavBlob(audioBuffer);
    }

    function audioBufferToWavBlob(buffer) {
        const numOfChan = buffer.numberOfChannels,
            length = buffer.length * numOfChan * 2 + 44,
            bufferWav = new ArrayBuffer(length),
            view = new DataView(bufferWav),
            channels = [],
            sampleRate = buffer.sampleRate;
        let pos = 0, offset = 0;
        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM
        setUint16(numOfChan);
        setUint32(sampleRate);
        setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit
        setUint32(0x61746164); // "data" chunk
        setUint32(length - pos - 4); // chunk length
        for(let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));
        while(pos < length) {
            for(let i = 0; i < numOfChan; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
                view.setInt16(pos, sample, true); pos += 2;
            }
            offset++;
        }
        return new Blob([bufferWav], {type: "audio/wav"});
    }

    async function runBackendAnalysis() {
        if (aiLoadingOverlay) aiLoadingOverlay.style.display = 'flex';
        if (aiLoadingSubtext) aiLoadingSubtext.textContent = "Running Multi-Modal Fusion on Backend...";
        
        try {
            // Convert WebM to WAV natively in JS
            const wavBlob = await convertBlobToWav(audioBlob);

            const formData = new FormData();
            formData.append('audio', wavBlob, 'recording.wav');
            const finalContent = currentTranscript.trim() || "No speech detected in this recording.";
            formData.append('content', finalContent);
            
            // Extract email for user identification
            let userEmail = 'anonymous@test.com'; // Fallback so backend doesn't 400
            const userStr = localStorage.getItem('currentUser');
            if (userStr) {
                try { 
                    let parsed = JSON.parse(userStr);
                    if (parsed.email) userEmail = parsed.email;
                } catch(e) {}
            }
            formData.append('email', userEmail);
            
            const response = await fetch('http://localhost:5000/api/voice/create', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error("Backend server is not running or returned an error.");
            
            const data = await response.json();
            if (data.id) {
                currentRecordId = data.id;
            }
            const finalEmotion = data.overall_emotion || "Neutral";
            
            if (data.metrics) {
                setProgress(barConfidence, valConfidence, data.metrics.confidence);
                setProgress(barEnergy, valEnergy, data.metrics.energy);
                setProgress(barStress, valStress, data.metrics.stress_level, true);
                setProgress(barPace, valPace, data.metrics.speech_pace);
                setProgress(barPositivity, valPositivity, data.metrics.positivity);

                // const stressRating = Math.max(1, Math.ceil(data.metrics.stress / 20));
                // const confRating = Math.max(1, Math.ceil(data.metrics.confidence / 20));
                // const posRating = Math.max(1, Math.ceil(data.metrics.positivity / 20));

                // renderStars('starsStress', stressRating, 'text-red-400');
                // renderStars('starsConfidence', confRating, 'text-green-500');
                // renderStars('starsPositivity', posRating, 'text-yellow-400');
            }

            // Update UI with the final emotion from backend
            let reason = `Our BERT Backend determined your overall emotion is ${finalEmotion}.`;
            if (aiReasoningBox) aiReasoningBox.textContent = reason;
            
            if (overallEmotion) overallEmotion.textContent = finalEmotion;
            
            if (statusText) statusText.textContent = 'Backend Analysis Complete';

        } catch (error) {
            console.error('Error in Backend Pipeline, falling back to Client-Side:', error);
            if (aiLoadingSubtext) aiLoadingSubtext.textContent = "Backend offline. Falling back to local AI...";
            await runClientSideAnalysis(); // Fallback if Flask is not running
        } finally {
            if (aiLoadingOverlay) aiLoadingOverlay.style.display = 'none';
        }
    }

    async function runClientSideAnalysis() {
        if (aiLoadingOverlay) aiLoadingOverlay.style.display = 'flex';
        
        let textEmotion = { Sad: 0, Happy: 0, Angry: 0, Fear: 0, Neutral: 0.1 };
        const textToAnalyze = currentTranscript.trim() || "I am feeling okay.";
        
        // 1. Keyword heuristics fallback
        const lower = textToAnalyze.toLowerCase();
        if (lower.includes('no stress') || lower.includes('not stressed')) { textEmotion.Happy += 0.5; }
        if (lower.includes('excited') || lower.includes('great day') || lower.includes('confident') || lower.includes('happy') || lower.includes('happiest')) { textEmotion.Happy += 0.8; }
        if (lower.includes('sad') || lower.includes('depressed')) { textEmotion.Sad += 0.5; }
        if (lower.includes('angry') || lower.includes('mad') || lower.includes('frustrated')) { textEmotion.Angry += 0.5; }

        try {
            if (!emotionPipeline) {
                emotionPipeline = await pipeline('text-classification', 'Xenova/emotion-english-distilroberta-base');
            }
            
            if (aiLoadingSubtext) aiLoadingSubtext.textContent = "Analyzing speech patterns...";
            const out = await emotionPipeline(textToAnalyze, { topk: null });
            
            const preds = Array.isArray(out[0]) ? out[0] : (Array.isArray(out) ? out : [out]);
            
            preds.forEach(pred => {
                const label = pred.label;
                if (['sadness', 'grief', 'disappointment', 'remorse'].includes(label)) textEmotion.Sad += pred.score;
                if (['joy', 'love', 'amusement', 'excitement', 'optimism', 'caring', 'pride', 'relief', 'admiration'].includes(label)) textEmotion.Happy += pred.score;
                if (['anger', 'annoyance', 'disapproval', 'disgust'].includes(label)) textEmotion.Angry += pred.score;
                if (['fear', 'surprise', 'nervousness', 'embarrassment'].includes(label)) textEmotion.Fear += pred.score;
                if (label === 'neutral') textEmotion.Neutral += pred.score;
            });
        } catch (error) {
            console.error('Error in ML Pipeline (using heuristic fallback):', error);
        } finally {
            const sumText = Object.values(textEmotion).reduce((a, b) => a + b, 0);
            for (let k in textEmotion) textEmotion[k] = textEmotion[k] / sumText;

            const voiceEmotion = toneAnalyzer.getEmotionProbabilities();

            // Fusion
            const W_TEXT = 0.65, W_VOICE = 0.35;
            const fusedEmotion = {
                Sad: (textEmotion.Sad * W_TEXT) + (voiceEmotion.Sad * W_VOICE),
                Happy: (textEmotion.Happy * W_TEXT) + (voiceEmotion.Happy * W_VOICE),
                Angry: (textEmotion.Angry * W_TEXT) + (voiceEmotion.Angry * W_VOICE),
                Fear: (textEmotion.Fear * W_TEXT) + (voiceEmotion.Fear * W_VOICE),
                Neutral: (textEmotion.Neutral * W_TEXT) + (voiceEmotion.Neutral * W_VOICE)
            };

            let dominantLabel = 'Neutral';
            let maxScore = 0;
            for (const [emo, score] of Object.entries(fusedEmotion)) {
                if (score > maxScore) { maxScore = score; dominantLabel = emo; }
            }

            // Generate AI reasoning text
            let reason = `You sounded mostly ${dominantLabel.toLowerCase()} overall. `;
            if (fusedEmotion.Sad > 0.3) reason += "There were signs of sadness or low energy. ";
            if (fusedEmotion.Fear > 0.3) reason += "We picked up slight indicators of stress or anxiety. ";
            if (fusedEmotion.Happy > 0.3) reason += "Your tone was positive and upbeat. Great job! ";
            if (fusedEmotion.Angry > 0.3) reason += "There was some frustration or anger detected in your voice. ";
            reason += "Take a moment for yourself and breathe.";

            // Render Stars (1-5)
            // const stressRating = Math.max(1, Math.ceil((fusedEmotion.Sad + fusedEmotion.Fear + fusedEmotion.Angry) * 5));
            // const confRating = Math.max(1, Math.ceil((1 - fusedEmotion.Fear) * 5));
            // const posRating = Math.max(1, Math.ceil(fusedEmotion.Happy * 5));

            // renderStars('starsStress', stressRating, 'text-red-400');
            // renderStars('starsConfidence', confRating, 'text-green-500');
            // renderStars('starsPositivity', posRating, 'text-yellow-400');

            // Explicitly update the progress bars for the final fallback calculation
            const finalConfidence = ((fusedEmotion.Happy * 0.4) + ((1 - fusedEmotion.Fear) * 0.6)) * 100;
            setProgress(barConfidence, valConfidence, finalConfidence || 50);
            setProgress(barEnergy, valEnergy, toneAnalyzer.characteristics.energetic.score || 30);
            
            let finalStress = (fusedEmotion.Sad + fusedEmotion.Fear + fusedEmotion.Angry) * 100;
            finalStress = Math.max(0, finalStress - (fusedEmotion.Happy * 70));
            setProgress(barStress, valStress, finalStress || 0, true);
            
            setProgress(barPace, valPace, toneAnalyzer.characteristics.fast_paced.score || 50);
            setProgress(barPositivity, valPositivity, fusedEmotion.Happy * 100 || 0);

            // if (aiReasoningBox) aiReasoningBox.textContent = reason;
            
            updateOverallEmotionBadge(fusedEmotion); // final update
            
            if (statusText) statusText.textContent = 'Analysis Complete';
            if (aiLoadingOverlay) aiLoadingOverlay.style.display = 'none';
        }
    }

    function renderStars(containerId, rating, activeColorCls) {
        const container = document.getElementById(containerId);
        if (!container) return;
        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                html += `<i class="fa-solid fa-star ${activeColorCls}"></i>`;
            } else {
                html += `<i class="fa-regular fa-star text-gray-300"></i>`;
            }
        }
        container.innerHTML = html;
    }

    function handleAutofillJournal() {
        const emoText = overallEmotion ? overallEmotion.textContent : 'Reflection';
        const transcript = currentTranscript.trim() || 'No audio recorded.';
        const reason = aiReasoningBox ? aiReasoningBox.textContent : '';

        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        // Save temporary variables to pass to Journal
        localStorage.setItem('tempJournalTitle', `Voice Reflection - ${dateStr} (${emoText})`);
        localStorage.setItem('tempJournalContent', `Transcript:\n"${transcript}"\n\nAI Analysis:\n${reason}`);
        
        // Redirect to Journal
        window.location.href = '../journal/journal.html';
    }

    function handleSaveToDatabase() {
        const emoText = overallEmotion ? overallEmotion.textContent : 'Reflection';
        const transcript = currentTranscript.trim();
        const reason = aiReasoningBox ? aiReasoningBox.textContent : '';

        if (!transcript) {
            alert('Cannot save. The voice recording is empty.');
            return;
        }

        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const formattedTime = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const entries = JSON.parse(localStorage.getItem('journalEntries') || '[]');
        
        // Optional: comment out the restriction if you want multiple voice entries
        /*
        const hasWrittenToday = entries.some(entry => entry.date === formattedDate);
        if (hasWrittenToday) {
            alert('You have already saved a journal entry for today!');
            return;
        }
        */

        const newEntry = {
            id: Date.now(),
            title: `Voice Reflection (${emoText})`,
            content: `Transcript:\n"${transcript}"\n\nAI Analysis:\n${reason}`,
            date: formattedDate,
            time: formattedTime,
            source: 'voice'
        };
        
        entries.push(newEntry);
        localStorage.setItem('journalEntries', JSON.stringify(entries));

        if (btnSaveToDatabase) {
            btnSaveToDatabase.disabled = true;
            btnSaveToDatabase.innerHTML = '<div class="vr-act-icon bg-green-50 text-green-500"><i class="fa-solid fa-check"></i></div><div class="vr-act-text"><strong>Saved successfully</strong><span>Added to your journal</span></div>';
        }

        alert('Your voice reflection has been securely saved locally!');
    }

    // Run Init
    init();
});
