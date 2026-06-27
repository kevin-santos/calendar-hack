import { RacePlan, key } from "../ch/dategrid";
import { WeekSummary } from "./WeekSummary";
import { Dateline } from "./Dateline";
import { render } from "../ch/rendering";
import { DayDetails, Units, Week } from "types/app";

interface Props {
  // The plan's week at this block, or undefined if the plan hasn't started yet.
  week: Week<DayDetails> | undefined;
  racePlan: RacePlan;
  planName: string;
  units: Units;
  isPeakWeek: boolean;
  isFirstWeek: boolean;
  isLastWeek: boolean;
  // Which plan this row belongs to — drives the accent colour.
  accent: "a" | "b";
}

// A read-only day cell. Intentionally has no react-dnd wiring (unlike DayCell)
// so comparison plans cannot be dragged into the editable main grid.
function ReadOnlyDay({
  date,
  dayDetails,
  units,
}: {
  date: Date;
  dayDetails: DayDetails | undefined;
  units: Units;
}) {
  if (!dayDetails) {
    return (
      <div className="day-cell cmp-day">
        <div className="blank-card">
          <Dateline $date={date} />
          <div className="blank-content" />
        </div>
      </div>
    );
  }
  // Comparison cells show the title only (it already carries workout type and
  // distance). Full descriptions live in the single-plan view; here they would
  // bloat row heights.
  const [title] = render(dayDetails, dayDetails.sourceUnits, units);
  return (
    <div className="day-cell cmp-day" title={title}>
      <div className="workout-card">
        <Dateline $date={date} />
        <div className="workout-content">
          <p>
            <span className="workout-title">{title}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// One plan's single week, as a 7-day grid row with a left gutter summary.
export const PlanWeekRow = ({
  week,
  racePlan,
  planName,
  units,
  isPeakWeek,
  isFirstWeek,
  isLastWeek,
  accent,
}: Props) => {
  if (!week) {
    return (
      <div className={`week-grid cmp-week cmp-row cmp-row-${accent}`}>
        <div className="cmp-gutter cmp-gutter-empty">
          <span className="cmp-plan-tag" title={planName}>
            {planName}
          </span>
        </div>
        <div className="cmp-not-started">Hasn’t started yet</div>
      </div>
    );
  }
  return (
    <div className={`week-grid cmp-week cmp-row cmp-row-${accent}`}>
      <div className="cmp-gutter">
        <span className="cmp-plan-tag" title={planName}>
          {planName}
        </span>
        <WeekSummary
          desc={week.desc}
          week={week}
          units={units}
          racePlan={racePlan}
          isFirstWeek={isFirstWeek}
          isLastWeek={isLastWeek}
          isHighestMileage={isPeakWeek}
        />
      </div>
      {week.days.map((d) => (
        <ReadOnlyDay
          key={key(d.date)}
          date={d.date}
          dayDetails={d.event}
          units={units}
        />
      ))}
    </div>
  );
};
