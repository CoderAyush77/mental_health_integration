from flask import Blueprint, jsonify
from database import users_collection

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
