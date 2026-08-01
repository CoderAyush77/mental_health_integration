from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta, timezone
from bson.objectid import ObjectId
from database import journals_collection, voice_collection
from utils.auth_middleware import token_required

analytics_bp = Blueprint("analytics", __name__)


def map_stress(level, is_text=True):
    """Converts string stress levels for the trend arrays."""
    if not level:
        return None
    level = str(level).lower()
    if "extreme" in level:
        return 4 if is_text else 3
    if "high" in level:
        return 3
    if "medium" in level or "moderate" in level:
        return 2
    if "low" in level:
        return 1
    return None


def get_compare_val(level_str):
    """Strict mapping solely for calculating the Highest Stress Summary."""
    if not level_str:
        return 0
    level = str(level_str).lower()
    if "extreme" in level:
        return 4
    if "high" in level:
        return 3
    if "medium" in level or "moderate" in level:
        return 2
    if "low" in level:
        return 1
    return 0


def format_date(date_str):
    """Formats standard dates to 'Jul 25, 2026'."""
    if not date_str:
        return "Unknown Date"
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%b %d, %Y")
    except Exception:
        return date_str


def get_voice_recommendation(stress_level):
    stress = str(stress_level).capitalize()
    if stress == "Low":
        return {
            "text": "Keep up your positive routine.",
            "link": "../journal/journal.html",
            "linkText": "Continue Journaling",
        }
    elif stress == "Moderate" or stress == "Medium":
        return {
            "text": "Take a short break and practice breathing exercises.",
            "link": "../breathing/breathing.html",
            "linkText": "Breathing Exercises",
        }
    elif stress == "High":
        return {
            "text": "Practice guided meditation and take time for relaxation.",
            "link": "../meditation/meditation.html",
            "linkText": "Guided Meditation",
        }
    elif stress == "Extreme":
        return {
            "text": "Consider mindfulness exercises and professional support if stress continues.",
            "link": "../help/help.html",
            "linkText": "Professional Support",
        }
    return {
        "text": "Keep up your positive routine.",
        "link": "../journal/journal.html",
        "linkText": "Continue Journaling",
    }


def get_text_recommendation(stress_level):
    stress = str(stress_level).capitalize()
    if stress == "Low":
        return {
            "text": "Keep maintaining your healthy routine and continue journaling regularly.",
            "link": "../journal/journal.html",
            "linkText": "Go to Journal",
        }
    elif stress == "Medium" or stress == "Moderate":
        return {
            "text": "Try a 5-minute breathing exercise and take regular breaks during work or study.",
            "link": "../breathing/breathing.html",
            "linkText": "Try Breathing Exercise",
        }
    elif stress == "High":
        return {
            "text": "Practice guided meditation, reduce workload if possible, and consider talking to a trusted friend or family member.",
            "link": "../meditation/meditation.html",
            "linkText": "Guided Meditation",
        }
    elif stress == "Extreme":
        return {
            "text": "Your responses indicate persistent high stress. Please consider contacting a mental health professional or counselor if these feelings continue.",
            "link": "../help/help.html",
            "linkText": "Get Professional Help",
        }
    return None


