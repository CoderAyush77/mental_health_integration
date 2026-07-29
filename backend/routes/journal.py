from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from bson import ObjectId

# Ensure this matches exactly how you export these from database.py!
from database import db, cipher_suite
from utils.predictor import evaluate_journal_stress
from utils.streak import increment_user_streak

journal_bp = Blueprint("journal", __name__)


@journal_bp.route("/create", methods=["POST"])
def create_journal():
    try:
        data = request.get_json()
        email = data.get("email")
        title = data.get("title", "Untitled")
        content = data.get("content")

        if not email or not content:
            return jsonify({"error": "Email and content are required"}), 400

        # 1. Run the ML Prediction (Chunking + BERT + Classifier)
        stress_level, emotions = evaluate_journal_stress(content)

        # 2. Encrypt the content before saving to the database
        encrypted_content = cipher_suite.encrypt(content.encode("utf-8"))

        # 3. Save to MongoDB
        journal_entry = {
            "email": email,
            "title": title,
            "content": encrypted_content,
            "stress_level": stress_level,
            "emotions": emotions,  # Saving the full dictionary to the DB
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "time_of_creation": datetime.now(timezone.utc).strftime(
                "%H:%M:%S"
            ),
        }

        # NOTE: If your collection is named differently (e.g., db.journal_collection), update this line!
        db.journals.insert_one(journal_entry)

        # Update daily streak
        increment_user_streak(email)

        # 4. Return the exact JSON response the frontend needs
        return (
            jsonify(
                {
                    "message": "Journal saved successfully",
                    "stress_prediction": stress_level,
                    "emotions": emotions,
                }
            ),
            201,
        )

    except Exception as e:
        print(f"Error creating journal: {e}")
        return jsonify({"error": "Internal server error"}), 500


@journal_bp.route("/<email>", methods=["GET"])
def get_journals(email):
    try:
        # Fetch user's journals from the database
        journals = list(db.journals.find({"email": email}))

        journal_list = []
        for j in journals:
            # Decrypt the content to send back to the frontend safely
            try:
                decrypted_content = cipher_suite.decrypt(j["content"]).decode(
                    "utf-8"
                )
            except Exception:
                decrypted_content = "Error decrypting content."

            journal_list.append(
                {
                    "_id": str(j["_id"]),
                    "email": j.get("email"),
                    "title": j.get("title"),
                    "content": decrypted_content,
                    "stress_level": j.get("stress_level"),
                    "emotions": j.get(
                        "emotions", {}
                    ),  # Safely retrieve emotions
                    "date": j.get("date"),
                    "time_of_creation": j.get("time_of_creation"),
                }
            )

        return jsonify({"journals": journal_list}), 200

    except Exception as e:
        print(f"Error fetching journals: {e}")
        return jsonify({"error": "Internal server error"}), 500


@journal_bp.route("/<journal_id>", methods=["DELETE"])
def delete_journal(journal_id):
    try:
        result = db.journals.delete_one({"_id": ObjectId(journal_id)})
        if result.deleted_count == 1:
            return jsonify({"message": "Journal deleted successfully"}), 200
        else:
            return jsonify({"error": "Journal not found"}), 404
    except Exception as e:
        print(f"Error deleting journal: {e}")
        return jsonify({"error": "Internal server error"}), 500
