/**
 * The reminder message pool. Structured so a later phase can add more
 * `MessageCategory` values (right now there's only one — position, posture,
 * and stretch bundled together) without touching the selection logic in
 * messageSelector.ts.
 *
 * Mixes English and Hindi (both Devanagari and Roman script) the way a
 * family actually texts, and always addresses her as "{name}" — which
 * resolves to "Mummy" by default (see preferencesStore.ts). Every template
 * is kept under ~110 characters so it doesn't truncate on Android's
 * notification shade.
 */

export type MessageTone = 'casual' | 'direct' | 'warm';
export type MessageTimeOfDay = 'morning' | 'afternoon' | 'evening';
export type MessageCategory = 'combined';

export interface ReminderMessage {
  id: string;
  tone: MessageTone;
  /** Empty array means "any time of day". */
  timeOfDay: MessageTimeOfDay[];
  category: MessageCategory;
  /** Use {name} as the placeholder for personalization. */
  template: string;
}

export const MESSAGE_POOL: ReminderMessage[] = [
  // --- Casual (18) ---
  { id: 'casual-01', tone: 'casual', timeOfDay: [], category: 'combined', template: 'Time to move, {name} 🙂' },
  { id: 'casual-02', tone: 'casual', timeOfDay: [], category: 'combined', template: '{name}, thoda uthiye — quick stretch time!' },
  { id: 'casual-03', tone: 'casual', timeOfDay: [], category: 'combined', template: 'Shoulders creeping up, {name}? Roll them back.' },
  { id: 'casual-04', tone: 'casual', timeOfDay: [], category: 'combined', template: 'चलो {name}, थोड़ा उठ के टहल लो 🚶' },
  { id: 'casual-05', tone: 'casual', timeOfDay: [], category: 'combined', template: 'Ek chhota stretch break, {name}?' },
  { id: 'casual-06', tone: 'casual', timeOfDay: [], category: 'combined', template: '{name}, phone thoda side rakhiye, stretch kar lijiye.' },
  { id: 'casual-07', tone: 'casual', timeOfDay: [], category: 'combined', template: 'आपकी गर्दन कह रही है — थोड़ा move करो, {name}!' },
  { id: 'casual-08', tone: 'casual', timeOfDay: [], category: 'combined', template: 'Quick break, {name} — neck aur shoulders loosen karo.' },
  { id: 'casual-09', tone: 'casual', timeOfDay: [], category: 'combined', template: '{name}, screen se break lo, sirf 2 minute ka.' },
  { id: 'casual-11', tone: 'casual', timeOfDay: [], category: 'combined', template: 'Posture check, {name}! Straighten up 🙂' },
  { id: 'casual-12', tone: 'casual', timeOfDay: [], category: 'combined', template: '{name}, ek stretch ho jaaye?' },
  { id: 'casual-13', tone: 'casual', timeOfDay: [], category: 'combined', template: 'Neck rolls calling your name, {name}.' },
  { id: 'casual-14', tone: 'casual', timeOfDay: [], category: 'combined', template: 'चलिए {name}, थोड़ा खड़े होकर घूम लीजिए।' },
  { id: 'casual-15', tone: 'casual', timeOfDay: [], category: 'combined', template: '{name}, break time — stand up and shake it out!' },
  { id: 'casual-16', tone: 'casual', timeOfDay: ['morning'], category: 'combined', template: 'Start the day loose, {name} — quick neck roll?' },
  { id: 'casual-17', tone: 'casual', timeOfDay: ['morning'], category: 'combined', template: 'सुबह-सुबह थोड़ा stretch कर लो, {name} 🌞' },
  { id: 'casual-18', tone: 'casual', timeOfDay: ['afternoon'], category: 'combined', template: 'Afternoon slump alert, {name} — reset your posture.' },
  { id: 'casual-20', tone: 'casual', timeOfDay: ['evening'], category: 'combined', template: 'Last stretch before you wind down, {name}?' },

  // --- Warm (9) ---
  { id: 'warm-01', tone: 'warm', timeOfDay: [], category: 'combined', template: 'Your neck will thank you — quick stretch time, {name}.' },
  { id: 'warm-02', tone: 'warm', timeOfDay: [], category: 'combined', template: '{name}, thoda apna khayal rakhiye — ek chhota break.' },
  { id: 'warm-03', tone: 'warm', timeOfDay: [], category: 'combined', template: 'आपकी सेहत मायने रखती है, {name} — थोड़ा उठिए 💛' },
  { id: 'warm-04', tone: 'warm', timeOfDay: [], category: 'combined', template: 'Take a moment for you, {name} — stretch and breathe.' },
  { id: 'warm-05', tone: 'warm', timeOfDay: [], category: 'combined', template: '{name}, aap important hain — thoda apne liye time nikaliye.' },
  { id: 'warm-06', tone: 'warm', timeOfDay: [], category: 'combined', template: 'छोटा ब्रेक, बड़ा आराम — चलिए {name}? 💛' },
  { id: 'warm-07', tone: 'warm', timeOfDay: [], category: 'combined', template: '{name}, ek gehri saans lo aur thoda stretch karo.' },
  { id: 'warm-08', tone: 'warm', timeOfDay: [], category: 'combined', template: 'आपका शरीर भी थोड़ा प्यार माँगता है, {name} 💛' },
  { id: 'warm-09', tone: 'warm', timeOfDay: ['evening'], category: 'combined', template: 'शाम हो गई {name}, दिन भर बैठे रहे — थोड़ा stretch कर लो।' },

  // --- Direct (7, used for the 3rd-consecutive-snooze escalation) ---
  { id: 'direct-01', tone: 'direct', timeOfDay: [], category: 'combined', template: "Still haven't moved, {name} — even 30 seconds helps." },
  { id: 'direct-02', tone: 'direct', timeOfDay: [], category: 'combined', template: '{name}, ab toh uth jaao — sirf ek minute lagega.' },
  { id: 'direct-03', tone: 'direct', timeOfDay: [], category: 'combined', template: 'Really, {name} — just stand up for a moment.' },
  { id: 'direct-04', tone: 'direct', timeOfDay: [], category: 'combined', template: 'अभी तक नहीं उठे, {name}? चलिए, बस थोड़ा सा।' },
  { id: 'direct-05', tone: 'direct', timeOfDay: [], category: 'combined', template: '{name}, this is your body asking nicely — one more time.' },
  { id: 'direct-06', tone: 'direct', timeOfDay: [], category: 'combined', template: 'Okay {name}, seriously — 30 seconds, that’s all.' },
  { id: 'direct-07', tone: 'direct', timeOfDay: [], category: 'combined', template: 'थोड़ा तो उठिए {name}, फोन कहीं नहीं जा रहा।' },
];
