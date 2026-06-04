// Beta gating config, read from environment so it can be toggled on Railway
// without a redeploy.
//
// BETA_ACTIVE  - manual kill switch. Defaults to true; set to the literal
//                string "false" to close signups entirely.
// MAX_BETA_USERS - hard cap on total user count. Defaults to 50.
export const BETA_ACTIVE = process.env.BETA_ACTIVE !== "false"; // defaults to true if unset
export const MAX_BETA_USERS = parseInt(process.env.MAX_BETA_USERS || "50", 10);
