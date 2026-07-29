import joblib
import numpy as np
from utils.predictor import *

sentences = [
    "Today felt much heavier than I expected. There are so many responsibilities piling up that I don't know where to start anymore. My assignment",
    "I noticed that I couldn't concentrate properly today. Every time I tried to study, my mind wandered to everything I still haven't completed. It's frustrating b",
    "I kept thinking about whether I'm falling behind everyone else. Sometimes it feels like everyone is moving forward while I'm struggling to keep up. I hope this "
]

for i, s in enumerate(sentences):
    cleaned = clean_text(s)
    encoded = bert_tokenizer([cleaned], padding=True, truncation=True, max_length=128, return_tensors='pt').to(DEVICE)
    output = bert_model(**encoded, output_hidden_states=True)
    probs = softmax(output.logits.cpu().detach().numpy(), axis=1)[0]
    print(f'Sentence {i+1} Emotions:', {l: float(p) for l, p in zip(EMOTION_LABELS, probs)})
