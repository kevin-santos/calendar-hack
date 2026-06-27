import React, { useState } from "react";
import { repo } from "./ch/planrepo";
import { endOfWeek, addWeeks, isAfter } from "date-fns";
import { RacePlan } from "./ch/dategrid";
import { build, swap, swapDow } from "./ch/planbuilder";
import { CalendarGrid } from "./components/CalendarGrid";
import { PlanComparison } from "./components/PlanComparison";
import { toIcal } from "./ch/icalservice";
import { toCsv } from "./ch/csvService";
import { download } from "./ch/downloadservice";
import UnitsButtons from "./components/UnitsButtons";
import PlanAndDate from "./components/PlanAndDate";
import PlanPicker from "./components/PlanPicker";
import { CustomPlanImporter } from "./components/CustomPlanImporter";
import UndoButton from "./components/UndoButton";
import history from "./defy/history";
import {
  useQueryParams,
  StringParam,
  DateParam,
  NumberParam,
} from "use-query-params";
import { PlanDetailsCard } from "./components/PlanDetailsCard";
import { WeekStartsOn, WeekStartsOnValues } from "./ch/datecalc";
import WeekStartsOnPicker from "./components/WeekStartsOnPicker";
import { useMountEffect } from "./ch/hooks";
import { Units, PlanSummary, dayOfWeek } from "types/app";
import { getLocaleUnits } from "./ch/localize";
import { isPlanRemoved } from "./ch/config";
import { SHOW_REMOVED_PLANS } from "./ch/featureFlags";

// A plan is only treated as blocked when removed-plan visibility is off
// (i.e. in distributed production builds). Locally, removed plans are usable.
const planBlocked = (plan: PlanSummary) =>
  !SHOW_REMOVED_PLANS && isPlanRemoved(plan);

// Resolve a query-param plan id to a PlanSummary, or undefined if it isn't a
// real plan. repo.find() always falls back to a default, so we confirm the
// resolved id actually matches what was requested.
function resolvePlan(id: string | null | undefined): PlanSummary | undefined {
  if (!id) return undefined;
  const found = repo.find(id);
  return found[0] === id ? found : undefined;
}

