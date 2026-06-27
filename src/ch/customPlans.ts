import { load as yamlLoad } from "js-yaml";
import { PlanSummary, RaceType, TrainingPlan } from "types/app";

export const CUSTOM_PLANS_KEY = "ch_custom_plans";

const ID_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const UNITS = ["mi", "km"];
// Canonical race types from public/schema/plan-schema.json.
const RACE_TYPES = [
  "Base",
  "Multiple Distances",
  "Marathon",
  "Half Marathon",
  "5K",
  "10K",
  "15k/10m",
  "50K",
  "100K",
  "100M",
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateDistance(d: unknown, where: string): string | undefined {
  if (d === undefined) return undefined;
  if (typeof d === "number") return undefined;
  if (Array.isArray(d) && d.length >= 1 && d.length <= 2 && d.every((n) => typeof n === "number")) {
    return undefined;
  }
  return `${where}: distance must be a number or an array of one or two numbers`;
}

// Parse pasted text (YAML or JSON — YAML is a JSON superset) and validate it
// against the same rules as public/schema/plan-schema.json. Returns the plan or
// a human-readable error.
export function parsePlan(text: string): { plan?: TrainingPlan; error?: string } {
  let doc: unknown;
  try {
    // js-yaml v4+ `load` uses the safe default schema (no code-executing tags
    // like !!js/function); `safeLoad` was removed. Safe for untrusted input.
    doc = yamlLoad(text);
  } catch (e) {
    return { error: `Could not parse: ${(e as Error).message}` };
  }

  if (!isObject(doc)) return { error: "Plan must be a YAML/JSON object." };

  const { id, name, description, units, type, source, schedule } = doc;

  if (typeof id !== "string" || !ID_RE.test(id)) {
    return { error: "id must be lowercase snake_case (e.g. my_marathon_plan)." };
  }
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "name is required." };
  }
  if (typeof description !== "string") {
    return { error: "description is required (can be a short sentence)." };
  }
  if (typeof units !== "string" || !UNITS.includes(units)) {
    return { error: 'units must be "mi" or "km".' };
  }
  if (typeof type !== "string" || !RACE_TYPES.includes(type)) {
    return { error: `type must be one of: ${RACE_TYPES.join(", ")}.` };
  }
  if (typeof source !== "string") {
    return { error: "source is required (a URL or note about where the plan came from)." };
  }
  if (!Array.isArray(schedule) || schedule.length < 1) {
    return { error: "schedule must be a non-empty list of weeks." };
  }

  for (let w = 0; w < schedule.length; w++) {
    const week = schedule[w];
    if (!isObject(week) || !Array.isArray(week.workouts)) {
      return { error: `Week ${w + 1}: missing a workouts list.` };
    }
    if (week.workouts.length !== 7) {
      return {
        error: `Week ${w + 1} must have exactly 7 workouts (found ${week.workouts.length}). Use "title: Rest" for off days.`,
      };
    }
    for (let i = 0; i < week.workouts.length; i++) {
      const out = week.workouts[i];
      const where = `Week ${w + 1}, day ${i + 1}`;
      if (!isObject(out) || typeof out.title !== "string" || out.title.trim() === "") {
        return { error: `${where}: every workout needs a title.` };
      }
      const distErr = validateDistance(out.distance, where);
      if (distErr) return { error: distErr };
    }
  }

  return { plan: doc as unknown as TrainingPlan };
}

export function toSummary(plan: TrainingPlan): PlanSummary {
  return [plan.id, plan.name, plan.type as RaceType];
}

export function loadCustomPlans(): TrainingPlan[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PLANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrainingPlan[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomPlans(plans: TrainingPlan[]): void {
  try {
    localStorage.setItem(CUSTOM_PLANS_KEY, JSON.stringify(plans));
  } catch {
    // ignore quota / unavailable storage
  }
}
