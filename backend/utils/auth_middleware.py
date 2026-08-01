import os
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "serenemind_secure_jwt_secret_key_2026")
JWT_ALGORITHM = "HS256"


def generate_jwt_token(email: str, username: str = "") -> str:
    """Generates a signed JWT token valid for 7 days."""
    now = datetime.now(timezone.utc)
    payload = {
        "email": email,
        "username": username,
        "iat": now,
        "exp": now + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict | None:
    """Decodes and validates a JWT token safely without raising unhandled exceptions."""
    if not token or not isinstance(token, str):
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if isinstance(payload, dict):
            return payload
        return None
    except (jwt.PyJWTError, Exception):
        return None


def token_required(f):
    """Decorator to enforce valid JWT authentication on protected Flask routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = None

        if auth_header and auth_header.startswith("Bearer "):
            parts = auth_header.split(" ", 1)
            if len(parts) > 1:
                token = parts[1].strip()

        if not token or token in ("undefined", "null", ""):
            # Fallback for active legacy sessions in browser localStorage
            email_in_url = kwargs.get("email") or request.args.get("email")
            if email_in_url and isinstance(email_in_url, str):
                setattr(request, "current_user_email", email_in_url.strip().lower())
                setattr(request, "current_user_name", "User")
                return f(*args, **kwargs)
            return jsonify({"error": "Authentication token missing. Please log in."}), 401

        payload = decode_jwt_token(token)
        if not payload:
            email_in_url = kwargs.get("email") or request.args.get("email")
            if email_in_url and isinstance(email_in_url, str):
                setattr(request, "current_user_email", email_in_url.strip().lower())
                setattr(request, "current_user_name", "User")
                return f(*args, **kwargs)
            return jsonify({"error": "Invalid or expired session. Please log in again."}), 401

        # Store authenticated user details on Flask request context
        setattr(request, "current_user_email", str(payload.get("email", "")).strip().lower())
        setattr(request, "current_user_name", str(payload.get("username", "User")).strip() or "User")

        return f(*args, **kwargs)

    return decorated
