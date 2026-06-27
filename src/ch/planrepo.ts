import fetch from "cross-fetch";
import { Config } from "./config";
import { plans } from "./planList";
import {
  loadCustomPlans,
  saveCustomPlans,
  toSummary,
} from "./customPlans";
import { PlanSummary, TrainingPlan } from "types/app";

function url(summary: PlanSummary) {
  return Config.plansPath + summary[0] + ".json";
}

// A repository of training plans. Built-in plans are fetched on demand from
// JSON files; custom plans are user-imported and held in memory (persisted to
// localStorage via customPlans).
class PlanRepo {
  private readonly _cache = new Map<string, TrainingPlan>();
  private readonly _builtIn: PlanSummary[];
  private readonly _byId: { [id: string]: PlanSummary };
  private _custom = new Map<string, TrainingPlan>();

  constructor(available: PlanSummary[]) {
    this._builtIn = available;

    var initialMap: { [id: string]: PlanSummary } = {};
    this._byId = plans.reduce(function (m, p) {
      m[p[0]] = p;
      return m;
    }, initialMap);

    // Seed custom plans at construction (module-init) so find()/fetch() resolve
    // a custom id on the very first render, e.g. a custom plan in the URL.
    for (const p of loadCustomPlans()) {
      this._custom.set(p.id, p);
    }
  }

  // Custom plans first so they're easy to spot at the top of the picker.
  get available(): PlanSummary[] {
    return [...this.customSummaries, ...this._builtIn];
  }

  get customSummaries(): PlanSummary[] {
    return Array.from(this._custom.values()).map(toSummary);
  }

  isCustom(planId: string): boolean {
    return this._custom.has(planId);
  }

  find(planId: string): PlanSummary {
    const custom = this._custom.get(planId);
    if (custom) return toSummary(custom);
    return this._byId[planId] ? this._byId[planId] : this._byId['higdon_int_mara1']; // arbitrary choice
  }

  get first(): PlanSummary {
    return this.available[0];
  }

  // For testing
  isCached(a: PlanSummary): boolean {
    return this._cache.has(url(a));
  }

  async fetch(a: PlanSummary): Promise<TrainingPlan> {
    const custom = this._custom.get(a[0]);
    if (custom) return custom;
    return await fetchWithCache(url(a), this._cache);
  }

  addCustomPlan(plan: TrainingPlan): void {
    this._custom.set(plan.id, plan);
    saveCustomPlans(Array.from(this._custom.values()));
  }

  removeCustomPlan(planId: string): void {
    this._custom.delete(planId);
    saveCustomPlans(Array.from(this._custom.values()));
  }
}

// Fetch a T from a URL.
async function fetchFromUrl<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    return Promise.reject(error);
  }
  let result = await res.json();
  return result;
}

// Fetch a T from a URL, use the provided cache.
async function fetchWithCache<T>(
  url: string,
  cache: Map<string, T>,
): Promise<T> {
  // check in cache
  if (cache.has(url)) {
    let result = cache.get(url);
    if (!result) {
      throw Error("Assertion error: cached object not found");
    }
    return result;
  }
  const res: T = await fetchFromUrl(url);
  // add to cache and resolve
  cache.set(url, res);
  return res;
}

export const repo = new PlanRepo(plans);
