// Single source of truth for the current version of each legal document.
// Bump the version string when a document changes; users whose stored
// acceptance no longer matches will be re-prompted to accept.
export const CURRENT_TOS_VERSION = "3.1";

// EULA is accepted in the desktop app, not at signup.
export const CURRENT_EULA_VERSION = "3.1";

// Beta toggle. Flip to false and redeploy to deactivate the open beta.
// Served by GET /beta-status. No database, no logic, just the constant.
export const BETA_ACTIVE = true;