# ==========================================
# API 1: Load Analytics Dashboard
# ==========================================
@analytics_bp.route("/<email>", methods=["GET"])
@token_required
def get_dashboard(email):
    if getattr(request, "current_user_email", "").lower() != email.lower():
        return jsonify({"error": "Forbidden. You can only access your own analytics data."}), 403

    text_entries = list(
        journals_collection.find({"email": email}).sort("_id", -1)
    )
    voice_entries = list(
        voice_collection.find({"email": email}).sort("_id", -1)
    )

    highest_stress_text = "N/A"
    highest_stress_date = "N/A"
    highest_stress_val = 0
    highest_dt = datetime.min

    text_history = []
    text_by_date = {}

    for entry in text_entries:
        date_str = entry.get("date", "")
        formatted_date = format_date(date_str)

        text_history.append({"id": str(entry["_id"]), "date": formatted_date})
        if date_str not in text_by_date:
            text_by_date[date_str] = map_stress(entry.get("stress_level"), True)

        val = get_compare_val(entry.get("stress_level"))
        if val > 0:
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
            except Exception:
                dt = datetime.min
            if val > highest_stress_val or (
                val == highest_stress_val and dt > highest_dt
            ):
                highest_stress_val = val
                highest_stress_text = entry.get(
                    "stress_level", "Extreme"
                ).capitalize()
                highest_stress_date = formatted_date
                highest_dt = dt

    voice_history = []
    voice_by_date = {}

    for entry in voice_entries:
        date_str = entry.get("date", "")
        formatted_date = format_date(date_str)

        voice_history.append({"id": str(entry["_id"]), "date": formatted_date})
        if date_str not in voice_by_date:
            voice_by_date[date_str] = map_stress(
                entry.get("overall_emotion_state"), False
            )

        val = get_compare_val(entry.get("overall_emotion_state"))
        if val > 0:
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
            except Exception:
                dt = datetime.min
            if val > highest_stress_val or (
                val == highest_stress_val and dt > highest_dt
            ):
                highest_stress_val = val
                highest_stress_text = entry.get(
                    "overall_emotion_state", "Extreme"
                ).capitalize()
                highest_stress_date = formatted_date
                highest_dt = dt

    summary = {
        "total_entries": len(text_entries),
        "voice_entries": len(voice_entries),
        "highest_stress": {
            "level": highest_stress_text,
            "date": highest_stress_date,
        },
    }

    today = datetime.now(timezone.utc).date()
    trend_labels = []
    text_data = []
    voice_data = []

    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        target_str = target_date.strftime("%Y-%m-%d")

        trend_labels.append(target_date.strftime("%b %d"))
        text_data.append(text_by_date.get(target_str, None))
        voice_data.append(voice_by_date.get(target_str, None))

    stress_trend = {
        "days": trend_labels,
        "text": text_data,
        "voice": voice_data,
    }

    payload = {
        "summary": summary,
        "text_history": text_history,
        "voice_history": voice_history,
        "stress_trend": stress_trend,
    }

    return jsonify(payload), 200


# ==========================================
# API 2: Load Analysis of Selected Entry
# ==========================================
@analytics_bp.route("/<email>/analysis", methods=["GET"])
@token_required
def get_analysis(email):
    if getattr(request, "current_user_email", "").lower() != email.lower():
        return jsonify({"error": "Forbidden. You can only access your own analysis data."}), 403
    doc_type = request.args.get("type")
    doc_id = request.args.get("id")

    if not doc_type or not doc_id:
        return jsonify({"error": "Missing type or id parameters"}), 400

    try:
        obj_id = ObjectId(doc_id)
    except Exception:
        return jsonify({"error": "Invalid ID format"}), 400

    if doc_type == "text":
        entry = journals_collection.find_one({"_id": obj_id, "email": email})
        if not entry:
            return jsonify({"error": "Journal not found"}), 404

        payload = {
            "type": "text",
            "stress": entry.get("stress_level", "Medium").capitalize(),
            "emotions": entry.get(
                "emotions",
                {
                    "anger": 0,
                    "disgust": 0,
                    "fear": 0,
                    "joy": 0,
                    "neutral": 0,
                    "sadness": 0,
                    "surprise": 0,
                },
            ),
            "recommendation": get_text_recommendation(entry.get("stress_level", "Medium"))
        }
        return jsonify(payload), 200

    elif doc_type == "voice":
        entry = voice_collection.find_one({"_id": obj_id, "email": email})
        if not entry:
            return jsonify({"error": "Voice entry not found"}), 404

        metrics = entry.get("tone_analyzer_metrics", {})
        stress_level = entry.get(
            "overall_emotion_state", "Moderate"
        ).capitalize()
        positivity = metrics.get("positivity", 0)

        payload = {
            "type": "voice",
            "stress": stress_level,
            # RESTORED CONFIDENCE HERE
            "confidence": metrics.get("confidence", 0),
            "positivity": positivity,
            "recommendation": get_voice_recommendation(
                stress_level
            ),
        }
        return jsonify(payload), 200

    return jsonify({"error": "Invalid type parameter"}), 400
