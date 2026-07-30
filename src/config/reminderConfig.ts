/**
 * Central tuning knobs for the reminder engine.
 * All tracking logic must reference these — never hardcode the raw numbers.
 * A future Settings screen will make these user-adjustable.
 */

// Continuous screen-on time (minutes) that triggers a reminder notification.
export const CONTINUOUS_TIME_THRESHOLD_MIN = 30;

// How long the screen must stay off (minutes) before it counts as a real
// break and resets the continuous-time counter. Shorter gaps (e.g. a quick
// glance-lock) do not reset the counter.
export const BREAK_RESET_GAP_MIN = 2;

// How often (seconds) the tracking loop re-evaluates screen state.
// Not part of the reminder "rules" the user tunes, but kept here so all
// timing constants for the tracker live in one place.
export const TRACKING_TICK_INTERVAL_SEC = 15;
