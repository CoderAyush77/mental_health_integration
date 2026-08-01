from flask import Blueprint, jsonify
from datetime import datetime, timezone
from database import users_collection, journals_collection, voice_collection

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/streak/<email>", methods=["GET"])
def get_user_streak(email):
    """
    Returns the user's current streak.
    """
    user_profile = users_collection.find_one({"email": email})

    streak = 0
    if user_profile:
        streak = user_profile.get("streak", 0)

    return jsonify({"streak": streak}), 200


@dashboard_bp.route("/daily_checkin_status/<email>", methods=["GET"])
def get_daily_checkin_status(email):
    """
    Returns whether the user has completed their daily check-in today via Journal or Voice.
    """
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    has_journal = bool(journals_collection.find_one({"email": email, "date": today_str}))
    has_voice = bool(voice_collection.find_one({"email": email, "date": today_str}))

    is_completed = has_journal or has_voice
    completed_method = "journal" if has_journal else ("voice" if has_voice else None)

    return jsonify({
        "date": today_str,
        "has_journal": has_journal,
        "has_voice": has_voice,
        "is_completed": is_completed,
        "completed_method": completed_method
    }), 200

