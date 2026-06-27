# Adding a training plan

There are two ways to add a plan:

- **In the app (easiest, no code):** click **Add custom plan**, paste a plan in
  YAML or JSON, and Import. It's saved in your browser and shows up in the picker
  (marked with ★). Good for personal/local plans. See [the format](#the-format).
- **In the repo (for plans you want to ship):** author a YAML file, convert it to
  JSON, and register it. See [repo workflow](#repo-workflow).

Either way the plan uses the same shape, validated against
[`public/schema/plan-schema.json`](../public/schema/plan-schema.json).

## The format

```yaml
id: my_custom_mara          # lowercase, snake_case: ^[a-z0-9]+(?:_[a-z0-9]+)*$  (matches the filename for repo plans)
name: My Custom Marathon    # shown in the picker
description: One or two sentences about the plan.
units: mi                   # "mi" or "km" — the plan's source units
type: Marathon              # Base | Multiple Distances | Marathon | Half Marathon | 5K | 10K | 15k/10m | 50K | 100K | 100M
source: https://...         # where the plan came from
schedule:                   # one entry per week
  - workouts:               # EXACTLY 7 per week, in day order (Mon→Sun for a Monday week start)
      - title: Rest                         # rest day = title only, no distance
      - title: Easy {5}                      # see "Two distance concepts" below
        distance: 5
      - title: Intervals 6 x 800m {6}        # descriptive titles matter (metrics infer quality/rest from them)
        distance: 6
      - title: Easy {5}
        distance: 5
      - title: Rest
      - title: Easy {8}
        distance: 8
      - title: Long run {16}
        distance: 16
  - workouts:
      # ...next week's 7 workouts...
```

### Two distance concepts (the important part)

- **`distance:` field** — a number (`8`) or a range (`[8, 10]`). This is the
  *data* that drives weekly mileage totals and the plan-comparison metrics (peak
  weekly, longest run, etc.). **If you omit it on a running day, that mileage
  won't count.**
- **`{…}` tokens in `title`** — *display only*, for unit-aware rendering:
  - `{8}` → shows "8 mi"; auto-converts when the user toggles to km
  - `{8:13}` → you supply both: shows `8` in mi mode, `13` in km mode
  - `{8-9:13-14}` → a range with both unit variants

**Best practice:** put `distance:` on every running day *and* a `{…}` token in
the title. For a mi-sourced plan, `{8}` alone is enough (it auto-converts).

### Other rules

- Each week needs **exactly 7** workouts (use `- title: Rest` for off days).
- Only `title` is required per workout. `description` is optional.
- `tags` are optional and currently unused by any plan; the app infers
  "quality"/"rest" days from the title text, so keep titles descriptive
  (e.g. "Tempo", "Intervals", "Hills", "Rest").
- Optional per-week `description` and `distance` fields exist but aren't required.

## Repo workflow

For plans you want to commit to the repo (not just your browser):

1. Create `public/plans/yaml/<id>.yaml`.
2. Validate against the schema (needs `npm i -g ajv-cli`):
   ```
   yarn run validatePlans
   ```
3. Convert YAML → JSON (the app loads the JSON):
   ```
   python3 -m venv venv
   source ./venv/bin/activate
   pip install pyyaml
   python3 ./bin/convertPlans
   ```
   `convertPlans` resolves paths from its own location, so it works from any
   directory and writes to `public/plans/json/<id>.json`.
4. Register the plan in [`src/ch/planList.ts`](../src/ch/planList.ts) by adding a
   row to the `plans` array:
   ```ts
   ["<id>", "<Display Name>", "<Type>"],
   ```

> Copyright note: many published plans (e.g. from training books) are
> copyrighted. Adding one to your browser for personal use is fine; don't commit
> or distribute copyrighted plans in the repo.
