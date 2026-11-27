"""Train the chat intent classifier.

Run:  python -m app.chat.train

TF-IDF over character n-grams (char_wb, 2-4) + logistic regression (see textclf.py).
Character n-grams handle Hebrew prefixes (ה, ב, ל, ש...) without a tokenizer or stemmer.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib

from app.chat.textclf import IntentClassifier, classification_report, stratified_split

CHAT_DIR = Path(__file__).resolve().parent
DATA_PATH = CHAT_DIR / "training_data.jsonl"
MODEL_PATH = CHAT_DIR / "model.joblib"
RANDOM_STATE = 42


def load_data(path: Path = DATA_PATH) -> tuple[list[str], list[str]]:
    texts, labels = [], []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            texts.append(row["text"])
            labels.append(row["intent"])
    return texts, labels


def train(verbose: bool = True, model_path: Path = MODEL_PATH) -> dict:
    texts, labels = load_data()
    x_train, x_test, y_train, y_test = stratified_split(texts, labels, test_size=0.25, seed=RANDOM_STATE)

    # 1) Evaluate on a held-out split: the model never saw these sentences.
    model = IntentClassifier().fit(x_train, y_train)
    pred = model.predict(x_test)
    acc = sum(p == t for p, t in zip(pred, y_test)) / len(y_test)
    if verbose:
        print(f"examples: {len(texts)} (train {len(x_train)}, test {len(x_test)})")
        print(f"test accuracy: {acc:.3f}")
        print(classification_report(y_test, pred))

    # 2) Final model: fit on all examples and save.
    final = IntentClassifier().fit(texts, labels)
    joblib.dump(final, model_path)
    if verbose:
        print(f"saved {model_path.name}")
    return {"accuracy": acc, "n": len(texts)}


if __name__ == "__main__":
    train()
