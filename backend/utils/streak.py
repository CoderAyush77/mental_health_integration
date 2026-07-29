from datetime import datetime, timezone, timedelta
from database import users_collection


def increment_user_streak(email):
    """
    Increments the user's daily streak if they haven't already incremented it today.
    """
    if not email:
        return 0

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime(
        "%Y-%m-%d"
    )

    user_profile = users_collection.find_one({"email": email})

    if not user_profile:
        current_streak = 0
        last_checkin_date = ""
    else:
        current_streak = user_profile.get("streak", 0)
        last_checkin_date = user_profile.get("last_checkin_date", "")

    # Calculate new streak
    if last_checkin_date == today_str:
        # Already logged something today
        new_streak = current_streak
    elif last_checkin_date == yesterday_str:
        # Logged yesterday, so consecutive day!
        new_streak = current_streak + 1
    else:
        # Broken streak or first timer
        new_streak = 1

    # Update database
    users_collection.update_one(
        {"email": email},
        {"$set": {"streak": new_streak, "last_checkin_date": today_str}},
        upsert=True,
    )

    return new_streak
