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

// Default quiet-hours window (24h format, local time). Outside this window
// reminders are suppressed but the continuous-time counter keeps running, so
// exactly one reminder fires as soon as the window reopens instead of a
// pile of overdue ones. Persisted via preferencesStore so a future Settings
// screen can change them without a refactor.
export const DEFAULT_ACTIVE_HOURS_START = 8;
export const DEFAULT_ACTIVE_HOURS_END = 21;

// Snooze durations (minutes) for the two snooze actions.
export const SNOOZE_5_MIN = 5;
export const SNOOZE_30_MIN = 30;

// Consecutive snoozes (for the same unresolved trigger) after which the
// reminder copy shifts to something more direct.
export const SNOOZE_ESCALATION_THRESHOLD = 3;

// For fresh 30-minute-cycle triggers (not escalated snoozes): every Nth
// trigger pulls a 'warm' message instead of 'casual', for variety.
export const WARM_VARIETY_EVERY_N_TRIGGERS = 4;

// Streak milestones (consecutive "Done" resolutions) that show an in-app
// positive-reinforcement banner the next time the app is opened.
export const STREAK_REINFORCEMENT_MILESTONES = [3, 5, 10];
