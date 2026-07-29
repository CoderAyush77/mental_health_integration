import os
import torch
import joblib
import numpy as np
import pandas as pd
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from scipy.special import softmax
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
import warnings

warnings.filterwarnings('ignore')

# 1. SETUP
BERT_MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_dir = os.path.join(base_dir, "ml_model")

print(f"Using device: {DEVICE}")
print("Loading tokenizer and BERT model...")
tokenizer = AutoTokenizer.from_pretrained(BERT_MODEL_NAME)
bert_model = AutoModelForSequenceClassification.from_pretrained(BERT_MODEL_NAME)
bert_model.to(DEVICE)
bert_model.eval()

# 2. LOAD DATA
print("Loading Dreaddit dataset from Hugging Face...")
# We use 'andreagasparini/dreaddit' as it provides 'confidence' and 'label'
dataset = load_dataset('andreagasparini/dreaddit')
train_data = dataset['train']
test_data = dataset['test']

def mean_pool(last_hidden_state, attention_mask):
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
    return torch.sum(last_hidden_state * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)

def extract_features(texts):
    features = []
    
    # Process in batches for speed
    batch_size = 32
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        
        inputs = tokenizer(batch_texts, return_tensors="pt", padding=True, truncation=True, max_length=512)
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = bert_model(**inputs, output_hidden_states=True)
            
            # Emotions (7 features)
            logits = outputs.logits.cpu().numpy()
            emotions = softmax(logits, axis=1)
            
            # Embeddings (768 features)
            last_hidden_state = outputs.hidden_states[-1]
            pooled = mean_pool(last_hidden_state, inputs['attention_mask']).cpu().numpy()
            
            # Combine (768 + 7 = 775 features)
            combined = np.concatenate([pooled, emotions], axis=1)
            features.extend(combined)
            
        if (i + batch_size) % 320 == 0:
            print(f"Processed {i + batch_size} / {len(texts)} samples...")
            
    return np.array(features)

def map_labels(labels, confidences):
    y = []
    for label, conf in zip(labels, confidences):
        if label == 1:
            if conf >= 0.8:
                y.append('Extreme')
            else:
                y.append('High')
        else:
            if conf < 0.8:
                y.append('Medium')
            else:
                y.append('low')
    return np.array(y)

# 3. PREPARE TRAINING DATA
print(f"Processing training data ({len(train_data)} samples)...")
X_train = extract_features(train_data['text'])
y_train = map_labels(train_data['label'], train_data['confidence'])

# 4. PREPARE TESTING DATA
print(f"Processing testing data ({len(test_data)} samples)...")
X_test = extract_features(test_data['text'])
y_test = map_labels(test_data['label'], test_data['confidence'])

# 5. TRAIN SCALER & CLASSIFIER
print("Training StandardScaler and LogisticRegression...")
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Use class_weight='balanced' to handle any slight imbalances after mapping
lr_model = LogisticRegression(max_iter=1000, random_state=42, class_weight='balanced')
lr_model.fit(X_train_scaled, y_train)

# 6. EVALUATE
print("Evaluating on test set...")
y_pred = lr_model.predict(X_test_scaled)
acc = accuracy_score(y_test, y_pred)
print(f"Model Accuracy: {acc * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# 7. SAVE MODELS
print("Saving newly trained models to ml_model/...")
os.makedirs(model_dir, exist_ok=True)
joblib.dump(scaler, os.path.join(model_dir, "feature_scaler.pkl"))
joblib.dump(lr_model, os.path.join(model_dir, "stress_model.pkl"))
print("Done! Models have been updated.")
