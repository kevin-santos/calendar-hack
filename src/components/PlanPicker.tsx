import React from "react";
import { PlanSummary } from "types/app";
import { REMOVED_PLANS } from "../ch/config";
import { SHOW_REMOVED_PLANS } from "../ch/featureFlags";
import { repo } from "../ch/planrepo";

interface Props {
  availablePlans: PlanSummary[];
  selectedPlan: PlanSummary;
  planChangeHandler: (p: PlanSummary) => void;
}

const PlanPicker = ({
  availablePlans,
  selectedPlan,
  planChangeHandler,
}: Props) => {
  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newSelection = availablePlans.find(
      (p) => p[1] === (event.target.value as string),
    );
    if (newSelection) {
      planChangeHandler(newSelection);
    } else {
      throw new Error("Invalid selection: " + event.target.value);
    }
  };

  const planOptions = availablePlans.map((ap) => {
    const isRemoved = !SHOW_REMOVED_PLANS && REMOVED_PLANS.has(ap[0]);
    const isCustom = repo.isCustom(ap[0]);
    const label = isRemoved
      ? `❌ (${ap[2]}) ${ap[1]}`
      : isCustom
        ? `★ (${ap[2]}) ${ap[1]}`
        : `(${ap[2]}) ${ap[1]}`;
    return (
      <option
        key={ap[1]}
        value={ap[1]}
        style={isRemoved ? { color: "red" } : undefined}
      >
        {label}
      </option>
    );
  });

  return (
    <select className="select" value={selectedPlan[1]} onChange={handleChange}>
      {planOptions}
    </select>
  );
};

export default PlanPicker;
