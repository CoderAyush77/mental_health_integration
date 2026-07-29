import re
import string
from utils.predictor import evaluate_journal_stress

def train_clean(text):
    text = str(text).lower()
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    text = re.sub(r'<.*?>+', '', text)
    text = re.sub(r'[%s]' % re.escape(string.punctuation), '', text)
    text = re.sub(r'\n', '', text)
    text = re.sub(r'\w*\d\w*', '', text)
    return text

text = 'icannot do anything. I am very bad at it everything. I think i cannnot continue with my academcics. i am scared'
print("Cleaned text:", train_clean(text))
print("With training clean_text:")
print(evaluate_journal_stress(train_clean(text)))

print("With current clean_text:")
print(evaluate_journal_stress(text))
