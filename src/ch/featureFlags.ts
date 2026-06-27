// Local-only escape hatch for plans that were removed from the public tool at a
// publisher's copyright takedown request (see REMOVED_PLANS in config.ts).
//
// The plan data still ships in the repo, so we re-enable it while developing
// locally (`npm run dev`, where import.meta.env.DEV is true). A distributed
// production build (`vite build`) keeps the takedown block in place, so this
// cannot be shipped by accident.
//
// To view removed plans in a *local* production build you do not distribute,
// run with VITE_SHOW_REMOVED_PLANS=true.
export const SHOW_REMOVED_PLANS: boolean =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_REMOVED_PLANS === "true";
