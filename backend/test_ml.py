# test_ml.py
from utils.predictor import evaluate_journal_stress


def run_test():
    print("🚀 Booting up the SereneMind ML Engine...")
    print(
        "Loading BERT and Logistic Regression models. This might take a few seconds on the first run...\n"
    )

    # Test Case 1: High Stress Scenario
    text_1 = "I am feeling so overwhelmed today. The deadlines are piling up, my chest feels tight, and I just can't seem to catch a break. Everything is going wrong."

    # Test Case 2: Low Stress / Calm Scenario
    text_2 = "Today was actually a really good day. I finished my tasks early, went for a nice walk, and I'm feeling very relaxed and optimistic about tomorrow."

    print("--- TEST CASE 1 (Expected: High/Extreme Stress) ---")
    stress_1, emotions_1 = evaluate_journal_stress(text_1)
    print(f"Predicted Stress Tier: {stress_1}")
    print(f"Raw BERT Emotions: {emotions_1}\n")

    print("--- TEST CASE 2 (Expected: Low Stress) ---")
    stress_2, emotions_2 = evaluate_journal_stress(text_2)
    print(f"Predicted Stress Tier: {stress_2}")
    print(f"Raw BERT Emotions: {emotions_2}\n")


if __name__ == "__main__":
    run_test()
