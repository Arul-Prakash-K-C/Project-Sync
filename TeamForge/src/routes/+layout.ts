// Every page reads browser storage (or Supabase) on mount, so there is nothing
// useful to render on a server. Ship as a single-page app.
export const ssr = false;
export const prerender = false;
