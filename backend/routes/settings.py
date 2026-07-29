from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from database import (
    users_collection,
    journals_collection,
    checkins_collection,
    voice_collection,
)

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/<email>", methods=["GET"])
def get_user_settings(email):
    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "user not found"}), 404
    return (
        jsonify(
            {
                "ProfileInformation": {
                    "fullName": user.get("name", ""),
                    "email": user.get("email", ""),
                    "username": user.get("username", ""),
                },
                "preferences": {
                    "email_notifications": user.get(
                        "email_notifications", True
                    ),
                    "dark_mode": user.get("dark_mode", False),
                },
            }
        ),
        200,
    )


# update user info and preferences
@settings_bp.route("/update", methods=["PUT"])
def update_profile():
    data = request.get_json()
    email = data.get("email")  # to know whose account is this

    if not email:
        return jsonify({"error": "email is not present"}), 400
    update_field = {
        "name": data.get("fullName"),
        "username": data.get("username"),
        "email_notifications": data.get("email_notifications"),
        "dark_mode": data.get("dark_mode"),
    }

    # now we'll search in db using email and set the update_field in it
    result = users_collection.update_one(
        {"email": email}, {"$set": update_field}
    )  # $set->tell to now touch this five fields
    if result.matched_count == 0:
        return jsonify({"error": "user not found"}), 404
    return jsonify({"message": "profile has been updated successfully"}), 200


# API for changing the password
@settings_bp.route("/change-password", methods=["PUT"])
def change_password():
    data = request.get_json()
    email = data.get("email")
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not email or not current_password or not new_password:
        return jsonify({"error": "fill all the fields properly"}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "email not found"}), 404

    # check if it matches with the old passowrd
    if not check_password_hash(user["password"], current_password):
        return jsonify({"error": "Incorrect password"}), 401

    hashed_password = generate_password_hash(new_password)

    users_collection.update_one(
        {"email": email}, {"$set": {"password": hashed_password}}
    )
    return jsonify({"message": "Password updated successfully!"}), 200


# delete the user account
@settings_bp.route("/delete", methods=["DELETE"])
def delete():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "fill all the fields properly"}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "user not found"}), 404

    if not check_password_hash(user["password"], password):
        return jsonify({"error": "Incorrect password. Deletion halted."}), 401

    journals_collection.delete_many({"email": email})
    voice_collection.delete_many({"email": email})
    checkins_collection.delete_many({"email": email})
    users_collection.delete_one({"email": email})

    return jsonify({"message": "user account is deleted successfully!"}), 200
