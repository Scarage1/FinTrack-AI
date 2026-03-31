from typing import List

from fastapi import FastAPI
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression, LogisticRegression
import numpy as np


app = FastAPI(title="Expense Tracker ML Service")
FEATURE_PIPELINE_VERSION = "v1.1"
CATEGORIZATION_MODEL_VERSION = "categorization-v1"
FORECAST_MODEL_VERSION = "monthly-forecast-v1"


class CategorizeRequest(BaseModel):
    description: str


class PredictRequest(BaseModel):
    monthly_totals: List[float]


train_text = [
    "swiggy order",
    "zomato dinner",
    "uber ride",
    "flight booking",
    "electricity bill",
    "internet recharge",
    "amazon order",
    "netflix subscription",
]
train_labels = [
    "Food",
    "Food",
    "Travel",
    "Travel",
    "Bills",
    "Bills",
    "Shopping",
    "Entertainment",
]

class CategorizationModel:
    def __init__(self) -> None:
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2))
        self.model = LogisticRegression(max_iter=300)
        x_train = self.vectorizer.fit_transform(train_text)
        self.model.fit(x_train, train_labels)

    def predict(self, description: str) -> dict:
        x = self.vectorizer.transform([description])
        pred = self.model.predict(x)[0]
        proba = self.model.predict_proba(x)[0]
        classes = list(self.model.classes_)
        pred_idx = classes.index(pred)
        confidence = float(proba[pred_idx])

        feature_names = np.array(self.vectorizer.get_feature_names_out())
        class_coef = self.model.coef_[pred_idx]
        active_idx = x.indices
        if len(active_idx) > 0:
            contributions = []
            for idx in active_idx:
                tfidf_value = float(x[0, idx])
                score = tfidf_value * float(class_coef[idx])
                contributions.append((score, feature_names[idx]))
            contributions.sort(reverse=True)
            top_features = [name for _score, name in contributions[:3]]
        else:
            top_features = []

        return {
            "category": pred,
            "confidence": round(confidence, 4),
            "top_features": top_features,
            "feature_pipeline_version": FEATURE_PIPELINE_VERSION,
            "model_version": CATEGORIZATION_MODEL_VERSION
        }


class MonthlyForecastModel:
    def predict(self, monthly_totals: List[float]) -> dict:
        if len(monthly_totals) == 0:
            return {
                "predicted_month_total": 0,
                "trend_slope": 0.0,
                "confidence": 0.0,
                "reason_code": "NO_HISTORY",
                "feature_pipeline_version": FEATURE_PIPELINE_VERSION,
                "model_version": FORECAST_MODEL_VERSION
            }

        if len(monthly_totals) == 1:
            return {
                "predicted_month_total": round(monthly_totals[0], 2),
                "trend_slope": 0.0,
                "confidence": 0.25,
                "reason_code": "INSUFFICIENT_HISTORY",
                "feature_pipeline_version": FEATURE_PIPELINE_VERSION,
                "model_version": FORECAST_MODEL_VERSION
            }

        y = np.array(monthly_totals, dtype=float)
        x = np.arange(1, len(y) + 1).reshape(-1, 1)
        model = LinearRegression()
        model.fit(x, y)

        next_x = np.array([[len(y) + 1]])
        pred = float(model.predict(next_x)[0])
        trend_slope = float(model.coef_[0])

        y_hat = model.predict(x)
        residual = float(np.mean(np.abs(y - y_hat))) if len(y) > 0 else 0.0
        baseline = float(np.mean(np.abs(y))) if len(y) > 0 else 1.0
        relative_error = residual / (baseline + 1e-6)
        confidence = max(0.1, min(0.95, 1.0 - relative_error))

        return {
            "predicted_month_total": round(max(0.0, pred), 2),
            "trend_slope": round(trend_slope, 4),
            "confidence": round(float(confidence), 4),
            "reason_code": "OK",
            "feature_pipeline_version": FEATURE_PIPELINE_VERSION,
            "model_version": FORECAST_MODEL_VERSION
        }


categorization_model = CategorizationModel()
forecast_model = MonthlyForecastModel()


@app.get("/health")
def health():
    return {
        "ok": True,
        "feature_pipeline_version": FEATURE_PIPELINE_VERSION,
        "models": {
            "categorization": CATEGORIZATION_MODEL_VERSION,
            "monthly_forecast": FORECAST_MODEL_VERSION
        }
    }


@app.post("/categorize")
def categorize(req: CategorizeRequest):
    return categorization_model.predict(req.description)


@app.post("/predict")
def predict(req: PredictRequest):
    return forecast_model.predict(req.monthly_totals)
