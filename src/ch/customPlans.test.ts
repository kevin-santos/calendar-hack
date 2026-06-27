import {
  parsePlan,
  loadCustomPlans,
  saveCustomPlans,
  toSummary,
  CUSTOM_PLANS_KEY,
} from "./customPlans";
import { TrainingPlan } from "types/app";

// A minimal valid one-week plan in YAML.
const VALID_YAML = `
id: my_plan
name: My Plan
description: A test plan.
units: mi
type: 5K
source: https://example.com
schedule:
  - workouts:
      - title: Rest
      - title: Easy {3}
        distance: 3
      - title: Intervals {4}
        distance: 4
      - title: Rest
      - title: Easy {3}
        distance: 3
      - title: Easy {2}
        distance: 2
      - title: Long run {6}
        distance: 6
`;

// The same plan as JSON (yaml.load parses JSON too).
const VALID_JSON = JSON.stringify({
  id: "my_plan",
  name: "My Plan",
  description: "A test plan.",
  units: "mi",
  type: "5K",
  source: "https://example.com",
  schedule: [
    {
      workouts: [
        { title: "Rest" },
        { title: "Easy {3}", distance: 3 },
        { title: "Intervals {4}", distance: 4 },
        { title: "Rest" },
        { title: "Easy {3}", distance: 3 },
        { title: "Easy {2}", distance: 2 },
        { title: "Long run {6}", distance: [5, 6] },
      ],
    },
  ],
});

describe("parsePlan", () => {
  it("accepts a valid YAML plan", () => {
    const { plan, error } = parsePlan(VALID_YAML);
    expect(error).toBeUndefined();
    expect(plan?.id).toBe("my_plan");
    expect(plan?.schedule).toHaveLength(1);
    expect(plan?.schedule[0].workouts).toHaveLength(7);
  });

  it("accepts the same plan as JSON", () => {
    const { plan, error } = parsePlan(VALID_JSON);
    expect(error).toBeUndefined();
    expect(plan?.id).toBe("my_plan");
  });

  it("rejects malformed input without throwing", () => {
    const { plan, error } = parsePlan("this: : : not valid");
    expect(plan).toBeUndefined();
    expect(error).toBeTruthy();
  });

  it("requires a name", () => {
    const { error } = parsePlan(VALID_YAML.replace("name: My Plan\n", ""));
    expect(error).toMatch(/name/i);
  });

  it("rejects a bad id", () => {
    const { error } = parsePlan(VALID_YAML.replace("id: my_plan", "id: My Plan!"));
    expect(error).toMatch(/id/i);
  });

  it("rejects unknown units", () => {
    const { error } = parsePlan(VALID_YAML.replace("units: mi", "units: smoots"));
    expect(error).toMatch(/units/i);
  });

  it("rejects an unknown race type", () => {
    const { error } = parsePlan(VALID_YAML.replace("type: 5K", "type: Ultra"));
    expect(error).toMatch(/type/i);
  });

  it("rejects a week that does not have exactly 7 workouts", () => {
    const broken = VALID_YAML.replace("      - title: Long run {6}\n        distance: 6\n", "");
    const { error } = parsePlan(broken);
    expect(error).toMatch(/7 workouts/i);
  });

  it("requires every workout to have a title", () => {
    const broken = VALID_YAML.replace("      - title: Rest\n", "      - distance: 1\n");
    const { error } = parsePlan(broken);
    expect(error).toMatch(/title/i);
  });

  it("rejects a distance array with more than two values", () => {
    const broken = VALID_YAML.replace("        distance: 3\n", "        distance: [1, 2, 3]\n");
    const { error } = parsePlan(broken);
    expect(error).toMatch(/distance/i);
  });
});

describe("localStorage round-trip", () => {
  beforeEach(() => localStorage.clear());

  it("returns [] when nothing is stored", () => {
    expect(loadCustomPlans()).toEqual([]);
  });

  it("saves and loads custom plans", () => {
    const plan = parsePlan(VALID_YAML).plan as TrainingPlan;
    saveCustomPlans([plan]);
    const loaded = loadCustomPlans();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("my_plan");
  });

  it("returns [] for malformed storage instead of throwing", () => {
    localStorage.setItem(CUSTOM_PLANS_KEY, "{not json");
    expect(loadCustomPlans()).toEqual([]);
  });
});

describe("toSummary", () => {
  it("builds [id, name, type]", () => {
    const plan = parsePlan(VALID_YAML).plan as TrainingPlan;
    expect(toSummary(plan)).toEqual(["my_plan", "My Plan", "5K"]);
  });
});
