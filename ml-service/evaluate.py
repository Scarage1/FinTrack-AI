from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_absolute_percentage_error,
    root_mean_squared_error,
)
from sklearn.model_selection import train_test_split


def classification_dataset() -> tuple[list[str], list[str]]:
    texts = [
        "swiggy lunch order",
        "zomato dinner order",
        "restaurant food bill",
        "cafe breakfast",
        "pizza food delivery",
        "uber airport ride",
        "ola office commute",
        "metro travel recharge",
        "bus travel ticket",
        "taxi trip fare",
        "electricity monthly bill",
        "internet broadband bill",
        "gas utility payment",
        "water utility bill",
        "mobile recharge bill",
        "amazon shopping order",
        "flipkart online purchase",
        "shopping mall clothes",
        "grocery shopping store",
        "household items shopping",
        "netflix subscription entertainment",
        "movie cinema ticket",
        "spotify premium music",
        "gaming entertainment pass",
        "concert show entertainment",
        "pharmacy medicine purchase",
        "school books stationery",
        "doctor clinic payment",
        "insurance premium payment",
        "gift donation payment"
    ]
    labels = [
        "Food",
        "Food",
        "Food",
        "Food",
        "Food",
        "Travel",
        "Travel",
        "Travel",
        "Travel",
        "Travel",
        "Bills",
        "Bills",
        "Bills",
        "Bills",
        "Bills",
        "Shopping",
        "Shopping",
        "Shopping",
        "Shopping",
        "Shopping",
        "Entertainment",
        "Entertainment",
        "Entertainment",
        "Entertainment",
        "Entertainment",
        "Others",
        "Others",
        "Others",
        "Others",
        "Others"
    ]
    return texts, labels


def evaluate_classification() -> dict:
    texts, labels = classification_dataset()

    X_train, X_test, y_train, y_test = train_test_split(
        texts,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels
    )

    vectorizer = TfidfVectorizer(ngram_range=(1, 2))
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    clf = LogisticRegression(max_iter=500)
    clf.fit(X_train_vec, y_train)
    pred = clf.predict(X_test_vec)
    classes = sorted(set(labels))
    cm = confusion_matrix(y_test, pred, labels=classes)

    per_class_f1 = {}
    for label in classes:
        per_class_f1[label] = float(f1_score(y_test, pred, labels=[label], average="macro", zero_division=0))

    vocab = set(vectorizer.get_feature_names_out())
    shift_texts = [
        "airbnb stay booking",
        "crypto exchange transfer",
        "coworking office membership",
        "food delivery snacks",
        "movie streaming pass"
    ]
    drift_unknown_ratio = []
    for text in shift_texts:
        tokens = [t.strip().lower() for t in text.split() if t.strip()]
        unknown = [t for t in tokens if t not in vocab]
        drift_unknown_ratio.append((len(unknown) / len(tokens)) if tokens else 0.0)

    return {
      "accuracy": float(accuracy_score(y_test, pred)),
      "f1_macro": float(f1_score(y_test, pred, average="macro")),
      "per_class_f1": per_class_f1,
      "confusion_matrix": {
          "labels": classes,
          "values": cm.tolist()
      },
      "drift": {
          "unknown_token_ratio_avg": float(np.mean(drift_unknown_ratio)),
          "status": "warn" if float(np.mean(drift_unknown_ratio)) > 0.45 else "ok"
      }
    }


def regression_series() -> np.ndarray:
    rng = np.random.default_rng(42)

    monthly_totals = np.array([12000, 12600, 13100, 13800, 14500, 14950, 15300, 16050, 16600, 17100, 17900, 18500], dtype=float)
    noise = rng.normal(0, 250, size=monthly_totals.shape)
    return monthly_totals + noise


def rolling_backtest(y: np.ndarray, min_train: int = 6) -> dict:
    errors_abs = []
    errors_pct = []
    squared = []

    for idx in range(min_train, len(y)):
        train_y = y[:idx]
        actual = float(y[idx])

        x_train = np.arange(1, len(train_y) + 1).reshape(-1, 1)
        model = LinearRegression()
        model.fit(x_train, train_y)

        pred = float(model.predict(np.array([[len(train_y) + 1]]))[0])
        abs_err = abs(actual - pred)
        pct_err = abs_err / (abs(actual) + 1e-6)

        errors_abs.append(abs_err)
        errors_pct.append(pct_err)
        squared.append((actual - pred) ** 2)

    return {
        "steps": len(errors_abs),
        "mae": float(np.mean(errors_abs)) if errors_abs else 0.0,
        "rmse": float(np.sqrt(np.mean(squared))) if squared else 0.0,
        "mape": float(np.mean(errors_pct)) if errors_pct else 0.0,
    }


def evaluate_regression() -> dict:
    y = regression_series()

    x = np.arange(1, len(y) + 1).reshape(-1, 1)
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.25, random_state=42)

    model = LinearRegression()
    model.fit(x_train, y_train)
    pred = model.predict(x_test)

    backtest = rolling_backtest(y)

    shifted_series = y * 1.25
    drift_ratio = float(abs(np.mean(shifted_series) - np.mean(y)) / (np.mean(y) + 1e-6))

    return {
        "mae": float(mean_absolute_error(y_test, pred)),
        "rmse": float(root_mean_squared_error(y_test, pred)),
        "mape": float(mean_absolute_percentage_error(y_test, pred)),
        "backtest": backtest,
        "drift": {
            "mean_shift_ratio": drift_ratio,
            "status": "warn" if drift_ratio > 0.2 else "ok"
        }
    }


def main() -> int:
    cls = evaluate_classification()
    reg = evaluate_regression()

    thresholds = {
        "accuracy_min": 0.55,
        "f1_macro_min": 0.50,
        "mape_max": 0.20,
        "backtest_mape_max": 0.20
    }

    passed = (
        cls["accuracy"] >= thresholds["accuracy_min"]
        and cls["f1_macro"] >= thresholds["f1_macro_min"]
        and reg["mape"] <= thresholds["mape_max"]
        and reg["backtest"]["mape"] <= thresholds["backtest_mape_max"]
    )

    report = {
        "classification": cls,
        "regression": reg,
        "thresholds": thresholds,
        "status": "pass" if passed else "fail"
    }

    report_path = Path(__file__).parent / "evaluation_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
