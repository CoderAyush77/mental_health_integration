from flask import request, jsonify, Blueprint
from datetime import datetime, timezone
from database import voice_collection, cipher_suite
from utils.voice_predictor import (
    evaluate_voice_audio,
)  # Import your PyTorch script
from utils.streak import increment_user_streak
from bson.objectid import ObjectId

voice_bp = Blueprint("voice", __name__)


# 1. CREATE ROUTE: Triggered when user submits a voice reflection
# FIX: Removed '/api/voice' because app.py already adds it!
@voice_bp.route("/create", methods=["POST"])
def save_voice_reflection():
    # We expect a file and form data, NOT standard JSON
    email = request.form.get("email")
    content = request.form.get("content")  # The live transcript text
    audio_file = request.files.get(
        "audio"
    )  # The actual .wav file from frontend

    if not email or not content or not audio_file:
        return (
            jsonify({"error": "Missing email, transcript, or audio file."}),
            400,
        )

    # Pass the audio file directly to your PyTorch model script
    try:
        from utils.predictor import evaluate_journal_stress

        # 1. Voice-based metrics
        tone_metrics, voice_emotion = evaluate_voice_audio(audio_file)

        # 2. Text-based metrics (Highly accurate pre-trained model)
        text_stress, _ = evaluate_journal_stress(content)

        # Blend them: if voice model is untrained, it defaults to Neutral/Calm.
        # Use text model as a strong signal override to ensure accurate results.
        overall_emotion = voice_emotion
        if text_stress == "High" or text_stress == "Extreme":
            overall_emotion = "Highly Stressed"
            tone_metrics["stress_level"] = max(tone_metrics.get("stress_level", 0), 85)
            tone_metrics["positivity"] = min(tone_metrics.get("positivity", 100), 20)
        elif text_stress == "Medium":
            overall_emotion = "Moderate Stress"
            tone_metrics["stress_level"] = max(tone_metrics.get("stress_level", 0), 50)
        elif text_stress == "Low":
            overall_emotion = "Calm"
            tone_metrics["positivity"] = max(tone_metrics.get("positivity", 0), 80)
            tone_metrics["stress_level"] = min(tone_metrics.get("stress_level", 100), 20)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return (
            jsonify({"error": f"Audio processing failed: {e}"}),
            500,
        )

    # Encrypt the transcript securely before database storage
    try:
        encrypted_content = cipher_suite.encrypt(content.encode()).decode()
    except Exception:
        return jsonify({"error": "Encryption failed. Data not saved."}), 500

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Construct the document with the ML-generated metrics
    new_voice_log = {
        "email": email,
        "content": encrypted_content,
        "tone_analyzer_metrics": {
            # FIX: Cleaned up to only include the 3 real metrics!
            "confidence": int(tone_metrics.get("confidence", 0)),
            "stress_level": int(tone_metrics.get("stress_level", 0)),
            "positivity": int(tone_metrics.get("positivity", 0)),
        },
        "overall_emotion_state": overall_emotion,
        "date": today_str,
        "time_of_creation": datetime.now(timezone.utc),
    }

    result = voice_collection.insert_one(new_voice_log)
    inserted_id = str(result.inserted_id)

    # Update daily streak
    increment_user_streak(email)

    return (
        jsonify(
            {
                "status": "success",
                "message": "Audio processed via PyTorch and saved securely.",
                "metrics": tone_metrics,  # Send back to frontend to update the UI bars
                "id": inserted_id
            }
        ),
        201,
    )


# 2. GET ROUTE: Fetch past voice reflections for the analytics/history tab
# FIX: Removed '/api/voice' here too!
@voice_bp.route("/<email>", methods=["GET"])
def get_voice_history(email):
    entries = list(
        voice_collection.find({"email": email}).sort("time_of_creation", -1)
    )

    for entry in entries:
        # Convert MongoDB ObjectId to string for JSON serialization
        entry["_id"] = str(entry["_id"])
        try:
            # Decrypt the text before sending it to the React frontend
            entry["content"] = cipher_suite.decrypt(
                entry["content"].encode()
            ).decode()
        except Exception:
            # Safety net: skip decryption for legacy or unencrypted records
            pass

    return jsonify({"voice_reflections": entries}), 200

# 3. DELETE ROUTE


@voice_bp.route('/<entry_id>', methods=['DELETE'])
def delete_voice_reflection(entry_id):
    try:
        result = voice_collection.delete_one({'_id': ObjectId(entry_id)})
        if result.deleted_count == 1:
            return jsonify({'message': 'Voice reflection deleted successfully'}), 200
        else:
            return jsonify({'error': 'Voice reflection not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Invalid ID format: {e}'}), 400
