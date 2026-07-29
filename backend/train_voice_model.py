import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from transformers import Wav2Vec2FeatureExtractor
from datasets import load_dataset, Audio
import librosa
import numpy as np
import warnings
warnings.filterwarnings("ignore")

# Use the exact same model architecture
from utils.voice_predictor import StressClassifier, MODEL_NAME, SAMPLE_RATE, MAX_LENGTH, DEVICE

print(f"Using device: {DEVICE}")

# Load dataset
print("Loading RAVDESS dataset...")
ds = load_dataset('xbgoose/ravdess', split='train')
ds = ds.cast_column("audio", Audio(decode=False))

feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_NAME)

def map_emotion(label_str):
    label_str = str(label_str).lower()
    if label_str in ['neutral', 'calm', 'happy', 'surprised']:
        stress = 0 # Low
    elif label_str in ['sad', 'disgust']:
        stress = 1 # Moderate
    elif label_str in ['angry', 'fearful']:
        stress = 2 # High
    else:
        stress = 0
        
    if label_str in ['sad', 'angry', 'fearful', 'disgust']:
        pos = 0 # Negative
    elif label_str in ['neutral', 'calm', 'surprised']:
        pos = 1 # Neutral
    elif label_str in ['happy']:
        pos = 2 # Positive
    else:
        pos = 1
        
    return stress, pos

class RavdessDataset(Dataset):
    def __init__(self, hf_ds):
        self.hf_ds = hf_ds
        
    def __len__(self):
        return len(self.hf_ds)
        
    def __getitem__(self, index):
        item = self.hf_ds[index]
        
        try:
            import io
            import soundfile as sf
            audio_bytes = item['audio']['bytes']
            audio_array, sr = sf.read(io.BytesIO(audio_bytes))
            
            if sr != SAMPLE_RATE:
                audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=SAMPLE_RATE)
                
            audio_array = librosa.util.fix_length(audio_array, size=MAX_LENGTH)
        except Exception as e:
            # Fallback for weird files
            audio_array = np.zeros(MAX_LENGTH)
            
        stress, pos = map_emotion(item['emotion'])
        
        inputs = feature_extractor(audio_array, sampling_rate=SAMPLE_RATE, return_tensors="pt")
        return {
            'input_values': inputs.input_values[0],
            'stress': torch.tensor(stress, dtype=torch.long),
            'positivity': torch.tensor(pos, dtype=torch.long)
        }

print("Preparing dataset...")
train_dataset = RavdessDataset(ds)
# Using the full dataset for a production model
train_loader = DataLoader(train_dataset, batch_size=8, shuffle=True)

model = StressClassifier().to(DEVICE)

optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
criterion = nn.CrossEntropyLoss()

EPOCHS = 3
print("Starting training...")

for epoch in range(EPOCHS):
    model.train()
    total_loss = 0
    correct_stress = 0
    correct_pos = 0
    total = 0
    
    for batch_idx, batch in enumerate(train_loader):
        input_values = batch['input_values'].to(DEVICE)
        stress_labels = batch['stress'].to(DEVICE)
        pos_labels = batch['positivity'].to(DEVICE)
        
        optimizer.zero_grad()
        
        stress_logits, pos_logits = model(input_values)
        
        loss_stress = criterion(stress_logits, stress_labels)
        loss_pos = criterion(pos_logits, pos_labels)
        loss = loss_stress + loss_pos
        
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        
        _, predicted_stress = torch.max(stress_logits.data, 1)
        _, predicted_pos = torch.max(pos_logits.data, 1)
        
        total += stress_labels.size(0)
        correct_stress += (predicted_stress == stress_labels).sum().item()
        correct_pos += (predicted_pos == pos_labels).sum().item()
        
        if batch_idx % 10 == 0:
            print(f"Epoch [{epoch+1}/{EPOCHS}], Step [{batch_idx}/{len(train_loader)}], Loss: {loss.item():.4f}")
            
    stress_acc = 100 * correct_stress / total
    pos_acc = 100 * correct_pos / total
    print(f"Epoch {epoch+1} Summary: Stress Acc: {stress_acc:.2f}%, Pos Acc: {pos_acc:.2f}%")

model.eval()
model_save_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml_voice_models", "voice_model.pt"))
os.makedirs(os.path.dirname(model_save_path), exist_ok=True)
torch.save(model.state_dict(), model_save_path)
print(f"Model successfully saved to {model_save_path}")
