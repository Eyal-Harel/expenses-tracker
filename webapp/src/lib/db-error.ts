/** Logs the real Postgres/Supabase error server-side (it can contain
 * internal detail — constraint names, column names — that shouldn't reach
 * the client) and returns a plain, safe message to show the user instead. */
export function friendlyDbError(error: { message: string }, context: string): string {
  console.error(`[${context}]`, error.message);
  return "Something went wrong. Please try again.";
}
