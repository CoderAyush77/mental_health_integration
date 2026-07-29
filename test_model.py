import requests

def test_phrase(phrase):
    data = {
        "email": "test@example.com",
        "title": "Test",
        "content": phrase
    }
    response = requests.post("http://127.0.0.1:5000/api/journal/create", json=data)
    json_data = response.json()
    print(f"Phrase: '{phrase}'")
    
    # We want to see the exact negative score
    emotions = json_data.get('emotions', {})
    negative = sum([emotions.get(e, 0) for e in ['anger', 'fear', 'disgust', 'sadness']])
    
    print(f"Prediction: {json_data.get('stress_prediction')}")
    print(f"Negative Score: {negative:.2f}")
    print(f"Emotions: {emotions}\n")

test_phrase("I am doing okay. Nothing special happened today.") # Should be Low
test_phrase("It was a normal day.") # Should be Low
test_phrase("I am tired.") # Should be Medium
test_phrase("I am a bit stressed out from work.") # Should be Medium
test_phrase("I am having a terrible panic attack and I can't breathe!") # Should be Extreme
test_phrase("I failed my exam and my parents are so angry.") # Should be High
