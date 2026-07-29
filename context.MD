# Mental Health Analytics App - Project Context

## Project Overview
This project is a mental health journaling and analytics application that allows users to write journal entries, which are then analyzed by a backend machine learning pipeline to determine the user's emotional state and stress level. The results are displayed in a frontend dashboard.

## Architecture

### Frontend
- **Technology**: HTML, CSS, JavaScript (Vanilla).
- **Functionality**: 
  - Provides a dashboard interface for users.
  - Allows users to submit new journal entries.
  - Fetches and displays analytics data from the backend.
  - Visualizes stress levels and emotional distributions (anger, disgust, fear, joy, neutral, sadness, surprise) using charts and UI elements.

### Backend
- **Technology**: Python, Flask, SQLite (via SQLAlchemy).
- **Functionality**:
  - Exposes RESTful API endpoints for user authentication (mocked), submitting journal entries, and retrieving analytics data.
  - Manages the database (`app.db`) containing `User`, `Document`, and `TextAnalysis` tables.
  - Handles the machine learning inference pipeline for incoming text data.

## Machine Learning Pipeline (`backend/utils/predictor.py`)
The project utilizes a hybrid NLP pipeline combining a pre-trained transformer model with a custom classical classifier:

1. **Text Preprocessing**: 
   - Incoming journal text is cleaned (lowercased, punctuation removed, multiple spaces collapsed) to match the exact format the models were trained on.
2. **BERT Embedding & Emotion Extraction**: 
   - The cleaned text is tokenized and passed through a DistilRoBERTa model fine-tuned for emotion recognition (`j-hartmann/emotion-english-distilroberta-base`).
   - The model outputs 7 raw emotion probabilities (anger, disgust, fear, joy, neutral, sadness, surprise).
   - The model's last hidden state is mean-pooled and L2-normalized to create a 768-dimensional sentence embedding.
3. **Feature Scaling**: 
   - The 768-dimensional embedding and 7 emotion probabilities are concatenated into a single 775-dimensional feature vector.
   - This vector is scaled using a trained `StandardScaler` (`ml_model/feature_scaler.pkl`).
4. **Stress Prediction**: 
   - The scaled 775-dimensional feature vector is passed to a trained multiclass Logistic Regression model (`ml_model/stress_model.pkl`).
   - The logistic regression model predicts the final stress tier: `['Extreme', 'High', 'Medium', 'low']`.

## Key Files and Directories
- `backend/app.py`: The main Flask server entry point defining the API routes.
- `backend/database.py`: Defines the SQLAlchemy database schema.
- `backend/utils/predictor.py`: Contains the `evaluate_journal_stress` function which runs the ML pipeline.
- `ml_model/`: Contains the actual, trained classical ML models (`stress_model.pkl`, `feature_scaler.pkl`).
- `ml_models/`: Contains experimental or alternative models (e.g., `voice_model.pt`).
- `BertModelTrained.ipynb`: The Jupyter Notebook used by the developer to train the logistic regression classifier and scaler using the original `Combined Data.csv` dataset.

## Current State & Recent Fixes
- The backend API has been verified to correctly execute the inference pipeline and correctly returns the predictions made by the original `stress_model.pkl`.
- A previous discrepancy between frontend results and Jupyter Notebook testing was resolved. It was found that the DistilRoBERTa model is highly sensitive to the length and exact wording of the text. Testing truncated vs full text produces significantly different emotion probabilities and final stress predictions. When evaluating identical strings, the backend API mathematically matches the notebook's behavior exactly.
