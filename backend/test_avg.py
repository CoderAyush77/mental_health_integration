import joblib
import numpy as np
from utils.predictor import *

text = '''Today felt much heavier than I expected. There are so many responsibilities piling up that I don't know where to start anymore. My assignment
I noticed that I couldn't concentrate properly today. Every time I tried to study, my mind wandered to everything I still haven't completed. It's frustrating b
I kept thinking about whether I'm falling behind everyone else. Sometimes it feels like everyone is moving forward while I'm struggling to keep up. I hope this '''

lines = text.split('\n')
all_probs = []
for line in lines:
    cleaned = clean_text(line)
    encoded = bert_tokenizer([cleaned], padding=True, truncation=True, max_length=128, return_tensors='pt').to(DEVICE)
    output = bert_model(**encoded, output_hidden_states=True)
    probs = softmax(output.logits.cpu().detach().numpy(), axis=1)[0]
    all_probs.append(probs)

avg_probs = np.mean(all_probs, axis=0)
print('Avg Emotions:', {l: float(s) for l, s in zip(EMOTION_LABELS, avg_probs)})