const App = () => {
  const [{ u, p, d, s, p2 }, setq] = useQueryParams({
    u: StringParam,
    p: StringParam,
    d: DateParam,
    s: NumberParam,
    p2: StringParam,
  });
  const [selectedUnits, setSelectedUnits] = useState<Units>(
    u === "mi" || u === "km" ? u : getLocaleUnits(),
  );
  var [selectedPlan, setSelectedPlan] = useState(repo.find(p || ""));
  var [racePlan, setRacePlan] = useState<RacePlan | undefined>(undefined);
  var [undoHistory, setUndoHistory] = useState([] as RacePlan[]);
  var [weekStartsOn, setWeekStartsOn] = useState<WeekStartsOn>(
    s === 0 || s === 1 || s === 6 ? s : WeekStartsOnValues.Monday,
  );
  var [planEndDate, setPlanEndDate] = useState(
    d && isAfter(d, new Date())
      ? d
      : addWeeks(endOfWeek(new Date(), { weekStartsOn: weekStartsOn }), 20),
  );

  // Comparison: a second plan, aligned to the same race date / week start.
  const initialComparePlan = resolvePlan(p2);
  const [comparePlan, setComparePlan] = useState<PlanSummary | undefined>(
    initialComparePlan,
  );
  const [comparePlanData, setComparePlanData] = useState<RacePlan | undefined>(
    undefined,
  );
  const [compareMode, setCompareMode] = useState<boolean>(
    initialComparePlan !== undefined,
  );
  const [showImporter, setShowImporter] = useState<boolean>(false);

  useMountEffect(() => {
    initialLoad(selectedPlan, planEndDate, selectedUnits, weekStartsOn);
  });

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    // listen for changes to the URL and force the app to re-render
    history.listen(() => {
      forceUpdate();
    });
  }, []);

  const getParams = (
    units: Units,
    plan: PlanSummary,
    date: Date,
    weekStartsOn: WeekStartsOn,
    comparePlanId: string | undefined,
  ) => {
    return {
      u: units,
      p: plan[0],
      d: date,
      s: weekStartsOn,
      p2: comparePlanId,
    };
  };

  const comparePlanId = () => (comparePlan ? comparePlan[0] : undefined);

  // Build the comparison plan for the current date / week start, honoring the
  // removed-plan guard. Returns the RacePlan or undefined.
  const buildComparePlan = async (
    plan: PlanSummary,
    endDate: Date,
    wso: WeekStartsOn,
  ): Promise<RacePlan | undefined> => {
    if (planBlocked(plan)) return undefined;
    return build(await repo.fetch(plan), endDate, wso);
  };

  const initialLoad = async (
    plan: PlanSummary,
    endDate: Date,
    units: Units,
    weekStartsOn: WeekStartsOn,
  ) => {
    if (planBlocked(plan)) {
      setq(getParams(units, plan, endDate, weekStartsOn, comparePlanId()));
      return;
    }
    const racePlan = build(await repo.fetch(plan), endDate, weekStartsOn);
    setRacePlan(racePlan);
    setUndoHistory([...undoHistory, racePlan]);
    if (comparePlan) {
      setComparePlanData(
        await buildComparePlan(comparePlan, endDate, weekStartsOn),
      );
    }
    setq(getParams(units, plan, endDate, weekStartsOn, comparePlanId()));
  };

  const onSelectedPlanChange = async (plan: PlanSummary) => {
    setSelectedPlan(plan);
    if (planBlocked(plan)) {
      setRacePlan(undefined);
      setUndoHistory([]);
      setq(getParams(selectedUnits, plan, planEndDate, weekStartsOn, comparePlanId()));
      return;
    }
    const racePlan = build(await repo.fetch(plan), planEndDate, weekStartsOn);
    setRacePlan(racePlan);
    setUndoHistory([racePlan]);
    setq(getParams(selectedUnits, plan, planEndDate, weekStartsOn, comparePlanId()));
  };

  const onComparePlanChange = async (plan: PlanSummary) => {
    setComparePlan(plan);
    setComparePlanData(await buildComparePlan(plan, planEndDate, weekStartsOn));
    setq(getParams(selectedUnits, selectedPlan, planEndDate, weekStartsOn, plan[0]));
  };

  const toggleCompare = async () => {
    if (compareMode) {
      // turn comparison off and drop the second plan from the URL
      setCompareMode(false);
      setComparePlan(undefined);
      setComparePlanData(undefined);
      setq(getParams(selectedUnits, selectedPlan, planEndDate, weekStartsOn, undefined));
      return;
    }
    setCompareMode(true);
    // default the comparison to the first plan that isn't plan A
    let plan = comparePlan;
    if (!plan) {
      plan =
        repo.available.find((pp) => pp[0] !== selectedPlan[0]) ??
        repo.available[0];
    }
    setComparePlan(plan);
    setComparePlanData(await buildComparePlan(plan, planEndDate, weekStartsOn));
    setq(getParams(selectedUnits, selectedPlan, planEndDate, weekStartsOn, plan[0]));
  };

  const onSelectedEndDateChange = async (date: Date) => {
    const racePlan = build(await repo.fetch(selectedPlan), date, weekStartsOn);
    setPlanEndDate(date);
    setRacePlan(racePlan);
    setUndoHistory([racePlan]);
    if (comparePlan) {
      setComparePlanData(await buildComparePlan(comparePlan, date, weekStartsOn));
    }
    setq(getParams(selectedUnits, selectedPlan, date, weekStartsOn, comparePlanId()));
  };

  const onSelectedUnitsChanged = (u: Units) => {
    setSelectedUnits(u);
    setq(getParams(u, selectedPlan, planEndDate, weekStartsOn, comparePlanId()));
  };

  const onWeekStartsOnChanged = async (v: WeekStartsOn) => {
    const racePlan = build(await repo.fetch(selectedPlan), planEndDate, v);
    setWeekStartsOn(v);
    setRacePlan(racePlan);
    setUndoHistory([racePlan]);
    if (comparePlan) {
      setComparePlanData(await buildComparePlan(comparePlan, planEndDate, v));
    }
    setq(getParams(selectedUnits, selectedPlan, planEndDate, v, comparePlanId()));
  };

  const onCustomImported = async (summary: PlanSummary) => {
    setShowImporter(false);
    setSelectedPlan(summary);
    const racePlan = build(await repo.fetch(summary), planEndDate, weekStartsOn);
    setRacePlan(racePlan);
    setUndoHistory([racePlan]);
    setq(getParams(selectedUnits, summary, planEndDate, weekStartsOn, comparePlanId()));
    forceUpdate(); // so PlanPicker re-reads repo.available
  };

  const onCustomDeleted = async (id: string) => {
    let nextCompareId = comparePlanId();
    if (comparePlan && comparePlan[0] === id) {
      setComparePlan(undefined);
      setComparePlanData(undefined);
      nextCompareId = undefined;
    }
    if (selectedPlan[0] === id) {
      // The selected plan no longer exists — fall back to a default.
      const fallback = repo.find("higdon_int_mara1");
      setSelectedPlan(fallback);
      const racePlan = build(await repo.fetch(fallback), planEndDate, weekStartsOn);
      setRacePlan(racePlan);
      setUndoHistory([racePlan]);
      setq(getParams(selectedUnits, fallback, planEndDate, weekStartsOn, nextCompareId));
    } else {
      setq(getParams(selectedUnits, selectedPlan, planEndDate, weekStartsOn, nextCompareId));
    }
    forceUpdate();
  };

  function swapDates(d1: Date, d2: Date): void {
    if (racePlan) {
      const newRacePlan = swap(racePlan, d1, d2);
      setRacePlan(newRacePlan);
      setUndoHistory([...undoHistory, newRacePlan]);
    }
  }

  function doSwapDow(dow1: dayOfWeek, dow2: dayOfWeek) {
    if (racePlan) {
      const newRacePlan = swapDow(racePlan, dow1, dow2);
      setRacePlan(newRacePlan);
      setUndoHistory([...undoHistory, newRacePlan]);
    }
  }

  function downloadIcalHandler() {
    if (racePlan) {
      const eventsStr = toIcal(racePlan, selectedUnits);
      if (eventsStr) {
        download(eventsStr, "plan", "ics");
      }
    }
  }

  function downloadCsvHandler() {
    if (racePlan) {
      const eventsStr = toCsv(racePlan, selectedUnits, weekStartsOn);
      if (eventsStr) {
        download(eventsStr, "plan", "csv");
      }
    }
  }

  function undoHandler() {
    if (undoHistory?.length >= 0) {
      undoHistory.pop();
    }
    setRacePlan(undoHistory[undoHistory.length - 1]);
  }

  const compareReady =
    compareMode &&
    comparePlan !== undefined &&
    !planBlocked(comparePlan) &&
    racePlan !== undefined &&
    comparePlanData !== undefined;

  return (
    <>
      {showImporter && (
        <CustomPlanImporter
          onImported={onCustomImported}
          onDeleted={onCustomDeleted}
          onClose={() => setShowImporter(false)}
        />
      )}
      <PlanAndDate
        availablePlans={repo.available}
        selectedPlan={selectedPlan}
        selectedDate={planEndDate}
        dateChangeHandler={onSelectedEndDateChange}
        selectedPlanChangeHandler={onSelectedPlanChange}
        weekStartsOn={weekStartsOn}
      />
      {!planBlocked(selectedPlan) && (
        <>
          <div className="second-toolbar">
            <div className="units">
              <UnitsButtons
                units={selectedUnits}
                unitsChangeHandler={onSelectedUnitsChanged}
              />
            </div>
          </div>
          <div className="second-toolbar">
            <button className="app-button app-button-primary" onClick={downloadIcalHandler}>Download iCal</button>
            <button className="app-button" onClick={downloadCsvHandler}>Download CSV</button>
            <UndoButton
              disabled={undoHistory.length <= 1}
              undoHandler={undoHandler}
            />
            <button
              className="app-button"
              onClick={toggleCompare}
              aria-pressed={compareMode}
            >
              {compareMode ? "Stop comparing" : "Compare plans"}
            </button>
            <button className="app-button" onClick={() => setShowImporter(true)}>
              Add custom plan
            </button>
          </div>
          {compareMode && (
            <div className="second-toolbar compare-picker">
              <span className="compare-vs-label">Compare against:</span>
              {comparePlan && (
                <PlanPicker
                  availablePlans={repo.available}
                  selectedPlan={comparePlan}
                  planChangeHandler={onComparePlanChange}
                />
              )}
            </div>
          )}
          <PlanDetailsCard racePlan={racePlan} />
          <div className="second-toolbar">
            <WeekStartsOnPicker
              weekStartsOn={weekStartsOn}
              changeHandler={onWeekStartsOnChanged}
            />
          </div>
        </>
      )}
      <div className="main-ui">
        {planBlocked(selectedPlan) ? (
          <div className="plan-removed-message">
            <h2>THIS PLAN HAS BEEN REMOVED</h2>
            <p>Human Kinetics, publisher of the book this plan comes from, has requested the removal of this plan.</p>
            <p>This makes me sad, I love these books and I know you do too.</p>
            <p>It's disappointing.</p>
            <p>But if they don't want to be here then they shouldn't be.</p>
            <p>No point in dwelling on it.</p>
            <p>Go for a run.</p>
            <br/>
            <p>• Advanced Marathoning, Third Edition</p>
            <p>• Advanced Marathoning, Fourth Edition</p>
            <p>• Faster Road Racing: 5k to Half Marathon</p>
          </div>
        ) : compareMode && comparePlan && planBlocked(comparePlan) ? (
          <div className="plan-removed-message">
            <h2>THE COMPARISON PLAN HAS BEEN REMOVED</h2>
            <p>That plan was removed at the publisher's request. Pick another plan to compare.</p>
          </div>
        ) : compareReady ? (
          <PlanComparison
            planA={racePlan!}
            planB={comparePlanData!}
            nameA={selectedPlan[1]}
            nameB={comparePlan![1]}
            units={selectedUnits}
            weekStartsOn={weekStartsOn}
          />
        ) : (
          racePlan && (
            <CalendarGrid
              racePlan={racePlan}
              units={selectedUnits}
              weekStartsOn={weekStartsOn}
              swapDates={swapDates}
              swapDow={doSwapDow}
            />
          )
        )}
      </div>
    </>
  );
};

export default App;
