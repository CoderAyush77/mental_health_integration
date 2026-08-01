import os
import tempfile
import torch
import torch.nn as nn
import torch.nn.functional as F
import librosa
from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2Model

# Global setup
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_NAME = "facebook/wav2vec2-base"
SAMPLE_RATE = 16000
MAX_LENGTH = SAMPLE_RATE * 4  # 4 seconds

STRESS_LABELS = ["Low", "Moderate", "High"]
POSITIVITY_LABELS = ["Negative", "Neutral", "Positive"]
POSITIVITY_SCORE = {"Negative": 0.0, "Neutral": 50.0, "Positive": 100.0}


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


# Initialize model and feature extractor once at startup
feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_NAME)
model = StressClassifier().to(DEVICE)
model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml_voice_models", "voice_model.pt"))

if os.path.exists(model_path):
    model.load_state_dict(torch.load(model_path, map_location=DEVICE))
    model.eval()
    print("PyTorch Voice Model loaded successfully.")
else:
    print(f"Warning: Model not found at {model_path}. Using uninitialized weights.")


def evaluate_voice_audio(audio_file):
    """
    Takes a Flask FileStorage object (audio_file), saves it temporarily,
    analyzes it, and returns (metrics_dict, overall_emotion).
    """
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, "temp_recording.wav")

    # If audio_file is a string path (for local script testing)
    if isinstance(audio_file, str):
        target_path = audio_file
    else:
        audio_file.save(temp_path)
        target_path = temp_path

    try:
        speech, _ = librosa.load(target_path, sr=SAMPLE_RATE)
        speech = librosa.util.fix_length(speech, size=MAX_LENGTH)
        input_values = feature_extractor(speech, sampling_rate=SAMPLE_RATE, return_tensors="pt").input_values.to(DEVICE)

        with torch.no_grad():
            stress_logits, pos_logits = model(input_values)
            stress_probs = F.softmax(stress_logits, dim=-1)[0].cpu().numpy()
            pos_probs = F.softmax(pos_logits, dim=-1)[0].cpu().numpy()

        stress_idx = int(stress_probs.argmax())
        positivity_score = float(sum(p * POSITIVITY_SCORE[l] for p, l in zip(pos_probs, POSITIVITY_LABELS)))

        confidence = round(float(stress_probs[stress_idx]) * 100, 2)
        stress_level = STRESS_LABELS[stress_idx]
        positivity = round(positivity_score, 2)

        stress_percentage = int((stress_probs[1] * 50) + (stress_probs[2] * 100))

        tone_metrics = {
            "confidence": confidence,
            "stress_level": stress_percentage,
            "positivity": positivity,
            "stress_label": stress_level
        }

        overall_emotion = stress_level
        if stress_idx == 0:
            overall_emotion = "Calm" if positivity > 50 else "Neutral"
        elif stress_idx == 1:
            overall_emotion = "Moderate Stress"
        else:
            overall_emotion = "Highly Stressed"

        return tone_metrics, overall_emotion

    finally:
        if not isinstance(audio_file, str) and os.path.exists(temp_path):
            os.remove(temp_path)
