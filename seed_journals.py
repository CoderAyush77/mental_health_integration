import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.abspath('backend'))
from database import db, cipher_suite

email = "prakayu@gmail.com"

dummy_data = [
    {"title": "Great Monday", "content": "I had a wonderful day today! So much joy.", "stress_level": "Low", "emotions": {"joy": 0.9, "neutral": 0.1}},
    {"title": "Busy Tuesday", "content": "Just working all day, feeling a bit tired.", "stress_level": "Medium", "emotions": {"neutral": 0.7, "sadness": 0.3}},
    {"title": "Hump Day Stress", "content": "So stressed about the deadline, panicked.", "stress_level": "High", "emotions": {"fear": 0.8, "sadness": 0.2}},
    {"title": "Calm Thursday", "content": "Taking it easy. Read a good book.", "stress_level": "Low", "emotions": {"joy": 0.6, "neutral": 0.4}},
    {"title": "Frustrating Friday", "content": "Traffic was terrible, people were rude.", "stress_level": "High", "emotions": {"anger": 0.9, "disgust": 0.1}},
    {"title": "Relaxing Saturday", "content": "Slept in and enjoyed the weekend.", "stress_level": "Low", "emotions": {"joy": 0.8, "neutral": 0.2}},
    {"title": "Sunday Scaries", "content": "Dreading work tomorrow, feeling a bit down.", "stress_level": "Medium", "emotions": {"fear": 0.4, "sadness": 0.4, "neutral": 0.2}},
]

today = datetime.now(timezone.utc)

# First let's clear out some old test data to make the chart clean
# We will only keep the 7 days we insert so the chart looks perfect
db.journals.delete_many({"email": email})

for i, data in enumerate(dummy_data):
    # This loop inserts data from 6 days ago up to today
    entry_date = today - timedelta(days=(6 - i))
    date_str = entry_date.strftime("%Y-%m-%d")
    
    encrypted_content = cipher_suite.encrypt(data["content"].encode("utf-8"))
    
    journal_entry = {
        "email": email,
        "title": data["title"],
        "content": encrypted_content,
        "stress_level": data["stress_level"],
        "emotions": data["emotions"],
        "date": date_str,
        "time_of_creation": "12:00:00"
    }
    
    db.journals.insert_one(journal_entry)
    print(f"Inserted entry for {date_str} - Stress: {data['stress_level']}")

print("Old data cleared. 7 days of perfect dummy data inserted successfully!")
