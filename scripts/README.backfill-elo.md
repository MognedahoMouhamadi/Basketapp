# Backfill Elo (ranked matches)

This script replays ranked matches in chronological order and writes Elo deltas
into `matches/{matchId}/participants/{uid}.elo`, plus sets `eloCommitted` on the match.

## Prerequisites

- A Firebase service account or Application Default Credentials.

### Option A: Service account JSON

Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your JSON key.

### Option B: ADC

Use `gcloud auth application-default login` and ensure the project is set.

## Install deps

```
npm install
```

## Run

```
npm run backfill:elo
```

### Flags

- `--force` Recalculate even if `eloCommitted == true`.
- `--update-users` Update `users/{uid}.elo` with the final replayed Elo.
- `--limit=100` Process only the first N matches (chronological).
- `--k=24` Override K factor.

## Notes

- Only matches with `status == "finished"` and `endedAt != null` are processed.
- The script handles both `category == "ranked"` and `isRanked == true`.
- For ties, result is `draw` with score 0.5.
