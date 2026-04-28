/**
 * Application-wide constants
 */

// Size limits
export const MAX_CLIPBOARD_SIZE_BYTES = 200 * 1024; // 200KB

// Timeouts and intervals
export const CLIPBOARD_POLL_INTERVAL_MS = 200;

// Loop configuration defaults
export const DEFAULT_MAX_ITERATIONS = 5;
export const DEFAULT_MAX_RETRIES_PER_TEST = 2;

// Risk thresholds
export const RISK_THRESHOLD_LOW = 30;
export const RISK_THRESHOLD_HIGH = 60;

// Path modifiers
export const PATH_MODIFIER_ENV = 10;
export const PATH_MODIFIER_README = -10;
export const PATH_MODIFIER_TEST = 15;

// Multiple findings bonuses
export const BONUS_MULTIPLE_FINDINGS = 20;
export const BONUS_MANY_FINDINGS = 15;

// Critical key minimum score
export const CRITICAL_KEY_MIN_SCORE = 60;

// Test generation
export const MAX_CUSTOM_PATTERNS = 50;
