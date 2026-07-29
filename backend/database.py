import os
from pymongo import MongoClient
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# --- DATABASE SETUP ---
client = MongoClient("mongodb://localhost:27017/")
db = client["serenemind_db"]

users_collection = db["users"]
journals_collection = db["journals"]
checkins_collection = db["checkins"]
voice_collection = db["voice_reflections"]

# --- GLOBAL ENCRYPTION SETUP ---
# Grab the key from .env, or generate a temporary one if it's missing
secret = os.getenv("FERNET_SECRET_KEY")
if not secret:
    secret = Fernet.generate_key().decode()

SECRET_KEY = secret.encode()
cipher_suite = Fernet(SECRET_KEY)
