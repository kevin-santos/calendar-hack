import { useState } from "react";
import { repo } from "../ch/planrepo";
import { plans as builtInPlans } from "../ch/planList";
import { parsePlan, toSummary } from "../ch/customPlans";
import { PlanSummary } from "types/app";

interface Props {
  onImported: (summary: PlanSummary) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

const BUILT_IN_IDS = new Set(builtInPlans.map((p) => p[0]));

const PLACEHOLDER = `Paste a plan as YAML or JSON, e.g.

id: my_marathon
name: My Marathon Plan
description: Found in a book.
units: mi
type: Marathon
source: https://...
schedule:
  - workouts:
      - title: Rest
      - title: Easy {5}
        distance: 5
      - title: Intervals {6}
        distance: 6
      - title: Easy {5}
        distance: 5
      - title: Rest
      - title: Easy {8}
        distance: 8
      - title: Long run {16}
        distance: 16`;

export const CustomPlanImporter = ({ onImported, onDeleted, onClose }: Props) => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [customs, setCustoms] = useState<PlanSummary[]>(repo.customSummaries);

  const handleImport = () => {
    const { plan, error } = parsePlan(text);
    if (error || !plan) {
      setError(error ?? "Could not read that plan.");
      return;
    }
    if (BUILT_IN_IDS.has(plan.id)) {
      setError(`The id "${plan.id}" is already used by a built-in plan — choose a different id.`);
      return;
    }
    repo.addCustomPlan(plan);
    setCustoms(repo.customSummaries);
    setText("");
    setError(undefined);
    onImported(toSummary(plan));
  };

  const handleDelete = (id: string) => {
    repo.removeCustomPlan(id);
    setCustoms(repo.customSummaries);
    onDeleted(id);
  };

  return (
    <div className="cmp-modal-overlay" onClick={onClose}>
      <div
        className="cmp-modal"
        role="dialog"
        aria-label="Add custom plan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cmp-modal-head">
          <h2>Add a custom plan</h2>
          <button className="app-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="cmp-modal-hint">
          Paste a plan in <strong>YAML or JSON</strong>. It’s saved in this
          browser only (it won’t follow a shared link). See the format in{" "}
          <code>docs/adding-plans.md</code>.
        </p>

        <textarea
          className="cmp-modal-textarea"
          value={text}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(undefined);
          }}
        />

        {error && <p className="cmp-modal-error">{error}</p>}

        <div className="cmp-modal-actions">
          <button
            className="app-button app-button-primary"
            onClick={handleImport}
            disabled={!text.trim()}
          >
            Import plan
          </button>
        </div>

        {customs.length > 0 && (
          <div className="cmp-modal-list">
            <h3>Your custom plans</h3>
            <ul>
              {customs.map((c) => (
                <li key={c[0]}>
                  <span className="cmp-modal-list-name">
                    {c[1]} <small>({c[2]})</small>
                  </span>
                  <button
                    className="app-button cmp-modal-delete"
                    onClick={() => handleDelete(c[0])}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
