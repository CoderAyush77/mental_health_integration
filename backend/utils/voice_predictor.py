# utils/voice_predictor.py
import os
import tempfile
import torch
import torch.nn as nn
import torch.nn.functional as F
import librosa
from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2Model
import warnings

warnings.filterwarnings("ignore")

MODEL_NAME = "facebook/wav2vec2-base"
SAMPLE_RATE = 16000
MAX_LENGTH = SAMPLE_RATE * 4  # 4 seconds
DEVICE = "cpu"

STRESS_LABELS = ["Low", "Moderate", "High"]
POSITIVITY_LABELS = ["Negative", "Neutral", "Positive"]
POSITIVITY_SCORE = {"Negative": 0.0, "Neutral": 50.0, "Positive": 100.0}

print("Loading Wav2Vec2 Feature Extractor...")
feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_NAME)


# --- PyTorch Architecture Blueprint ---
class StressClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.wav2vec2 = Wav2Vec2Model.from_pretrained(MODEL_NAME)
        self.wav2vec2.feature_extractor._freeze_parameters()

        hidden = self.wav2vec2.config.hidden_size
        self.stress_head = nn.Linear(hidden, len(STRESS_LABELS))
        self.positivity_head = nn.Linear(hidden, len(POSITIVITY_LABELS))

    def forward(self, input_values):
        hidden_states = self.wav2vec2(input_values).last_hidden_state
        pooled = hidden_states.mean(dim=1)  # average over time
        return self.stress_head(pooled), self.positivity_head(pooled)


# --- INJECTING THE WEIGHTS INTO THE BLUEPRINT ---
try:
    print("Loading 300MB Voice PyTorch Model...")

    # 1. Initialize the empty model (The Blueprint)
    model = StressClassifier().to(DEVICE)

    # 2. Load the weights from the file (The Data)
    # Ensure this absolute path points exactly to where the file is on your computer!
    state_dict = torch.load(
        r"C:\Users\APLUS\Desktop\Backend\ml_models\voice_model.pt",
        map_location=torch.device(DEVICE),
    )

    # 3. Pour the weights into the model
    model.load_state_dict(state_dict)
    model.eval()

    print("Voice Model Loaded Successfully!")
except Exception as e:
    print(f"⚠️ CRITICAL: Could not load voice model. Error: {e}")


# --- MAIN INFERENCE FUNCTION ---
def evaluate_voice_audio(audio_file):
    """
    Takes a Flask FileStorage audio object, saves it temporarily,
    runs PyTorch inference, and returns metrics for the frontend UI.
    """
    temp_path = tempfile.mktemp(suffix=".wav")
    audio_file.save(temp_path)

    try:
        # Process audio
        speech, _ = librosa.load(temp_path, sr=SAMPLE_RATE)
        speech = librosa.util.fix_length(speech, size=MAX_LENGTH)

        input_values = feature_extractor(
            speech, sampling_rate=SAMPLE_RATE, return_tensors="pt"
        ).input_values.to(DEVICE)

        with torch.no_grad():
            stress_logits, pos_logits = model(input_values)
            stress_probs = F.softmax(stress_logits, dim=-1)[0].cpu().numpy()
            pos_probs = F.softmax(pos_logits, dim=-1)[0].cpu().numpy()

        stress_idx = int(stress_probs.argmax())
        positivity_score = float(
            sum(
                p * POSITIVITY_SCORE[l]
                for p, l in zip(pos_probs, POSITIVITY_LABELS)
            )
        )

        overall_emotion = STRESS_LABELS[stress_idx]
        confidence = round(float(stress_probs[stress_idx]) * 100, 2)

        # Structure the exact dictionary voice.py expects (Cleaned up!)
        tone_metrics = {
            "confidence": confidence,
            "stress_level": stress_idx
            * 40,  # Converts index 0,1,2 to a 0-100 scale for UI
            "positivity": positivity_score,
        }

        return tone_metrics, overall_emotion

    except Exception as e:
        print(f"Error processing audio in PyTorch: {e}")
        # Cleaned up the fallback dictionary too!
        return {
            "confidence": 0,
            "stress_level": 0,
            "positivity": 50,
        }, "Moderate"

    finally:
        # Cleanup: Delete the temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
