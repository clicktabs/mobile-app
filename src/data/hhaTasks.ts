/**
 * Generated from resources/views/hha-notes/hha.blade.php — do not hand-edit.
 *
 * These keys are written into hha_notes.assessment_data['tasks'], the same column the
 * web form writes. A key that differs from the web form's is a task that vanishes from
 * the record, so the list is extracted from that form rather than retyped.
 */

export type HhaTaskStatus = 'completed' | 'refused' | 'na';

export type HhaTask = {
  key: string;
  label: string;
  frequency: string;
};

export type HhaTaskSection = {
  section: string;
  tasks: HhaTask[];
};

export const HHA_TASK_SECTIONS: HhaTaskSection[] = [
  {
    section: "BATH",
    tasks: [
      { key: "sh", label: "Shower", frequency: "As Needed" },
      { key: "shc", label: "Shampoo & Condition Hair", frequency: "As Needed" },
      { key: "sham", label: "Shampoo Hair in Bed", frequency: "Weekly" },
      { key: "lot", label: "Lotion on Trunk", frequency: "As Needed" },
      { key: "comb", label: "Comb\/Brush Hair", frequency: "Every Visit" },
      { key: "dress", label: "Dressing", frequency: "Every Visit" },
    ],
  },
  {
    section: "BLADDER\/BOWEL",
    tasks: [
      { key: "catheter_care", label: "Catheter Care", frequency: "As Needed" },
      { key: "toilet_commode", label: "Toilet\/Commode", frequency: "As Needed" },
      { key: "bedpan_urinal", label: "Bedpan\/Urinal", frequency: "As Needed" },
      { key: "brief_pad", label: "Brief\/Pad", frequency: "As Needed" },
      { key: "incontinent", label: "Incontinent Care", frequency: "As Needed" },
      { key: "peri_care", label: "Peri Care", frequency: "As Needed" },
    ],
  },
  {
    section: "AMBULATION",
    tasks: [
      { key: "distance", label: "Distance Assessment", frequency: "Every Visit" },
      { key: "frequency", label: "Frequency Assessment", frequency: "Every Visit" },
      { key: "transfers", label: "Assist with Transfers", frequency: "As Needed" },
      { key: "transfer_belt", label: "Use Transfer Belt", frequency: "As Needed" },
      { key: "bedbound", label: "Bedbound Care", frequency: "As Needed" },
      { key: "weight_bearing", label: "Weight Bearing: Full\/Partial", frequency: "As Needed" },
      { key: "cane_crutches", label: "Cane\/Crutches", frequency: "As Needed" },
      { key: "walker_wheelchair", label: "Walker\/Wheelchair", frequency: "As Needed" },
    ],
  },
  {
    section: "RANGE OF MOTION",
    tasks: [
      { key: "prom_ul", label: "PROM U L (Passive Range of Motion Upper\/Lower)", frequency: "As Needed" },
      { key: "arom_ul", label: "AROM U L (Active Range of Motion Upper\/Lower)", frequency: "As Needed" },
      { key: "limb_prosthesis", label: "Apply Limb Prosthesis", frequency: "As Needed" },
      { key: "braces", label: "Braces", frequency: "As Needed" },
      { key: "teds_ace", label: "TEDS\/Ace Wraps", frequency: "As Needed" },
    ],
  },
  {
    section: "SKIN\/SENSORY",
    tasks: [
      { key: "lotion_skin", label: "Lotion to Skin", frequency: "As Needed" },
      { key: "nails", label: "Nail Care", frequency: "Weekly" },
      { key: "turn_position", label: "Turn & Position", frequency: "As Needed" },
      { key: "foot_soak", label: "Foot Soak", frequency: "As Needed" },
      { key: "non_sterile_drsg", label: "Non Sterile Drsg Chg", frequency: "As Needed" },
      { key: "glasses_contacts", label: "Glasses\/Contacts", frequency: "As Needed" },
      { key: "hearing_aide", label: "Hearing Aide: L R", frequency: "As Needed" },
    ],
  },
  {
    section: "MEALS",
    tasks: [
      { key: "fluid", label: "Restrict Fluids\/Push Fluids", frequency: "As Needed" },
      { key: "feed_client", label: "Feed Client", frequency: "As Needed" },
      { key: "meal", label: "Meal Prep: B L D SN", frequency: "As Needed" },
      { key: "supplement", label: "Supplement Given", frequency: "As Needed" },
      { key: "weight", label: "Weight", frequency: "Weekly" },
    ],
  },
  {
    section: "HOUSEHOLD SERVICES",
    tasks: [
      { key: "vacuum", label: "Vacuum", frequency: "As Needed" },
      { key: "laundry", label: "Laundry", frequency: "As Needed" },
      { key: "kitchen_dishes", label: "Kitchen\/Dishes", frequency: "As Needed" },
      { key: "bathrooms", label: "Bathroom(s)", frequency: "As Needed" },
      { key: "garbage", label: "Empty Garbage", frequency: "As Needed" },
      { key: "bed_linen", label: "Make Bed, Change Linen", frequency: "As Needed" },
    ],
  },
  {
    section: "Other",
    tasks: [
      { key: "prec", label: "Universal precautions", frequency: "Every Visit" },
    ],
  },
];

/** Every task key, for validation and for counting what has been recorded. */
export const HHA_TASK_KEYS: string[] = HHA_TASK_SECTIONS.flatMap((s) =>
  s.tasks.map((t) => t.key),
);
