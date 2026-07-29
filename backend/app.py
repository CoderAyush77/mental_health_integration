from flask import Flask, jsonify
from flask_cors import CORS
from routes.auth import auth_bp
from routes.settings import settings_bp
from routes.journal import journal_bp
from routes.dashboard import dashboard_bp
from routes.voice import voice_bp
from routes.analytics import analytics_bp  # <-- ADDED THIS

app = Flask(__name__)
CORS(app)

# Replace your blueprint registrations with this:
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(settings_bp, url_prefix="/api/settings")
app.register_blueprint(journal_bp, url_prefix="/api/journal")
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
app.register_blueprint(voice_bp, url_prefix="/api/voice")
app.register_blueprint(analytics_bp, url_prefix="/api/analytics")


@app.route("/")
def home():
    return jsonify({"message": "Server is running!"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
