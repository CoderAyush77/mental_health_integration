import requests

res = requests.get('http://127.0.0.1:5000/api/analytics/test@example.com')
history = res.json().get('text_history', [])
print("History:", history)
if history:
    doc_id = history[0]["id"]
    res2 = requests.get(f'http://127.0.0.1:5000/api/analytics/test@example.com/analysis?type=text&id={doc_id}')
    print("Analysis:", res2.json())
