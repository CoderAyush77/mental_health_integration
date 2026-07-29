import requests

# The URL of your local Flask server
url = "http://127.0.0.1:5000/api/voice/create"

# The text data
form_data = {
    "email": "test@serenemind.com",
    "content": "This is my audio transcript test.",
}

# The audio file (Fixed the quotes here!)
files = {
    "audio": open(
        r"C:\Users\APLUS\Documents\Sound Recordings\Recording.m4a", "rb"
    )
}

print("Sending audio to PyTorch backend...")

# Send the POST request
response = requests.post(url, data=form_data, files=files)

# Print the results!
print(f"Status Code: {response.status_code}")
print("Response:")
print(response.json())
