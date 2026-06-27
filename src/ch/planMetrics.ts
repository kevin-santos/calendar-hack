import { RacePlan, key } from "./dategrid";
import { kmToMiles, miToKm } from "./rendering";
import { DayDetails, PlanMetrics, Tags, Units, Week } from "types/app";

const QUALITY_TAGS: Tags[] = ["Speedwork", "Hills"];

// Plan JSON carries no tags today, so day classification is driven by the
// workout title; tags (when present) are honored as a fallback signal.
const QUALITY_TITLE = /pace|tempo|interval|speed|fartlek|repeat|hill|stride|track/i;
const REST_TITLE = /\brest\b|off day/i;

// Convert a distance value between units. The stored `from` unit comes from the
// plan's sourceUnits, which is why this is more correct than getWeekDistance
// (which assumes miles) when comparing plans with different source units.
function convert(value: number, from: Units, to: Units): number {
  if (from === to) return value;
  return from === "mi" ? miToKm(value) : kmToMiles(value);
}

// The upper bound of a day's distance, in source units. `dist` is either a
// single number or a [min, max] range at runtime.
function dayUpperDistance(dist: DayDetails["dist"] | undefined): number {
  if (dist === undefined || dist === null) return 0;
  if (typeof dist === "number") return dist;
  if (Array.isArray(dist) && dist.length > 0) return dist[dist.length - 1];
  return 0;
}

// tags is optional in plan JSON, so it can be undefined at runtime.
function dayTags(day: DayDetails): Tags[] {
  return day.tags ?? [];
}

function isQualityDay(day: DayDetails): boolean {
  if (dayTags(day).some((t) => QUALITY_TAGS.includes(t))) return true;
  return QUALITY_TITLE.test(day.title ?? "");
}

function isRestDay(day: DayDetails): boolean {
  if (dayTags(day).includes("Rest")) return true;
  return REST_TITLE.test(day.title ?? "");
}

function weekDistance(week: Week<DayDetails>, from: Units, to: Units): number {
  let total = 0;
  for (const day of week.days) {
    if (day.event) total += convert(dayUpperDistance(day.event.dist), from, to);
  }
  return total;
}

export function computeMetrics(racePlan: RacePlan, units: Units): PlanMetrics {
  const from = racePlan.sourceUnits;
  const weeks = racePlan.dateGrid.weeks;
  const weekCount = racePlan.dateGrid.weekCount;
  // The race day is the last day of the plan; exclude it from "longest run" so
  // the metric reflects the peak training run rather than the goal race (which
  // would otherwise tie every plan at the race distance).
  const raceDayKey = key(racePlan.planDates.planEndDate);

  const weeklyDistances = weeks.map((w) => weekDistance(w, from, units));
  const totalDistance = weeklyDistances.reduce((a, b) => a + b, 0);

  let peakWeeklyDistance = 0;
  let peakWeek = 0;
  weeklyDistances.forEach((dist, i) => {
    if (dist > peakWeeklyDistance) {
      peakWeeklyDistance = dist;
      peakWeek = i + 1; // 1-based
    }
  });

  let longestRun = 0;
  let qualityDays = 0;
  let restDays = 0;
  for (const week of weeks) {
    for (const day of week.days) {
      const e = day.event;
      if (!e) continue;
      const dist = convert(dayUpperDistance(e.dist), from, units);
      if (key(day.date) !== raceDayKey && dist > longestRun) longestRun = dist;
      if (isQualityDay(e)) qualityDays += 1;
      if (isRestDay(e)) restDays += 1;
    }
  }

  return {
    units,
    weekCount,
    totalDistance,
    avgWeeklyDistance: weekCount > 0 ? totalDistance / weekCount : 0,
    peakWeeklyDistance,
    peakWeek,
    longestRun,
    qualityDaysPerWeek: weekCount > 0 ? qualityDays / weekCount : 0,
    restDaysPerWeek: weekCount > 0 ? restDays / weekCount : 0,
  };
}
