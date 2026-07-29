import requests

try:
    # 1. Test basic server
    res = requests.get('http://127.0.0.1:5000/')
    print("Server root response:", res.json())

    # 2. Test journal creation (which triggers ML models and MongoDB)
    payload = {
        "email": "test@demo.com",
        "title": "Integration Test",
        "content": "I am feeling a little bit stressed today but also happy."
    }
    res = requests.post('http://127.0.0.1:5000/api/journal/create', json=payload)
    print("Journal creation response:", res.json())

except Exception as e:
    print("Error connecting to server:", e)
