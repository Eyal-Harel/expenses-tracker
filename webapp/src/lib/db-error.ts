/** Logs the real Postgres/Supabase error server-side (it can contain
 * internal detail — constraint names, column names — that shouldn't reach
 * the client) and returns a plain, safe message to show the user instead.
 * Default fallback fits an action that failed (the right next step is to
 * resubmit); page-level data loads should pass a fallback suggesting a
 * refresh instead, since that's the actual fix for a transient fetch
 * failure (e.g. the occasional Supabase JWT-clock-skew blip). */
export function friendlyDbError(
  error: { message: string },
  context: string,
  fallback = "Something went wrong. Please try again.",
): string {
  console.error(`[${context}]`, error.message);
  return fallback;
}
