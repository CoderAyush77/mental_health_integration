# SereneMind Backend & ML Setup Guide

## Quick Start & Model Generation

Before launching the server for the first time, make sure to generate the local NLP models and place the PyTorch voice reflection model.

### 1. Generate NLP Models
Run the model generator script in the `ml_model/` directory:
```bash
python ml_model/generate_models.py
```
This generates:
- `stress_model.pkl`
- `feature_scaler.pkl`
- `bert_model_name.pkl`

### 2. Place Voice Model
Place the trained PyTorch voice model file `voice_model.pt` at:
```
ml_voice_models/voice_model.pt
```
*(The backend fallback loader also checks `ml_model/voice_model.pt` and `backend/saved_models/voice_model.pt`).*

### 3. Launch Application
Run the startup batch script from root:
```cmd
Start-App.bat
```
- **Backend API**: `http://localhost:5000`
- **Frontend App**: `http://localhost:8000`
