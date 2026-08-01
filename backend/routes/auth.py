# This file handles user authentication (Signup, Login, Google Login, Forgot/Reset Password)

from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
import random
import re
import time

from database import users_collection
from utils.auth_middleware import generate_jwt_token

auth_bp = Blueprint("auth", __name__)

ALLOWED_EMAIL_DOMAINS = {
    "gmail.com",
    "outlook.com",
    "yahoo.com",
    "hotmail.com",
    "icloud.com",
    "live.com",
    "protonmail.com",
}

# Simple in-memory rate limiter tracking failed login attempts: { ip_or_email: (attempts, last_attempt_time) }
FAILED_LOGIN_ATTEMPTS = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_TIME_SECONDS = 300  # 5 minutes lockout


def is_valid_email_domain(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    parts = email.strip().lower().split("@")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return False
    domain = parts[1]
    return domain in ALLOWED_EMAIL_DOMAINS


def is_strong_password(password: str) -> tuple[bool, str]:
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character (!@#$%^&*)."
    return True, ""


@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "Missing required fields."}), 400

    if not is_valid_email_domain(email):
        return jsonify(
            {
                "error": "Please use a valid email from Gmail, Outlook, Yahoo, iCloud, or another supported provider."
            }
        ), 400

    is_strong, msg = is_strong_password(password)
    if not is_strong:
        return jsonify({"error": msg}), 400

    existing_user = users_collection.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "An account with this email already exists."}), 400

    hashed_password = generate_password_hash(password)

    first_name = name.split()[0].lower()
    random_numbers = random.randint(1000, 9999)
    generated_username = f"{first_name}_{random_numbers}"

    new_user = {
        "name": name,
        "email": email,
        "password": hashed_password,
        "username": generated_username,
    }

    users_collection.insert_one(new_user)

    # Generate JWT token upon registration
    token = generate_jwt_token(email, generated_username)

    return jsonify({
        "message": "User account was created successfully.",
        "token": token,
        "user": {
            "name": name,
            "username": generated_username,
            "email": email
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    now = time.time()
    attempts, last_time = FAILED_LOGIN_ATTEMPTS.get(email, (0, 0))

    if attempts >= MAX_FAILED_ATTEMPTS and (now - last_time) < LOCKOUT_TIME_SECONDS:
        remaining = int(LOCKOUT_TIME_SECONDS - (now - last_time))
        return jsonify(
            {
                "error": f"Too many failed login attempts. Please try again in {remaining} seconds."
            }
        ), 429

    user = users_collection.find_one({"email": email})
    if not user or not check_password_hash(user["password"], password):
        FAILED_LOGIN_ATTEMPTS[email] = (attempts + 1, now)
        return jsonify({"error": "Invalid email or password."}), 401

    # Reset failed login counter on successful login
    FAILED_LOGIN_ATTEMPTS.pop(email, None)

    username = user.get("username", "")
    token = generate_jwt_token(email, username)

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "name": user.get("name", "User"),
            "username": username,
            "email": email
        }
    }), 200


@auth_bp.route("/login_with_google", methods=["POST"])
def login_with_google():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required."}), 400

    if not is_valid_email_domain(email):
        return jsonify(
            {
                "error": "Please enter a supported Google / provider email domain."
            }
        ), 400

    existing_user = users_collection.find_one({"email": email})

    if not existing_user:
        return jsonify(
            {
                "error": "No account found with this email. Please sign up for an account first."
            }
        ), 404

    username = existing_user.get("username", f"user_{random.randint(1000, 9999)}")
    token = generate_jwt_token(email, username)

    return jsonify({
        "message": "Google login was successful",
        "token": token,
        "user": {
            "name": existing_user.get("name", "Google User"),
            "username": username,
            "email": email
        }
    }), 200


@auth_bp.route("/forgot_password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email address is required."}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        # Return success even if user not found to prevent user enumeration attacks
        return jsonify({"message": "If an account exists with that email, reset instructions have been dispatched."}), 200

    reset_token = generate_jwt_token(email, "reset_password")
    return jsonify({
        "message": "Password reset token generated successfully.",
        "reset_token": reset_token
    }), 200


@auth_bp.route("/reset_password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    reset_token = data.get("token")
    new_password = data.get("new_password")

    if not reset_token or not new_password:
        return jsonify({"error": "Reset token and new password are required."}), 400

    is_strong, msg = is_strong_password(new_password)
    if not is_strong:
        return jsonify({"error": msg}), 400

    from utils.auth_middleware import decode_jwt_token
    payload = decode_jwt_token(reset_token)

    if not payload or not payload.get("email"):
        return jsonify({"error": "Invalid or expired password reset link."}), 400

    email = payload.get("email")
    hashed_password = generate_password_hash(new_password)
    users_collection.update_one({"email": email}, {"$set": {"password": hashed_password}})

    return jsonify({"message": "Password has been successfully updated. You can now log in."}), 200
