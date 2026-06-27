import { computeMetrics } from "./planMetrics";
import { build } from "./planbuilder";
import { WeekStartsOnValues } from "./datecalc";
import { parse } from "date-fns";
import { PlannedWorkout, Tags, TrainingPlan, Units } from "types/app";

const dparse = (s: string) => parse(s, "MM/dd/yyyy", new Date());

// Real plan JSON has no `tags` field, so detection is driven by the title.
// `tags` is included here only to confirm tag-based detection still works as a
// fallback when present.
function wk(
  title: string,
  distance: number | number[],
  tags?: Tags[],
): PlannedWorkout {
  const w: PlannedWorkout = {
    title,
    description: "",
    tags: tags as Tags[],
    distance: distance as number[],
    units: "mi",
  };
  if (tags === undefined) {
    // mimic JSON where the tags key is simply absent
    delete (w as Partial<PlannedWorkout>).tags;
  }
  return w;
}

const REST = wk("Rest", 0);

// Two-week fixture mirroring real data: titles carry the signal, and the final
// day (race day) is the goal race. Week 1 totals 36, week 2 totals 63.
function twoWeekPlan(units: Units): TrainingPlan {
  return {
    id: "fixture",
    name: "Fixture",
    description: "",
    units,
    type: "Marathon",
    source: "",
    schedule: [
      {
        description: undefined,
        workouts: [
          REST, // Mon
          wk("Easy run", 5), // Tue
          wk("Interval session", 6), // Wed  -> quality
          wk("Easy run", 5), // Thu
          REST, // Fri
          wk("Easy run", 8), // Sat
          wk("Long run", 12), // Sun
        ],
      },
      {
        description: undefined,
        workouts: [
          REST, // Mon
          wk("Easy run", 6), // Tue
          wk("Hill repeats", 7), // Wed  -> quality
          wk("Easy run", 6), // Thu
          REST, // Fri
          wk("Long run", 18), // Sat  -> longest training run
          wk("Marathon race", 26), // Sun -> race day (excluded from longest run)
        ],
      },
    ],
  };
}

const RACE_DATE = dparse("03/30/2025"); // a Sunday

describe("computeMetrics", () => {
  it("computes week count, total, average and peak in source (mi) units", () => {
    const racePlan = build(twoWeekPlan("mi"), RACE_DATE, WeekStartsOnValues.Monday);
    const m = computeMetrics(racePlan, "mi");

    expect(m.units).toBe("mi");
    expect(m.weekCount).toBe(2);
    expect(m.totalDistance).toBeCloseTo(99, 5); // 36 + 63
    expect(m.avgWeeklyDistance).toBeCloseTo(49.5, 5);
    expect(m.peakWeeklyDistance).toBeCloseTo(63, 5);
    expect(m.peakWeek).toBe(2);
  });

  it("reports the longest training run, excluding the race day", () => {
    const racePlan = build(twoWeekPlan("mi"), RACE_DATE, WeekStartsOnValues.Monday);
    const m = computeMetrics(racePlan, "mi");

    // 26 mi race day is excluded; the 18 mi long run is the peak training run
    expect(m.longestRun).toBeCloseTo(18, 5);
  });

  it("detects quality and rest days from titles", () => {
    const racePlan = build(twoWeekPlan("mi"), RACE_DATE, WeekStartsOnValues.Monday);
    const m = computeMetrics(racePlan, "mi");

    // one quality day per week (interval / hill repeats)
    expect(m.qualityDaysPerWeek).toBeCloseTo(1, 5);
    // two rest days per week
    expect(m.restDaysPerWeek).toBeCloseTo(2, 5);
  });

  it("converts mi-source distances to km when requested", () => {
    const racePlan = build(twoWeekPlan("mi"), RACE_DATE, WeekStartsOnValues.Monday);
    const m = computeMetrics(racePlan, "km");

    expect(m.units).toBe("km");
    expect(m.totalDistance).toBeCloseTo(99 / 0.62137, 1);
    expect(m.longestRun).toBeCloseTo(18 / 0.62137, 1);
  });

  it("tolerates workouts with no tags field (tags is optional in plan JSON)", () => {
    const racePlan = build(twoWeekPlan("mi"), RACE_DATE, WeekStartsOnValues.Monday);
    // the whole fixture already omits tags; just confirm it doesn't throw
    expect(() => computeMetrics(racePlan, "mi")).not.toThrow();
  });

  it("uses the upper bound of a range distance", () => {
    const plan = twoWeekPlan("mi");
    // Replace Saturday of week 1 (8) with a range [4,10] -> upper bound 10
    plan.schedule[0].workouts[5] = wk("Easy run", [4, 10]);
    const racePlan = build(plan, RACE_DATE, WeekStartsOnValues.Monday);
    const m = computeMetrics(racePlan, "mi");

    // week 1 total becomes 5+6+5+10+12 = 38
    expect(m.totalDistance).toBeCloseTo(38 + 63, 5);
  });

  it("falls back to tag-based detection when titles are uninformative", () => {
    const plan = twoWeekPlan("mi");
    // a generically-titled day that only a tag identifies as speedwork
    plan.schedule[0].workouts[3] = wk("Session", 5, ["Speedwork"]);
    const racePlan = build(plan, RACE_DATE, WeekStartsOnValues.Monday);
    const m = computeMetrics(racePlan, "mi");

    // week 1 now has 2 quality days (interval title + tagged session), week 2 has 1
    expect(m.qualityDaysPerWeek).toBeCloseTo(1.5, 5);
  });
});
