import os
import torch
from torch.utils.data import Dataset
from transformers import (
    BertTokenizer,
    BertForSequenceClassification,
    Trainer,
    TrainingArguments,
)

# -------------------------------------------------------------------
# 1. Synthetic Dataset Definition
# -------------------------------------------------------------------
# Columns: Confidence, Energy, Stress, Pace, Positivity (all 0-100)

SYNTHETIC_DATA = [
    (
        "I am feeling extremely overwhelmed and anxious about everything.",
        [10.0, 20.0, 95.0, 80.0, 5.0],
    ),
    (
        "Everything is going great, I feel amazing today!",
        [90.0, 85.0, 10.0, 60.0, 95.0],
    ),
    (
        "I'm so tired, I can barely keep my eyes open.",
        [20.0, 10.0, 40.0, 30.0, 20.0],
    ),
    (
        "I am furious, this is completely unacceptable!",
        [80.0, 90.0, 85.0, 95.0, 5.0],
    ),
    (
        "I guess things are okay, nothing special.",
        [50.0, 40.0, 30.0, 50.0, 50.0],
    ),
    ("I am confident that we will win this.", [95.0, 70.0, 20.0, 60.0, 80.0]),
    (
        "I am terrified of what might happen next.",
        [15.0, 60.0, 90.0, 85.0, 10.0],
    ),
    (
        "Such a beautiful day, I love the sunshine.",
        [85.0, 75.0, 5.0, 55.0, 90.0],
    ),
    (
        "I've been working non-stop, I'm completely burnt out.",
        [30.0, 15.0, 88.0, 40.0, 15.0],
    ),
    ("Let's go, we can do this! Come on!", [95.0, 95.0, 40.0, 90.0, 85.0]),
]

# We expand this small dataset to pretend we have more data
texts = [item[0] for item in SYNTHETIC_DATA] * 10
labels = [item[1] for item in SYNTHETIC_DATA] * 10
# Normalize labels to 0.0 - 1.0 for MSELoss
labels = [[v / 100.0 for v in label_set] for label_set in labels]


class MetricsDataset(Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels

    def __getitem__(self, idx):
        item = {
            key: torch.tensor(val[idx]) for key, val in self.encodings.items()
        }
        # For regression with BCE/MSE, labels need to be float tensors
        item["labels"] = torch.tensor(self.labels[idx], dtype=torch.float)
        return item

    def __len__(self):
        return len(self.labels)


def train_model():
    print("Initializing tokenizer and model...")
    # Using tiny bert so training takes seconds instead of hours on CPU
    model_name = "prajjwal1/bert-tiny"

    tokenizer = BertTokenizer.from_pretrained(model_name)
    # num_labels=5 for our 5 metrics
    model = BertForSequenceClassification.from_pretrained(
        model_name, num_labels=5, problem_type="regression"
    )

    print("Tokenizing dataset...")
    encodings = tokenizer(texts, truncation=True, padding=True, max_length=128)
    dataset = MetricsDataset(encodings, labels)

    # -------------------------------------------------------------------
    # 2. Training configuration
    # -------------------------------------------------------------------
    output_dir = os.path.join(
        os.path.dirname(__file__), "saved_models", "bert_metrics"
    )

    training_args = TrainingArguments(
        output_dir="./results",
        num_train_epochs=5,
        per_device_train_batch_size=8,
        learning_rate=5e-4,
        weight_decay=0.01,
        logging_dir="./logs",
        logging_steps=10,
        save_strategy="no",
        use_cpu=True,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
    )

    print(
        "Starting training on synthetic dataset (Predicting Confidence, Energy, Stress, Pace, Positivity)..."
    )
    trainer.train()

    print(f"Training complete. Saving model to: {output_dir}")
    os.makedirs(output_dir, exist_ok=True)
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print("Model saved successfully!")


if __name__ == "__main__":
    train_model()
