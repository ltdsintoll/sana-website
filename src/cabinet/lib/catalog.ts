// Symptom catalog shared with the Telegram Mini App: every chip is stored as a
// `CycleSymptom { category, key, value }` row through /api/symptoms, so marks
// made on the site and in Telegram are the same records.

export type ChipDef = { category: string; key: string; item: string };
export type SymptomSection = { id: string; chips: ChipDef[]; exclusive?: boolean; group: "wellbeing" | "activity" | "other" };

export const SYMPTOM_SECTIONS: SymptomSection[] = [
  {
    id: "menstrual",
    group: "wellbeing",
    chips: [
      { category: "menstrual", key: "cramps", item: "cramps" },
      { category: "menstrual", key: "heavy_flow", item: "heavy_flow" },
      { category: "menstrual", key: "spotting", item: "spotting" },
      { category: "menstrual", key: "clots", item: "clots" },
      { category: "menstrual", key: "headache_menstrual", item: "headache_menstrual" },
    ],
  },
  {
    id: "mood",
    group: "wellbeing",
    chips: [
      { category: "mood", key: "anxiety", item: "anxiety" },
      { category: "mood", key: "irritability", item: "irritability" },
      { category: "mood", key: "low_mood", item: "low_mood" },
      { category: "mood", key: "brain_fog", item: "brain_fog" },
    ],
  },
  {
    id: "symptoms",
    group: "wellbeing",
    chips: [
      { category: "physical", key: "bloating", item: "bloating" },
      { category: "physical", key: "breast_tenderness", item: "breast_tenderness" },
      { category: "physical", key: "back_pain", item: "back_pain" },
      { category: "physical", key: "nausea", item: "nausea" },
      { category: "physical", key: "acne", item: "acne" },
      { category: "energy_sleep", key: "fatigue", item: "fatigue" },
      { category: "energy_sleep", key: "insomnia", item: "insomnia" },
      { category: "energy_sleep", key: "food_cravings", item: "food_cravings" },
    ],
  },
  {
    id: "discharge",
    group: "wellbeing",
    chips: [
      { category: "discharge", key: "clear", item: "discharge_clear" },
      { category: "discharge", key: "white", item: "discharge_white" },
      { category: "discharge", key: "sticky", item: "discharge_sticky" },
      { category: "discharge", key: "unusual", item: "discharge_unusual" },
    ],
  },
  {
    id: "digestion",
    group: "wellbeing",
    chips: [
      { category: "digestion", key: "bloating", item: "digestion_bloating" },
      { category: "digestion", key: "constipation", item: "constipation" },
      { category: "digestion", key: "diarrhea", item: "diarrhea" },
      { category: "digestion", key: "gas", item: "gas" },
    ],
  },
  {
    id: "activity",
    group: "activity",
    chips: [
      { category: "activity", key: "walk", item: "walk" },
      { category: "activity", key: "gym", item: "gym" },
      { category: "activity", key: "yoga", item: "yoga" },
      { category: "activity", key: "rest", item: "rest" },
    ],
  },
  {
    id: "pregnancy_test",
    group: "other",
    exclusive: true,
    chips: [
      { category: "pregnancy_test", key: "positive", item: "preg_positive" },
      { category: "pregnancy_test", key: "negative", item: "preg_negative" },
      { category: "pregnancy_test", key: "waiting", item: "preg_waiting" },
    ],
  },
  {
    id: "ovulation_test",
    group: "other",
    exclusive: true,
    chips: [
      { category: "ovulation_test", key: "positive", item: "ov_positive" },
      { category: "ovulation_test", key: "negative", item: "ov_negative" },
      { category: "ovulation_test", key: "peak", item: "ov_peak" },
    ],
  },
  {
    id: "pills",
    group: "other",
    chips: [
      { category: "pills", key: "taken", item: "pill_taken" },
      { category: "pills", key: "missed", item: "pill_missed" },
      { category: "pills", key: "other_med", item: "pill_other" },
    ],
  },
  {
    id: "other",
    group: "other",
    chips: [
      { category: "other", key: "travel", item: "travel" },
      { category: "other", key: "stress", item: "stress" },
      { category: "other", key: "meditation", item: "meditation" },
      { category: "other", key: "journal", item: "journal" },
      { category: "other", key: "kegel", item: "kegel" },
      { category: "other", key: "breathing", item: "breathing" },
      { category: "other", key: "sick", item: "sick" },
      { category: "other", key: "alcohol", item: "alcohol" },
      { category: "other", key: "hormones", item: "hormones" },
    ],
  },
];

/** Intimacy rows (same keys as the Mini App). */
export const SEX = {
  category: "sex_activity",
  protection: ["protected", "unprotected"],
  type: ["vaginal", "oral", "anal"],
} as const;
export const LIBIDO = { category: "libido", key: "level" } as const;
export const WATER = { category: "water", key: "ml" } as const;
export const WEIGHT = { category: "weight", key: "kg" } as const;
export const TEMP = { category: "temperature", key: "celsius" } as const;
export const NOTES = { category: "notes", key: "entry" } as const;
