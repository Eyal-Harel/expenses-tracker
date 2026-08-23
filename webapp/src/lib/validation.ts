// Guards against accidental paste-bombs / UI breakage on free-text fields
// (merchant and category names) — not a real attack surface at this app's
// trust level, just basic hygiene on otherwise-unbounded Postgres text
// columns.
export const MAX_NAME_LENGTH = 200;
