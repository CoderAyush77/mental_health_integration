# Jourless Project Context & Improvements Log
*Last Updated: July 30, 2026*

This document serves as a record of critical improvements, UI/UX changes, and architectural updates made to the Jourless (formerly SereneMind/Ayna) project to ensure safe-keeping and easy context retrieval for future development.

## 1. Backend & Server Stability
* **Dependency Resolution (`librosa`)**: Upgraded `librosa` to version `0.11.0` to bypass the `pkg_resources` dependency issue. This successfully resolved the `ModuleNotFoundError: No module named 'pkg_resources'` crash and allowed the PyTorch ML voice models (`voice_model.pt`) to run reliably alongside the Flask server.
* **Environment Variables (.env)**:
  * **API Key Security**: Removed the hardcoded `GROQ_API_KEY` from the frontend (`chatbot.js`). Created a secure `/api/config` backend route in `app.py` to dynamically serve the key from the `.env` file, significantly improving security.
  * **Encryption Keys**: Identified that `FERNET_SECRET_KEY` is required by `database.py` for MongoDB encryption. The system currently auto-generates a temporary one on restart if missing, but it is logged here that a permanent key must be placed in `.env` to prevent decryption failures on historical journals.

## 2. Chatbot Revamp (Jourless Identity)
* **Rebranding**: Completely removed the old "Ayna Clinic" clinic template branding from `chatbot.html` and `chatbot.js`. The AI is officially rebranded as **Jourless**, an empathetic mental health companion.
* **System Prompt Update**: The underlying Groq LLM prompt was updated to reflect the new Jourless identity, instructing the AI to act exclusively as a mental health listener and reflection guide.
* **Context Awareness**: Implemented dynamic user context fetching from `/api/analytics/<email>`, allowing the Chatbot to adapt its responses based on the user's past text and voice journal entries.
* **Smart Quick Prompts**: Replaced clinic booking prompts with actionable mental health prompts:
  * 🌊 *Feeling Overwhelmed*
  * 🫁 *Breathing Exercise*
  * 📓 *Daily Reflection*
  * 🌱 *Coping with Stress*

## 3. Analytics Dashboard Enhancements
* **Dynamic Stress Recommendations**: 
  * Implemented explicit Python logic in `analytics.py` for both **Voice** and **Text** analysis results to provide exact recommendations based on stress tiers: *Low, Medium/Moderate, High, and Extreme*.
* **Smart Redirection System**: 
  * Recommendations now feature actionable hyperlink redirects to relevant project modules. For example:
    * "Continue Journaling" -> Redirects to the Journal feature.
    * "Breathing/Relaxation exercises" -> Redirects to the Jourless Chatbot.
    * "Professional Support" -> Redirects to the Help page.
* **UI/UX Polishing**:
  * **Text Recommendation UI**: Designed and integrated a brand-new, full-width `recommendation-box` layout for Text Analysis, matching the Voice Analysis style with a classy gradient (`#f0fff4` to white), soft drop shadows, and a sparkles icon (`fa-sparkles`).
  * **Voice Metrics Grid**: Fixed the squished horizontal layout bug on the Voice Metrics by replacing the generic flex row with a structured 3-column CSS Grid. Styled each metric (Stress Level, Confidence, Positivity) into its own bounded mini-card to ensure consistent spacing.
  * **Metric Number Cleanup**: Applied `Math.round()` in `charts.js` to strip bulky decimals (e.g., `95.00%` -> `95%`), resulting in a cleaner, premium aesthetic.

## 4. Voice Reflection UI Adjustments
* **Layout Squeezing Fix**: Enforced `flex-direction: column` for `.vr-input-area` in `voice-reflection.css` to prevent layout collapse and overflow issues on smaller viewports.
* **Data Safety Checks**: Added safe metric checking in `voice-reflection.js` before attempting to render `confidence`, `stress_level`, or `positivity` onto the DOM. This ensures the frontend doesn't crash if the machine learning model yields unexpected structures.
