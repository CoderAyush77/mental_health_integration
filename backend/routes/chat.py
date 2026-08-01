import os
import requests
from flask import Blueprint, jsonify, request
from utils.auth_middleware import token_required

chat_bp = Blueprint("chat", __name__)

BASE_SYSTEM_PROMPT = """
# SereneMind – Empathetic AI Mental Health Companion

## Identity & Role
You are SereneMind, the official AI mental health and journaling companion.
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
"""


@chat_bp.route("/completion", methods=["POST"])
@token_required
def chat_completion():
    current_user = getattr(request, "current_user_email", "User")
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return jsonify({"error": "GROQ_API_KEY is not configured on the server."}), 500

    data = request.get_json() or {}
    messages = data.get("messages", [])
    if not messages:
        user_msg = data.get("message")
        if user_msg:
            messages = [{"role": "user", "content": user_msg}]
        else:
            return jsonify({"error": "Messages payload required."}), 400

    # Ensure system prompt is attached cleanly
    has_system = any(m.get("role") == "system" for m in messages)
    if not has_system:
        messages.insert(0, {"role": "system", "content": BASE_SYSTEM_PROMPT})

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {groq_api_key}"
            },
            json={
                "messages": messages,
                "model": "llama-3.3-70b-versatile",
                "temperature": 0.6
            },
            timeout=15
        )

        if not response.ok:
            error_msg = "Groq API request failed"
            try:
                err_json = response.json()
                error_msg = err_json.get("error", {}).get("message", error_msg)
            except Exception:
                pass
            return jsonify({"error": error_msg}), response.status_code

        res_data = response.json()
        bot_reply = res_data["choices"][0]["message"]["content"]
        return jsonify({"reply": bot_reply, "user": current_user}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to complete chat: {str(e)}"}), 500
