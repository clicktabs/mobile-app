export type ProblemOption = {
  field: string;
  label: string;
  defaultNotes: string;
};

export type ProblemStatementTemplate = {
  group: string;
  label: string;
  sectionKey: string;
  discipline: 'sn' | 'pt' | 'ot' | 'st';
  defaultPlanOfCare: string;
  interventions: ProblemOption[];
  goals: ProblemOption[];
};

function opts(
  items: Array<[string, string, string]>,
): ProblemOption[] {
  return items.map(([field, label, defaultNotes]) => ({ field, label, defaultNotes }));
}

export const PROBLEM_STATEMENT_TEMPLATES: ProblemStatementTemplate[] = [
  {
    group: 'High Risk',
    label: 'High Risk: Potential for Hospitalization',
    sectionKey: 'ps_hospitalization',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to assess risk factors for rehospitalization, provide teaching on early warning signs, and coordinate with the care team to reduce avoidable hospitalizations during this episode of care.',
    interventions: opts([
      ['hi_assess', 'Skilled Assessment: Hospitalization Risk', 'SN to assess hospitalization risk factors each visit and report significant changes.'],
      ['hi_teach', 'Patient/Caregiver Education: Early Warning Signs', 'SN to instruct patient/caregiver on early warning signs and when to contact the agency or seek emergency care.'],
      ['hi_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['hg_avoid', 'Avoid Preventable Hospitalization', 'Patient will remain free of preventable hospitalization during this episode of care.'],
      ['hg_verbalize', 'Verbalize Emergency Response Plan', 'Patient/caregiver will verbalize understanding of early warning signs and emergency response plan.'],
    ]),
  },
  {
    group: 'High Risk',
    label: 'High Risk Potential for Infection',
    sectionKey: 'ps_infection',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to assess for signs/symptoms of infection, reinforce infection-prevention measures, and coordinate care to reduce infection risk during this episode of care.',
    interventions: opts([
      ['fi_assess', 'Skilled Assessment: Infection Risk', 'SN to assess for signs and symptoms of infection each visit.'],
      ['fi_teach', 'Patient/Caregiver Education: Infection Prevention', 'SN to instruct on hand hygiene, wound/site care, and infection precautions.'],
      ['fi_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['fg_free', 'Remain Free of Infection', 'Patient will remain free of infection during this episode of care.'],
      ['fg_verbalize', 'Verbalize Infection Precautions', 'Patient/caregiver will verbalize infection-prevention measures.'],
    ]),
  },
  {
    group: 'Needs',
    label: 'Need for Infectious Disease Management',
    sectionKey: 'ps_infectious_disease',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to provide skilled assessment and teaching related to infectious disease management, monitor response to treatment, and coordinate with the physician as indicated.',
    interventions: opts([
      ['di_assess', 'Skilled Assessment: Infectious Disease', 'SN to assess disease status, symptoms, and treatment response each visit.'],
      ['di_teach', 'Patient/Caregiver Education: Disease Management', 'SN to instruct on medication adherence, precautions, and reporting of worsening symptoms.'],
      ['di_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['dg_manage', 'Demonstrate Disease Management', 'Patient/caregiver will demonstrate understanding of infectious disease management plan.'],
      ['dg_report', 'Report Worsening Symptoms Promptly', 'Patient/caregiver will report worsening symptoms promptly to the agency/physician.'],
    ]),
  },
  {
    group: 'Needs',
    label: 'Need for Advanced Care Planning',
    sectionKey: 'ps_acp',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to facilitate advanced care planning discussions, assess patient/caregiver understanding of prognosis and goals of care, and coordinate documentation of preferences.',
    interventions: opts([
      ['ci_acp_discuss', 'Advanced Care Planning Discussion', 'SN to discuss goals of care, advance directives, and patient preferences.'],
      ['ci_acp_coord', 'Care Coordination: ACP Documentation', 'SN to coordinate documentation of advance directives with physician/care team.'],
      ['ci_acp_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['cg_acp_prefs', 'Document Care Preferences', 'Patient care preferences and advance directives will be clarified and documented.'],
      ['cg_acp_verbalize', 'Verbalize Understanding of ACP', 'Patient/caregiver will verbalize understanding of advanced care planning options.'],
    ]),
  },
  {
    group: 'Alterations',
    label: 'Alteration in Home Environment',
    sectionKey: 'ps_home_env',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to assess home safety and environment, provide teaching on fall/safety precautions, and recommend modifications to support safe care in the home.',
    interventions: opts([
      ['he_assess', 'Home Safety Assessment', 'SN to assess home environment for safety hazards each visit.'],
      ['he_teach', 'Patient/Caregiver Education: Home Safety', 'SN to instruct on fall prevention and environmental safety measures.'],
      ['he_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['heg_safe', 'Maintain Safe Home Environment', 'Patient will maintain a safe home environment during this episode of care.'],
      ['heg_verbalize', 'Verbalize Safety Precautions', 'Patient/caregiver will verbalize home safety precautions.'],
    ]),
  },
  {
    group: 'Alterations',
    label: 'Alteration in Comfort: Pain',
    sectionKey: 'ps_pain',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to provide skilled assessment, teaching/training and reinforcement of teaching to properly assess, manage and mitigate pain.',
    interventions: opts([
      [
        'pi_teach_pain',
        'Patient/Caregiver Education: Pain Management',
        'SN to instruct patient/caregiver regarding strategies to mitigate pain including medication administration, recording and reporting pain; non-pharmacological treatments including positioning, massage, visualization, distraction and cold or warm compresses.',
      ],
      ['pi_additional_pain', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      [
        'pg_optimal_pain',
        'Achieve Optimal Pain Management',
        'Patient will achieve optimal effectiveness of the established pain management regimen within the timeframe of this episode of care.',
      ],
      [
        'pg_activity_level',
        'Improved Activity Tolerance',
        'Patient will demonstrate an improved activity level as a result of effective pain control within the timeframe of this episode of care.',
      ],
      [
        'pg_knowledge_medication',
        'Verbalize Knowledge of Pain Medications',
        'Patient/caregiver will verbalize and demonstrate understanding of prescribed pain medications, including purpose, dosing schedule, and safe administration technique, within the timeframe of this episode of care.',
      ],
      [
        'pg_decrease_pain',
        'Report Reduction in Pain Level',
        'Patient/caregiver will report a reduction in pain to an acceptable level within the timeframe of this episode of care.',
      ],
      [
        'pg_manage_medication',
        'Self-Manage Pain Medication Regimen',
        'Patient/caregiver will demonstrate safe and independent management of the prescribed pain medication regimen within the timeframe of this episode of care.',
      ],
    ]),
  },
  {
    group: 'Alterations',
    label: 'Alteration in Integumentary Status',
    sectionKey: 'ps_integumentary',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to provide skilled wound/skin assessment, perform ordered wound care, and teach patient/caregiver wound-care techniques and skin-integrity precautions.',
    interventions: opts([
      ['ii_assess', 'Skilled Wound/Skin Assessment', 'SN to assess wound/skin status, drainage, and healing progress each visit.'],
      ['ii_care', 'Perform Ordered Wound Care', 'SN to perform wound care as ordered and report significant changes.'],
      ['ii_teach', 'Patient/Caregiver Education: Wound Care', 'SN to instruct on wound care technique, infection signs, and skin protection.'],
      ['ii_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['ig_heal', 'Progress Toward Wound Healing', 'Wound/skin integrity will demonstrate progress toward healing during this episode of care.'],
      ['ig_verbalize', 'Verbalize Wound Care Technique', 'Patient/caregiver will verbalize/demonstrate proper wound care technique.'],
    ]),
  },
  {
    group: 'Alterations',
    label: 'Alteration in Genitourinary Status',
    sectionKey: 'ps_gu',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to assess genitourinary status, provide teaching related to GU management, and coordinate with the physician for changes in condition.',
    interventions: opts([
      ['ci_gu_assess', 'Skilled Assessment: Genitourinary', 'SN to assess GU status, catheter function if applicable, and related symptoms.'],
      ['ci_gu_teach', 'Patient/Caregiver Education: GU Care', 'SN to instruct on GU care, hydration, and reporting of complications.'],
      ['ci_gu_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['cg_gu_stable', 'Maintain Stable GU Status', 'Patient will maintain stable genitourinary status during this episode of care.'],
      ['cg_gu_verbalize', 'Verbalize GU Care Plan', 'Patient/caregiver will verbalize understanding of GU care plan.'],
    ]),
  },
  {
    group: 'Alterations',
    label: 'Alteration in Neurological Status',
    sectionKey: 'ps_neuro',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to assess neurological status, provide teaching on safety and symptom management, and coordinate care based on neurological changes.',
    interventions: opts([
      ['ci_neuro_assess', 'Skilled Assessment: Neurological', 'SN to assess neurological status and safety each visit.'],
      ['ci_neuro_teach', 'Patient/Caregiver Education: Neuro Safety', 'SN to instruct on safety precautions and reporting of neurological changes.'],
      ['ci_neuro_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['cg_neuro_stable', 'Maintain Neurological Stability', 'Patient will maintain neurological stability during this episode of care.'],
      ['cg_neuro_safety', 'Demonstrate Safety Awareness', 'Patient/caregiver will demonstrate safety awareness related to neurological deficits.'],
    ]),
  },
  {
    group: 'Alterations',
    label: 'Alteration in Musculoskeletal Status',
    sectionKey: 'ps_msk',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to assess musculoskeletal status and functional limitations, reinforce activity/mobility precautions, and coordinate with therapy as indicated.',
    interventions: opts([
      ['mi_assess', 'Skilled Assessment: Musculoskeletal', 'SN to assess pain, mobility, and functional limitations each visit.'],
      ['mi_teach', 'Patient/Caregiver Education: Mobility/Safety', 'SN to instruct on safe mobility, body mechanics, and activity pacing.'],
      ['mi_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['mg_mobility', 'Improve/Maintain Safe Mobility', 'Patient will demonstrate safe mobility within functional capacity during this episode of care.'],
      ['mg_verbalize', 'Verbalize Activity Precautions', 'Patient/caregiver will verbalize activity and safety precautions.'],
    ]),
  },
  {
    group: 'Alterations',
    label: 'Alteration in Glucose Metabolism',
    sectionKey: 'ps_glucose',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to assess glucose control, provide teaching on diabetes management, and reinforce medication, diet, and monitoring techniques.',
    interventions: opts([
      ['gi_assess', 'Skilled Assessment: Glucose Metabolism', 'SN to assess blood glucose trends, symptoms of hypo/hyperglycemia, and self-management.'],
      ['gi_teach', 'Patient/Caregiver Education: Diabetes Management', 'SN to instruct on glucose monitoring, medication, diet, and foot care.'],
      ['gi_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['gg_range', 'Maintain Target Glucose Range', 'Patient will maintain blood glucose within target range during this episode of care.'],
      ['gg_verbalize', 'Verbalize Diabetes Self-Management', 'Patient/caregiver will verbalize diabetes self-management strategies.'],
    ]),
  },
  {
    group: 'Alterations',
    label: 'Alteration in Nutrition',
    sectionKey: 'ps_nutrition',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to assess nutritional status, provide teaching on diet and hydration, and coordinate with dietitian/physician as indicated.',
    interventions: opts([
      ['ni_assess', 'Skilled Assessment: Nutrition', 'SN to assess nutritional intake, weight trends, and swallowing/feeding concerns.'],
      ['ni_teach', 'Patient/Caregiver Education: Nutrition', 'SN to instruct on dietary recommendations and hydration.'],
      ['ni_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['ng_intake', 'Achieve Adequate Nutritional Intake', 'Patient will achieve/maintain adequate nutritional intake during this episode of care.'],
      ['ng_verbalize', 'Verbalize Dietary Recommendations', 'Patient/caregiver will verbalize dietary recommendations.'],
    ]),
  },
  {
    group: 'Medication & Therapy',
    label: 'Medication Management',
    sectionKey: 'ps_med_mgmt',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to review medication profile, assess adherence and adverse effects, and teach safe medication administration and reconciliation.',
    interventions: opts([
      ['mi_med_review', 'Medication Profile Review', 'SN to review medications for accuracy, interactions, and adherence each visit.'],
      ['mi_med_teach', 'Patient/Caregiver Education: Medications', 'SN to instruct on purpose, dose, schedule, and side effects of prescribed medications.'],
      ['mi_med_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['mg_adhere', 'Demonstrate Medication Adherence', 'Patient/caregiver will demonstrate safe medication adherence during this episode of care.'],
      ['mg_verbalize_med', 'Verbalize Medication Knowledge', 'Patient/caregiver will verbalize understanding of medication purpose and schedule.'],
    ]),
  },
  {
    group: 'Medication & Therapy',
    label: 'Injections',
    sectionKey: 'ps_injections',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to administer and/or teach injection technique as ordered, assess site response, and reinforce safe storage and disposal practices.',
    interventions: opts([
      ['ii_admin', 'Administer/Teach Injections', 'SN to administer injections as ordered and/or teach proper technique.'],
      ['ii_site', 'Assess Injection Sites', 'SN to assess injection sites for complications.'],
      ['ii_inj_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['ig_technique', 'Demonstrate Injection Technique', 'Patient/caregiver will demonstrate correct injection technique.'],
      ['ig_safe', 'Safe Medication Storage/Disposal', 'Patient/caregiver will verbalize safe storage and sharps disposal.'],
    ]),
  },
  {
    group: 'Medication & Therapy',
    label: 'IV and/or Parenteral Therapy',
    sectionKey: 'ps_iv_therapy',
    discipline: 'sn',
    defaultPlanOfCare:
      'SN to manage IV/parenteral therapy as ordered, assess line/site integrity, and teach patient/caregiver related precautions and reporting parameters.',
    interventions: opts([
      ['iv_manage', 'Manage IV/Parenteral Therapy', 'SN to administer/monitor IV or parenteral therapy as ordered.'],
      ['iv_assess', 'Assess Access Site/Line', 'SN to assess access site/line for complications each visit.'],
      ['iv_teach', 'Patient/Caregiver Education: IV Therapy', 'SN to instruct on precautions and when to report complications.'],
      ['iv_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['ivg_complete', 'Complete Therapy Without Complication', 'Patient will complete ordered IV/parenteral therapy without preventable complication.'],
      ['ivg_verbalize', 'Verbalize IV Precautions', 'Patient/caregiver will verbalize IV/parenteral therapy precautions.'],
    ]),
  },
  {
    group: 'Therapy',
    label: 'PT: Need for Therapy',
    sectionKey: 'ps_pt_therapy',
    discipline: 'pt',
    defaultPlanOfCare:
      'PT to evaluate and treat functional deficits, provide therapeutic interventions to improve mobility/strength/balance, and educate patient/caregiver on home exercise program.',
    interventions: opts([
      ['pt_i_eval', 'PT Evaluation and Treatment', 'PT to evaluate and provide skilled therapy interventions as indicated.'],
      ['pt_i_hep', 'Home Exercise Program', 'PT to instruct patient/caregiver in a home exercise program.'],
      ['pt_i_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['pt_g_mobility', 'Improve Functional Mobility', 'Patient will demonstrate improved functional mobility during this episode of care.'],
      ['pt_g_hep', 'Independent with HEP', 'Patient/caregiver will demonstrate home exercise program correctly.'],
    ]),
  },
  {
    group: 'Therapy',
    label: 'OT: Need for Therapy',
    sectionKey: 'ps_ot_therapy',
    discipline: 'ot',
    defaultPlanOfCare:
      'OT to evaluate and treat deficits in ADLs/IADLs, provide adaptive techniques/equipment recommendations, and educate patient/caregiver to maximize independence.',
    interventions: opts([
      ['ot_i_eval', 'OT Evaluation and Treatment', 'OT to evaluate and provide skilled OT interventions as indicated.'],
      ['ot_i_adl', 'ADL/IADL Training', 'OT to instruct in adaptive techniques for ADLs/IADLs.'],
      ['ot_i_other', 'Additional Intervention Orders', ''],
    ]),
    goals: opts([
      ['ot_g_adl', 'Improve ADL Independence', 'Patient will demonstrate improved independence with ADLs during this episode of care.'],
      ['ot_g_adapt', 'Use Adaptive Techniques', 'Patient/caregiver will demonstrate adaptive techniques/equipment use.'],
    ]),
  },
];

export function templatesForDiscipline(discipline: string): ProblemStatementTemplate[] {
  const d = discipline.toLowerCase();
  if (d === 'pt') return PROBLEM_STATEMENT_TEMPLATES.filter((t) => t.discipline === 'pt');
  if (d === 'ot') return PROBLEM_STATEMENT_TEMPLATES.filter((t) => t.discipline === 'ot');
  if (d === 'st') return PROBLEM_STATEMENT_TEMPLATES.filter((t) => t.discipline === 'st');
  return PROBLEM_STATEMENT_TEMPLATES.filter((t) => t.discipline === 'sn');
}
