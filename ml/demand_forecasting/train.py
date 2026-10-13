"""Train the 7-day demand (intake) forecast and write ml/models/demand.json.

Run from the repo root:   python ml/demand_forecasting/train.py
It reads the `intakehistories` collection from the MongoDB named in backend/.env (MONGODB_URI).

What it learns: for a centre and crop, how many kg arrive per day over the next 7 days, from the
last 28 days. Every series is turned into ratios (kg divided by its own 28-day mean) so one small
Ridge regression serves all centres and crops. The result is exported as plain numbers, so the Node
server needs no Python at run time.

It is judged honestly: on the last 28 forecast origins, held out from training, it is compared with
two simple baselines. If it does not beat the better baseline, the server uses the baseline.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from pymongo import MongoClient
from sklearn.linear_model import Ridge

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ml" / "models" / "demand.json"
HIST = 28          # days of history used at forecast time
HORIZON = 7        # days ahead
TEST_ORIGINS = 28  # most recent origins, held out
MIN_DAYS = 60      # a series needs this many days to be used
FEATURES = [f"dow_{i}" for i in range(7)] + ["horizon", "mean7_ratio", "same_dow_last_week_ratio"]


def mongo_uri():
    env = (ROOT / "backend" / ".env").read_text(encoding="utf-8")
    m = re.search(r"^MONGODB_URI=(.+)$", env, re.M)
    if not m:
        sys.exit("MONGODB_URI not found in backend/.env")
    return m.group(1).strip()


def dow(d):
    """Sunday = 0, the same as JavaScript's getUTCDay, so the Node server matches."""
    return (pd.Timestamp(d).weekday() + 1) % 7


def features(hist, origin, h):
    """hist: last HIST daily kg ending on `origin`. Returns (feature row, scale)."""
    scale = max(float(np.mean(hist)), 1.0)
    target = pd.Timestamp(origin) + pd.Timedelta(days=h)
    row = [0.0] * 7
    row[dow(target)] = 1.0
    mean7 = float(np.mean(hist[-7:])) / scale
    same_dow = float(hist[h - 8]) / scale  # value on target - 7 days
    return row + [h / HORIZON, mean7, same_dow], scale


def load_series():
    db = MongoClient(mongo_uri(), serverSelectionTimeoutMS=5000).get_default_database()
    rows = pd.DataFrame(list(db.intakehistories.find({}, {"_id": 0, "center": 1, "crop": 1, "date": 1, "kg": 1, "simulated": 1})))
    if rows.empty:
        sys.exit("No rows in intakehistories. Run `npm run seed` in backend/ first.")
    rows["key"] = rows["center"].astype(str) + ":" + rows["crop"].astype(str)
    out = {}
    for key, g in rows.groupby("key"):
        s = g.set_index(pd.to_datetime(g["date"]))["kg"].sort_index()
        s = s.reindex(pd.date_range(s.index.min(), s.index.max(), freq="D"), fill_value=0.0)
        if len(s) >= MIN_DAYS:
            out[key] = s
    return rows, out


def build_examples(series):
    """One example per (series, origin, horizon). Also keeps the origin index for time splitting."""
    ex = []
    for key, s in series.items():
        vals = s.values
        for i in range(HIST - 1, len(s) - HORIZON):
            hist = vals[i - HIST + 1 : i + 1]
            origin = s.index[i]
            for h in range(1, HORIZON + 1):
                x, scale = features(hist, origin, h)
                y = vals[i + h]
                ex.append({"key": key, "origin": origin, "h": h, "x": x, "scale": scale, "y": y, "naive": hist[h - 8], "flat": float(np.mean(hist))})
    return pd.DataFrame(ex)


def wape(actual, pred):
    return float(np.abs(actual - pred).sum() / max(np.abs(actual).sum(), 1.0))


def main():
    rows, series = load_series()
    ex = build_examples(series)
    origins = sorted(ex["origin"].unique())
    cut = origins[-TEST_ORIGINS]
    train, test = ex[ex["origin"] < cut], ex[ex["origin"] >= cut]
    if train.empty or test.empty:
        sys.exit("Not enough history to hold out a test period.")

    X = lambda d: np.array(d["x"].tolist())
    ratio = lambda d: (d["y"] / d["scale"]).values
    model = Ridge(alpha=1.0).fit(X(train), ratio(train))
    pred = np.maximum(model.predict(X(test)) * test["scale"].values, 0)
    actual = test["y"].values

    m = {
        "model": {"mae_kg": float(np.mean(np.abs(actual - pred))), "wape": wape(actual, pred)},
        "seasonal_naive": {"mae_kg": float(np.mean(np.abs(actual - test["naive"].values))), "wape": wape(actual, test["naive"].values)},
        "flat_28_day_mean": {"mae_kg": float(np.mean(np.abs(actual - test["flat"].values))), "wape": wape(actual, test["flat"].values)},
    }
    best_baseline = min(("seasonal_naive", "flat_28_day_mean"), key=lambda k: m[k]["mae_kg"])
    beats = m["model"]["mae_kg"] < m[best_baseline]["mae_kg"]

    # Prediction interval: 10th and 90th percentile of held-out errors, as a ratio of the forecast
    err = (actual - pred) / np.maximum(pred, 1.0)
    q10, q90 = float(np.percentile(err, 10)), float(np.percentile(err, 90))

    # Refit on everything for the exported model
    final = Ridge(alpha=1.0).fit(X(ex), ratio(ex))

    sim = rows["simulated"].fillna(False)
    fixtures = []
    for key in list(series)[:3]:
        s = series[key]
        hist = s.values[-HIST:]
        origin = s.index[-1]
        for h in (1, 4, 7):
            x, scale = features(hist, origin, h)
            fixtures.append({"hist": [float(v) for v in hist], "origin": origin.strftime("%Y-%m-%d"), "h": h,
                             "expected_kg": float(max(final.predict(np.array([x]))[0] * scale, 0))})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "version": 1,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "history": HIST,
        "horizon": HORIZON,
        "features": FEATURES,
        "coef": [float(c) for c in final.coef_],
        "intercept": float(final.intercept_),
        "interval": {"low": q10, "high": q90},
        "metrics": {**m, "bestBaseline": best_baseline, "modelBeatsBaseline": bool(beats), "testOrigins": TEST_ORIGINS, "testRows": int(len(test))},
        "data": {
            "series": len(series),
            "rows": int(len(rows)),
            "simulatedRows": int(sim.sum()),
            "realRows": int((~sim).sum()),
            "note": "Rows marked simulated are placeholder history made by the seed. Accuracy figures on simulated data show that the pipeline works, not how well it will forecast real demand."
        },
        "fixtures": fixtures,
    }, indent=2), encoding="utf-8")

    print(f"series={len(series)} rows={len(rows)} simulated={int(sim.sum())} real={int((~sim).sum())}")
    for k, v in m.items():
        print(f"  {k:18s} MAE {v['mae_kg']:8.1f} kg   WAPE {v['wape']*100:5.1f}%")
    print(f"  best baseline: {best_baseline}; model beats it: {beats}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
