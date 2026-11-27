"""A small text classifier in plain numpy: TF-IDF over character n-grams + multinomial logistic regression.

Same algorithm and API shape as scikit-learn's
    Pipeline([TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), sublinear_tf=True),
              LogisticRegression(C=10)])
(fit / predict / predict_proba / classes_). Written out by hand so every step is visible,
and because scikit-learn+scipy could not be installed on the dev machine (disk full).
"""
from __future__ import annotations

import math
import re
from collections import Counter

import numpy as np

_WS = re.compile(r"\s+")


def char_wb_ngrams(text: str, n_min: int = 2, n_max: int = 4) -> list[str]:
    """Like sklearn's analyzer='char_wb': n-grams inside word boundaries, each word padded with spaces."""
    grams: list[str] = []
    for word in _WS.split(text.lower()):
        if not word:
            continue
        w = f" {word} "
        for n in range(n_min, n_max + 1):
            if len(w) < n:
                break
            grams.extend(w[i:i + n] for i in range(len(w) - n + 1))
    return grams


class TfidfCharVectorizer:
    def __init__(self, ngram_range: tuple[int, int] = (2, 4)):
        self.ngram_range = ngram_range
        self.vocab_: dict[str, int] = {}
        self.idf_: np.ndarray | None = None

    def _counts(self, text: str) -> Counter:
        return Counter(char_wb_ngrams(text, *self.ngram_range))

    def fit(self, texts: list[str]) -> "TfidfCharVectorizer":
        df: Counter = Counter()
        for t in texts:
            df.update(set(self._counts(t)))
        self.vocab_ = {g: i for i, g in enumerate(sorted(df))}
        n = len(texts)
        # smooth idf, as in sklearn: ln((1+n)/(1+df)) + 1
        self.idf_ = np.array([math.log((1 + n) / (1 + df[g])) + 1 for g in sorted(df)])
        return self

    def transform(self, texts: list[str]) -> np.ndarray:
        X = np.zeros((len(texts), len(self.vocab_)))
        for r, t in enumerate(texts):
            for g, c in self._counts(t).items():
                j = self.vocab_.get(g)
                if j is not None:
                    X[r, j] = 1 + math.log(c)  # sublinear tf
        X *= self.idf_
        norms = np.linalg.norm(X, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return X / norms


class SoftmaxRegression:
    """Multinomial logistic regression with L2 penalty, trained by full-batch gradient descent."""

    def __init__(self, C: float = 10.0, lr: float = 2.0, max_iter: int = 3000, tol: float = 1e-6):
        self.C, self.lr, self.max_iter, self.tol = C, lr, max_iter, tol
        self.classes_: np.ndarray | None = None
        self.W: np.ndarray | None = None
        self.b: np.ndarray | None = None

    @staticmethod
    def _softmax(z: np.ndarray) -> np.ndarray:
        z = z - z.max(axis=1, keepdims=True)
        e = np.exp(z)
        return e / e.sum(axis=1, keepdims=True)

    def fit(self, X: np.ndarray, y: list[str]) -> "SoftmaxRegression":
        self.classes_ = np.array(sorted(set(y)))
        idx = {c: i for i, c in enumerate(self.classes_)}
        n, d = X.shape
        k = len(self.classes_)
        Y = np.zeros((n, k))
        Y[np.arange(n), [idx[c] for c in y]] = 1
        self.W, self.b = np.zeros((d, k)), np.zeros(k)
        lam = 1.0 / (self.C * n)
        prev = None
        for _ in range(self.max_iter):
            P = self._softmax(X @ self.W + self.b)
            G = P - Y
            self.W -= self.lr * (X.T @ G / n + lam * self.W)
            self.b -= self.lr * G.mean(axis=0)
            loss = -np.sum(Y * np.log(P + 1e-12)) / n
            if prev is not None and abs(prev - loss) < self.tol:
                break
            prev = loss
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self._softmax(X @ self.W + self.b)


class IntentClassifier:
    """vectorizer + classifier, sklearn-Pipeline-like."""

    def __init__(self, C: float = 10.0):
        self.vec = TfidfCharVectorizer((2, 4))
        self.clf = SoftmaxRegression(C=C)

    @property
    def classes_(self):
        return self.clf.classes_

    def fit(self, texts: list[str], labels: list[str]) -> "IntentClassifier":
        self.clf.fit(self.vec.fit(texts).transform(texts), labels)
        return self

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        return self.clf.predict_proba(self.vec.transform(texts))

    def predict(self, texts: list[str]) -> list[str]:
        return [str(self.classes_[i]) for i in self.predict_proba(texts).argmax(axis=1)]


def stratified_split(texts: list[str], labels: list[str], test_size: float = 0.25, seed: int = 42):
    rng = np.random.default_rng(seed)
    by_class: dict[str, list[int]] = {}
    for i, y in enumerate(labels):
        by_class.setdefault(y, []).append(i)
    test_idx: list[int] = []
    for y in sorted(by_class):
        ids = list(by_class[y])
        rng.shuffle(ids)
        test_idx += ids[:max(1, round(len(ids) * test_size))]
    test_set = set(test_idx)
    train_idx = [i for i in range(len(texts)) if i not in test_set]
    pick = lambda arr, ix: [arr[i] for i in ix]  # noqa: E731
    return pick(texts, train_idx), pick(texts, test_idx), pick(labels, train_idx), pick(labels, test_idx)


def classification_report(y_true: list[str], y_pred: list[str]) -> str:
    classes = sorted(set(y_true) | set(y_pred))
    lines = [f"{'intent':>15} {'precision':>9} {'recall':>7} {'f1':>6} {'support':>8}"]
    for c in classes:
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == c and p == c)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != c and p == c)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == c and p != c)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        lines.append(f"{c:>15} {prec:>9.2f} {rec:>7.2f} {f1:>6.2f} {tp + fn:>8}")
    return "\n".join(lines)
