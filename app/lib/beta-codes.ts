// Master code — always valid, skips single-use check
export const MASTER_CODE = "EPMASTER";

// 10 pre-generated beta access codes (single-use)
// Format: 8-char uppercase alphanumeric with EP prefix
// Character set excludes 0/O, 1/I/L to avoid confusion
export const BETA_CODES = new Set([
  MASTER_CODE,
  "EP7KX3NR",
  "EP9WM4FT",
  "EPH2VD6B",
  "EPJQ8YS5",
  "EP3RN7CW",
  "EPFX4K9G",
  "EP6BT2HP",
  "EPWN5J8D",
  "EP8CM3VR",
  "EPKY6F4T",
]);

export const BETA_COOKIE_NAME = "ep_beta";
export const BETA_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
