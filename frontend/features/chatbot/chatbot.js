document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chatForm');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const promptButtons = document.querySelectorAll('.prompt-btn');

    // =========================================================================
    // API Key is now securely fetched from the backend via .env
    // =========================================================================
    let GROQ_API_KEY = "";
    // =========================================================================

    let baseSystemPrompt = `
# SereneMind Assistant – Empathetic AI Mental Health Companion

## Identity & Role
You are SereneMind Assistant, the official AI mental health and journaling companion.
Your primary goals are to:
- Act as an empathetic, non-judgmental listener.
- Help users reflect on their journal entries and understand their emotions.
- Offer gentle coping mechanisms (like breathing exercises, mindfulness, or grounding techniques) when they feel stressed or anxious.
- Be warm, professional, deeply empathetic, and culturally aware.

## Strict Safety Boundaries & Rules
- **NEVER diagnose mental health conditions (like depression, anxiety disorders, etc.).**
- **NEVER prescribe or recommend psychiatric medications.**
- **Emergency Detection**: If the patient mentions self-harm, severe trauma, or feeling like they can't go on, YOU MUST IMMEDIATELY REPLY WITH: "I'm so sorry you're feeling this way. Please know you're not alone. This may require urgent professional help. Please reach out to a crisis helpline, contact a trusted loved one, or visit the nearest emergency department immediately." Never continue chatting normally without providing this safety net.
- Always remind users that you are an AI companion and cannot replace professional therapy or counseling.

## Knowledge Base & Assistance
1. **Journal Reflection**: Help users dig deeper into their feelings. Ask open-ended questions like "How did that make you feel?" or "What do you think triggered that reaction?"
2. **Stress Management**: If the user's stress level is high, recommend taking a break, drinking water, or doing the 3-Minute Breathing Exercise available in the app.
3. **Voice Reflection Integration**: Acknowledge that the app can analyze voice tone (Confidence, Energy, Stress, Pace, Positivity) if they bring it up.
`;

    let dynamicUserContext = "";

    // Chat History 
    let chatHistory = [];

    // Helper to format timestamps
    const getFormattedTime = () => {
        return new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Scroll chat window to bottom
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Format markdown to HTML and auto-link features
    const formatMarkdown = (text) => {
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold
            .replace(/\*(.*?)\*/g, '<i>$1</i>')     // Italic
            .replace(/\n/g, '<br>')                 // Line breaks
            .replace(/- (.*)/g, '<li>$1</li>');     // Simple lists

        // Auto-link to other pages could be added here if Ayna Clinic has specific pages for treatments.

        return formatted;
    };

    // Append a message bubble to the chat
    const appendMessage = (sender, text) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');

        const p = document.createElement('p');
        p.innerHTML = formatMarkdown(text);

        const timeSpan = document.createElement('span');
        timeSpan.classList.add('message-time');
        timeSpan.textContent = getFormattedTime();

        bubbleDiv.appendChild(p);
        bubbleDiv.appendChild(timeSpan);
        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);

        scrollToBottom();
    };

    // Append typing indicator bubble
    const showTypingIndicator = () => {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.classList.add('message', 'bot', 'typing-container');
        indicatorDiv.id = 'typingIndicator';

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');

        const typingDiv = document.createElement('div');
        typingDiv.classList.add('typing-indicator');
        typingDiv.innerHTML = `
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        `;

        bubbleDiv.appendChild(typingDiv);
        indicatorDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(indicatorDiv);

        scrollToBottom();
    };

    // Remove typing indicator bubble
    const removeTypingIndicator = () => {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    };

    // Fetch response from Groq API (Lightning Fast)
    const fetchAIResponse = async (userMsg) => {
        // Add user message to history
        chatHistory.push({
            role: "user",
            content: userMsg
        });

        if (GROQ_API_KEY === "PASTE_NEW_GROQ_API_KEY_HERE" || !GROQ_API_KEY) {
            chatHistory.pop(); // Remove user message since it failed
            return "Developer Error: Please paste your brand new Groq API Key into line 11 of the `chatbot.js` file! Get one for free at console.groq.com";
        }

        try {
            const fullSystemPrompt = baseSystemPrompt + "\n" + dynamicUserContext;
            const messagesPayload = [
                { role: 'system', content: fullSystemPrompt },
                ...chatHistory
            ];

            // Using Llama-3.3-70B which is their latest, smartest, and fastest model
            const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    messages: messagesPayload,
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.6
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API request failed');
            }

            const data = await response.json();

            // Extract bot reply from Groq response
            const botReply = data.choices[0].message.content;

            // Add bot reply to history
            chatHistory.push({
                role: "assistant",
                content: botReply
            });

            return botReply;

        } catch (error) {
            console.error("Groq API Error:", error);
            // Remove the failed user message from history
            chatHistory.pop();

            const errorString = error.message ? error.message.toLowerCase() : "";

            if (errorString.includes("api key") || errorString.includes("invalid") || errorString.includes("unauthorized") || errorString.includes("401")) {
                return "The Groq API Key you provided in chatbot.js is invalid. Please double check it!";
            }

            return `Connection error: ${error.message}. Please try sending that again! 🌿`;
        }
    };

    // Handle bot response cycle
    const handleBotResponse = async (userMsg) => {
        showTypingIndicator();

        // Disable input while generating
        userInput.disabled = true;
        sendBtn.disabled = true;

        const responseText = await fetchAIResponse(userMsg);

        removeTypingIndicator();
        appendMessage('bot', responseText);

        // Re-enable input
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    };

    // Fetch user context dynamically from the backend analytics and get API config
    const loadUserContext = async () => {
        try {
            // 1. Fetch Config (GROQ API KEY)
            const configRes = await fetch(apiUrl("/api/config"));
            if (configRes.ok) {
                const configData = await configRes.json();
                if (configData.GROQ_API_KEY) {
                    GROQ_API_KEY = configData.GROQ_API_KEY;
                }
            }

            // 2. Fetch Context
            const currentUserStr = localStorage.getItem('currentUser');
            if (currentUserStr) {
                const user = JSON.parse(currentUserStr);
                const headers = window.getAuthHeaders ? window.getAuthHeaders() : { 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '') };
                const res = await fetch(apiUrl(`/api/analytics/${user.email}`), { headers });
                if (res.ok) {
                    const data = await res.json();
                    dynamicUserContext = `
### User Context (From backend analytics)
- User Name: ${user.name || 'User'}
- Total Text Journals: ${data.summary?.total_entries || 0}
- Total Voice Journals: ${data.summary?.voice_entries || 0}
- Highest Recorded Stress Level: ${data.summary?.highest_stress?.level || 'Unknown'} (on ${data.summary?.highest_stress?.date || 'Unknown'})

Please use this context to be more empathetic and personalized. If their stress has been high, check in on it gently. Use their name if appropriate.
`;
                }
            }
        } catch (e) {
            console.error("Failed to fetch user context for chatbot", e);
        }
    };

    // Show initial welcome screen
    const showWelcomeScreen = () => {
        chatHistory = []; // Reset history

        // Clear existing messages
        chatMessages.innerHTML = '';

        const welcomeMsg = "Hello! I am SereneMind Assistant, your personal mental health companion. I'm here to listen, reflect, and help you navigate your feelings. How are you doing today?";

        // Push initial greeting to history
        chatHistory.push({
            role: "assistant",
            content: welcomeMsg
        });

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');

        const p = document.createElement('p');
        p.innerHTML = welcomeMsg;
        bubbleDiv.appendChild(p);

        const timeSpan = document.createElement('span');
        timeSpan.classList.add('message-time');
        timeSpan.textContent = getFormattedTime();
        bubbleDiv.appendChild(timeSpan);

        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
        scrollToBottom();

        // Restore input defaults
        if (userInput) {
            userInput.disabled = false;
            userInput.placeholder = "Type a message...";
        }
        if (sendBtn) {
            sendBtn.disabled = false;
        }
        const quickPrompts = document.querySelector('.quick-prompts');
        if (quickPrompts) {
            quickPrompts.style.display = 'flex';
        }
    };

    // Form submit listener (user messages)
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const messageText = userInput.value.trim();
            if (!messageText) return;

            // Display user message
            appendMessage('user', messageText);
            userInput.value = '';

            // Trigger bot response
            handleBotResponse(messageText);
        });
    }

    // Quick prompts click listeners
    promptButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const promptText = btn.getAttribute('data-text');
            if (promptText) {
                appendMessage('user', promptText);
                handleBotResponse(promptText);
            }
        });
    });

    // Clear Chat history (resets to welcome screen)
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your current conversation?')) {
                showWelcomeScreen();
            }
        });
    }

    // Initialize MindCare on load
    loadUserContext().then(() => {
        showWelcomeScreen();
    });
});
