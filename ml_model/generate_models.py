import joblib
import os
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

# 1. Generate bert_config
bert_config = {"bert_model": "j-hartmann/emotion-english-distilroberta-base"}
joblib.dump(bert_config, "bert_model_name.pkl")

# 2. Generate dummy data for scaler and classifier
# Embedding size is 768, emotions are 7, total 775 features
num_samples = 100
num_features = 768 + 7

X = np.random.rand(num_samples, num_features)
# Let's make the stress labels "Low", "Medium", "High"
y = np.random.choice(["Low", "Medium", "High"], size=num_samples)

# 3. Train scaler
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
joblib.dump(scaler, "feature_scaler.pkl")

# 4. Train classifier
classifier = LogisticRegression()
classifier.fit(X_scaled, y)
joblib.dump(classifier, "stress_model.pkl")

print("Models generated successfully!")
