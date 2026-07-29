# This file will specifically handle anything related to user accounts (Signup, Login, Logout)

from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
import random

from database import users_collection  # importing the database collection

# let's created an aunthenticatio department(blueprint) for the app
auth_bp = Blueprint(
    "auth", __name__
)  # handles signup, login, logout, forgot password


@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = (
        request.get_json()
    )  # receives the data from the react & conerts to python dictionary

    name = data.get("name")
    email = data.get("email")
    password = data.get(
        "password"
    )  # from here we extracted all name , email and password

    # lets check if the email already existes or not ?
    existing_user = users_collection.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "email already exists"}), 400

    # hide the password in the database by hashing it
    hashed_password = generate_password_hash(
        password
    )  # the password is hashed

    # autogeneration of the username in the system
    first_name = name.split()[0].lower()
    random_numbers = random.randint(1000, 9999)
    generated_username = f"{first_name}_{random_numbers}"

    new_user = {
        "name": name,
        "email": email,
        "password": hashed_password,
        "username": generated_username,
    }

    users_collection.insert_one(
        new_user
    )  # inserted the new user details in the collection

    return jsonify({
        "message": "user account was created succesfuuly",
        "user": {
            "name": name,
            "username": generated_username
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    user = users_collection.find_one(
        {"email": email}
    )  # it got all the data including the password as well
    if not user:
        return jsonify({"error": "no email found in our system"}), 404

    if check_password_hash(user["password"], password):
        return jsonify({
            "message": "Login successful",
            "user": {
                "name": user.get("name", "User"),
                "username": user.get("username", "")
            }
        }), 200
    else:
        return jsonify({"error": "Incorrect password"}), 401


@auth_bp.route("/login_with_google", methods=["POST"])
def login_with_google():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"error": "email is not present"}), 400

    existing_user = users_collection.find_one({"email": email})

    if not existing_user:
        # Auto-create the user if they don't exist
        first_name = "User"
        fallback_username = f"user_{random.randint(1000, 9999)}"

        new_user = {
            "name": "Google User",
            "email": email,
            "password": generate_password_hash(
                "google_oauth_fallback_pwd_"
                + str(random.randint(10000, 99999))
            ),
            "username": fallback_username,
        }
        users_collection.insert_one(new_user)
        existing_user = new_user

    # 1. Generate the fallback username if missing
    first_name = existing_user.get("name", "User").split()[0].lower()
    fallback_username = f"{first_name}_{random.randint(1000, 9999)}"

    # 2. Return both the name and the username!
    return (
        jsonify(
            {
                "message": "Google login was successful",
                "user": {
                    "name": existing_user.get("name", "Google User"),
                    "username": existing_user.get(
                        "username", fallback_username
                    ),
                },
            }
        ),
        200,
    )
