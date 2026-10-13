# Intelligence (ML) in AgriLoop

Runs offline; the Node server only reads the exported numbers, so no Python is needed in production.

## Demand forecast (machine learning)
`python ml/demand_forecasting/train.py` (from the repo root; `pip install -r ml/requirements.txt`; seed the database first).

- Reads `intakehistories` (kg taken in per centre, crop and day) from the MongoDB in `backend/.env`.
- Learns one small Ridge regression on ratios to each series' own 28-day mean, using the weekday, how far ahead, the last 7 days and the same weekday last week.
- Holds back the last 28 forecast dates and compares against two simple rules (same weekday last week, 28-day mean). The report is printed and saved in `ml/models/demand.json`. If the model does not beat the better rule, the server uses that rule and says so.
- `demand.json` also stores a few fixed examples; `backend/tests/suite/intelligence.test.js` checks the Node code gives the same answers as Python, so the two cannot drift apart.

**Data caveat.** On a fresh install the history is simulated by `npm run seed` (rows marked `simulated`). Real days replace them as managers complete lots. Accuracy on simulated data only proves the pipeline works. Retrain (`python ml/demand_forecasting/train.py`) as real history grows, and judge the model by the printed comparison, not by this README.

## Price guidance (not machine learning)
`GET /api/intelligence/price-guidance`: market price (AGMARKNET) x a grade factor, shown with its inputs, MSP and recent AgriLoop order prices. A real price model needs months of daily prices; the repository holds only three days (`backend/data`). With a `DATA_GOV_API_KEY` the live feed could supply history; a trainer for that is not written because it could not be tested here.
