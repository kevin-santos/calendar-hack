import { format } from "date-fns";
import { RacePlan } from "../ch/dategrid";
import { computeMetrics } from "../ch/planMetrics";
import { PlanWeekRow } from "./PlanWeekRow";
import { getDaysHeader, WeekStartsOn } from "../ch/datecalc";
import { DayDetails, PlanMetrics, Units, Week } from "types/app";

interface Props {
  planA: RacePlan;
  planB: RacePlan;
  nameA: string;
  nameB: string;
  units: Units;
  weekStartsOn: WeekStartsOn;
}

function round1(n: number): string {
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1);
}

// A single metrics row. `emphasize` decides whether the larger value is
// visually highlighted (true for "more is notable" stats, false for neutral).
interface RowSpec {
  label: string;
  a: string;
  b: string;
  rawA?: number;
  rawB?: number;
  emphasize?: boolean;
}

function buildRows(
  units: Units,
  raceTypeA: string,
  raceTypeB: string,
  ma: PlanMetrics,
  mb: PlanMetrics,
): RowSpec[] {
  const d = (n: number) => `${round1(n)} ${units}`;
  return [
    { label: "Race type", a: raceTypeA, b: raceTypeB },
    { label: "Weeks", a: `${ma.weekCount}`, b: `${mb.weekCount}` },
    {
      label: "Total distance",
      a: d(ma.totalDistance),
      b: d(mb.totalDistance),
      rawA: ma.totalDistance,
      rawB: mb.totalDistance,
      emphasize: true,
    },
    {
      label: "Avg weekly",
      a: d(ma.avgWeeklyDistance),
      b: d(mb.avgWeeklyDistance),
      rawA: ma.avgWeeklyDistance,
      rawB: mb.avgWeeklyDistance,
      emphasize: true,
    },
    {
      label: "Peak weekly",
      a: `${d(ma.peakWeeklyDistance)} (wk ${ma.peakWeek})`,
      b: `${d(mb.peakWeeklyDistance)} (wk ${mb.peakWeek})`,
      rawA: ma.peakWeeklyDistance,
      rawB: mb.peakWeeklyDistance,
      emphasize: true,
    },
    {
      label: "Longest run",
      a: d(ma.longestRun),
      b: d(mb.longestRun),
      rawA: ma.longestRun,
      rawB: mb.longestRun,
      emphasize: true,
    },
    {
      label: "Quality days / wk",
      a: round1(ma.qualityDaysPerWeek),
      b: round1(mb.qualityDaysPerWeek),
    },
    {
      label: "Rest days / wk",
      a: round1(ma.restDaysPerWeek),
      b: round1(mb.restDaysPerWeek),
    },
  ];
}

function weekDateRange(week: Week<DayDetails>): string {
  const start = week.days[0]?.date;
  const end = week.days[week.days.length - 1]?.date;
  if (!start || !end) return "";
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

export const PlanComparison = ({
  planA,
  planB,
  nameA,
  nameB,
  units,
  weekStartsOn,
}: Props) => {
  const ma = computeMetrics(planA, units);
  const mb = computeMetrics(planB, units);

  const weeksA = planA.dateGrid.weeks;
  const weeksB = planB.dateGrid.weeks;
  const maxWeeks = Math.max(ma.weekCount, mb.weekCount);
  // Offsets so both plans line up at race week (the bottom block). The shorter
  // plan simply starts later, i.e. its first `pad` blocks are "not started".
  const padA = maxWeeks - ma.weekCount;
  const padB = maxWeeks - mb.weekCount;

  const rows = buildRows(units, planA.raceType, planB.raceType, ma, mb);

  const blocks = Array.from({ length: maxWeeks }, (_, j) => {
    const aIdx = j - padA;
    const bIdx = j - padB;
    const aWeek = aIdx >= 0 ? weeksA[aIdx] : undefined;
    const bWeek = bIdx >= 0 ? weeksB[bIdx] : undefined;
    const weeksToGo = maxWeeks - 1 - j;
    // The longer plan is present in every block, so one of these always exists.
    const dateRange = weekDateRange((aWeek ?? bWeek)!);
    return { j, aIdx, bIdx, aWeek, bWeek, weeksToGo, dateRange };
  });

  const cellClass = (row: RowSpec, side: "a" | "b") => {
    if (!row.emphasize || row.rawA === undefined || row.rawB === undefined) {
      return "cmp-metric-value";
    }
    const isHigher =
      side === "a" ? row.rawA > row.rawB : row.rawB > row.rawA;
    return isHigher ? "cmp-metric-value cmp-higher" : "cmp-metric-value";
  };

  return (
    <div className="plan-comparison">
      <table className="cmp-metrics">
        <thead>
          <tr>
            <th className="cmp-metric-label" />
            <th>{nameA}</th>
            <th>{nameB}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="cmp-metric-label">{row.label}</td>
              <td className={cellClass(row, "a")}>{row.a}</td>
              <td className={cellClass(row, "b")}>{row.b}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="cmp-align-note">
        Each week shows both plans stacked — aligned by race day, ending at race
        week.
      </p>

      <div className="cmp-blocks">
        <div className="week-grid cmp-week cmp-header">
          <div key="blank-left" />
          {getDaysHeader(weekStartsOn).map((dow) => (
            <div className="cmp-dow" key={dow}>
              {dow.slice(0, 3)}
            </div>
          ))}
        </div>

        {blocks.map((b) => (
          <div className="cmp-wk-block" key={`block-${b.j}`}>
            <div className="cmp-wk-block-header">
              <span className="cmp-wk-togo">
                {b.weeksToGo === 0 ? "Race week" : `${b.weeksToGo} weeks to go`}
              </span>
              <span className="cmp-wk-dates">{b.dateRange}</span>
            </div>
            <PlanWeekRow
              week={b.aWeek}
              racePlan={planA}
              planName={nameA}
              units={units}
              isPeakWeek={b.aIdx + 1 === ma.peakWeek}
              isFirstWeek={b.aIdx === 0}
              isLastWeek={b.aIdx === ma.weekCount - 1}
              accent="a"
            />
            <PlanWeekRow
              week={b.bWeek}
              racePlan={planB}
              planName={nameB}
              units={units}
              isPeakWeek={b.bIdx + 1 === mb.peakWeek}
              isFirstWeek={b.bIdx === 0}
              isLastWeek={b.bIdx === mb.weekCount - 1}
              accent="b"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
