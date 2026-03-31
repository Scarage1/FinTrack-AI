async function postJson(path, body) {
  const configuredBaseUrl = process.env.ML_BASE_URL || "http://localhost:8000";
  const baseUrl = configuredBaseUrl.replace(/\/+$/, "");
  const timeoutMs = Number(process.env.ML_TIMEOUT_MS || 3000);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) return null;
      return {
        data: await res.json(),
        latencyMs: Date.now() - start
      };
    } catch {
      if (attempt === 1) return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

export async function mlCategorize(description) {
  const result = await postJson("/categorize", { description });
  return result?.data?.category || null;
}

export async function mlPredict(monthlyTotals) {
  const result = await postJson("/predict", { monthly_totals: monthlyTotals });
  const data = result?.data;
  const value = data?.predicted_month_total;
  if (!Number.isFinite(value)) return null;

  return {
    predictedMonthTotal: Math.round(value),
    confidence: Number.isFinite(data?.confidence) ? Number(data.confidence) : null,
    trendSlope: Number.isFinite(data?.trend_slope) ? Number(data.trend_slope) : null,
    reasonCode: data?.reason_code || null,
    modelVersion: data?.model_version || null,
    featurePipelineVersion: data?.feature_pipeline_version || null,
    modelLatencyMs: Number.isFinite(result?.latencyMs) ? Number(result.latencyMs) : null
  };
}
