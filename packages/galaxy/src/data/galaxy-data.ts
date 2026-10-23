/*
 * NI Living Galaxy — canonical content model (v2: roots, pathways, everyday experiences).
 * Single source of truth for orbits, systems, disciplines, discipline→system links,
 * root→foundation→system pathways and the "Start from what you notice" experiences.
 * Later: replace DISCIPLINES/LINKS with the practitioner directory (see CLAUDE.md §Data integration).
 */

export type OrbitId = 'o1' | 'o2' | 'o3' | 'o4';
export type CategoryId = 'medical' | 'allied' | 'nutrition' | 'integrative' | 'accredited' | 'coach';

export interface OrbitDef {
  id: OrbitId; num: number; name: string;
  /** tree-language level shown in UI: Systems | Foundations | Roots */ level: string;
  /** one-line meaning of the level, e.g. "What shapes you" */ tag: string;
  blurb: string;
  /** semi-major axis (scene units) */ a: number; /** eccentricity */ e: number;
  /** inclination, degrees */ inc: number; /** ascending node, degrees */ node: number;
  dir: 1 | -1; /** planet colours */ A: string; B: string;
  /** 0 = organ system, 1 = foundation (cross-system process), 2 = root (whole-person influence) */ kind: 0 | 1 | 2;
}
export interface SystemDef { id: string; orbit: OrbitId; name: string; desc: string }
export interface CategoryDef { label: string; short: string; color: string; role: string; scope: string }
export interface DisciplineDef {
  id: string; name: string; cat: CategoryId;
  /** register / regulator shown to users */ reg: string;
  /** overrides the category scope sentence */ scope?: string;
  /** overrides the category role sentence */ role?: string;
}
export interface DimensionDef { name: string; color: string }
/** [root id (orbit 4), foundation id (orbit 3), system id (orbit 1/2)] */
export type PathwayDef = [string, string, string];
export interface ExperienceDef {
  id: string; /** chip label */ short: string; name: string; desc: string;
  /** pathway ids "root>foundation>system"; each must exist in PATHWAYS */ paths: string[];
  /** discipline ids for "Who can help" (GP first) */ help: string[];
  /** experience-specific safety signposting (red flags, GP / NHS 111 / 999) */ care: string;
}

export const ORBITS: OrbitDef[] = [
  {"id": "o1", "num": 1, "name": "Core Regulatory Systems", "level": "Systems", "tag": "Where it shows", "blurb": "Systems that continuously regulate the internal environment.", "a": 17.5, "e": 0.07, "inc": 5, "node": 20, "dir": 1, "A": "#5A9E96", "B": "#2D6863", "kind": 0},
  {"id": "o2", "num": 2, "name": "Specialised Functional Systems", "level": "Systems", "tag": "Where it shows", "blurb": "Structure, movement, protection, reproduction and perception.", "a": 28, "e": 0.08, "inc": -8, "node": 140, "dir": -1, "A": "#7595BE", "B": "#3C5C86", "kind": 0},
  {"id": "o3", "num": 3, "name": "Cross-System Functional Networks", "level": "Foundations", "tag": "How the body works as one", "blurb": "Processes that run underneath every system, linking them together — not separate organs.", "a": 38.5, "e": 0.06, "inc": 10, "node": 250, "dir": 1, "A": "#9989C0", "B": "#5A4C82", "kind": 1},
  {"id": "o4", "num": 4, "name": "Whole-Person Influences", "level": "Roots", "tag": "What shapes you", "blurb": "Everyday influences and life history that feed — or drain — every system.", "a": 49, "e": 0.07, "inc": -15, "node": 80, "dir": -1, "A": "#8BB188", "B": "#4E7A5C", "kind": 2}
];

export const SYSTEMS: SystemDef[] = [
  {"id": "nervous", "orbit": "o1", "name": "Nervous", "desc": "Brain, spinal cord and nerves — sensing, signalling and coordinating the whole body."},
  {"id": "endocrine", "orbit": "o1", "name": "Endocrine", "desc": "Glands that release hormones as chemical messages regulating growth, energy, mood and reproduction."},
  {"id": "cardio", "orbit": "o1", "name": "Cardiovascular", "desc": "Heart and blood vessels circulating oxygen, nutrients and immune cells."},
  {"id": "respiratory", "orbit": "o1", "name": "Respiratory", "desc": "Airways and lungs exchanging oxygen and carbon dioxide; breathing also interacts with the nervous system."},
  {"id": "digestive", "orbit": "o1", "name": "Digestive", "desc": "Breaks down food, absorbs nutrients and hosts the gut microbiome."},
  {"id": "immune", "orbit": "o1", "name": "Immune & Lymphatic", "desc": "Defends against infection, clears damaged cells and returns tissue fluid to circulation."},
  {"id": "renal", "orbit": "o1", "name": "Urinary / Renal", "desc": "Kidneys and urinary tract filter the blood and balance fluids, salts and acidity."},
  {"id": "muscular", "orbit": "o2", "name": "Muscular", "desc": "Muscles create movement and posture, and are a major site of energy use."},
  {"id": "skeletal", "orbit": "o2", "name": "Skeletal", "desc": "Bones and joints give structure, protect organs, store minerals and house bone marrow."},
  {"id": "skin", "orbit": "o2", "name": "Integumentary / Skin", "desc": "Skin, hair and nails form a barrier, help regulate temperature and sense the environment."},
  {"id": "reproductive", "orbit": "o2", "name": "Reproductive", "desc": "Reproductive organs and hormones supporting fertility, sexual health and life-stage transitions."},
  {"id": "sensory", "orbit": "o2", "name": "Sensory", "desc": "Sight, hearing, balance, smell, taste and touch connect us with the world."},
  {"id": "metabolism", "orbit": "o3", "name": "Metabolism & Energy", "desc": "How the body turns food into energy and building blocks — across liver, muscle, fat tissue and more."},
  {"id": "biotrans", "orbit": "o3", "name": "Biotransformation & Elimination", "desc": "How the liver, kidneys, gut, lungs and skin process and remove substances."},
  {"id": "gutbrain", "orbit": "o3", "name": "Gut–Brain Communication", "desc": "Two-way signalling between gut and brain through nerves, hormones, immune messengers and microbes."},
  {"id": "inflammation", "orbit": "o3", "name": "Inflammation & Tissue Repair", "desc": "The body’s protective response to injury or infection, and the processes that resolve and repair it."},
  {"id": "hormonal", "orbit": "o3", "name": "Hormonal Integration", "desc": "How signals from different glands interact and are coordinated with one another."},
  {"id": "circadian", "orbit": "o3", "name": "Circadian Regulation", "desc": "Roughly 24-hour internal rhythms that time sleep, hormones, digestion and alertness."},
  {"id": "nutrition", "orbit": "o4", "name": "Nutrition", "desc": "What and how we eat and drink, and how well it suits individual needs."},
  {"id": "movement", "orbit": "o4", "name": "Movement", "desc": "Physical activity, strength, mobility and time spent sitting."},
  {"id": "sleep", "orbit": "o4", "name": "Sleep", "desc": "Sleep duration, quality and regularity."},
  {"id": "stress", "orbit": "o4", "name": "Stress & Resilience", "desc": "How we experience and recover from pressure, and the resources that support us."},
  {"id": "environment", "orbit": "o4", "name": "Environment & Exposures", "desc": "Home, work and natural surroundings — air, light, noise and green space — and the pollutants, chemicals and microbes we meet."},
  {"id": "lifestyle", "orbit": "o4", "name": "Lifestyle & Behaviour", "desc": "Daily habits and routines — such as alcohol, smoking, screens and work patterns — and the choices that shape them over time."},
  {"id": "connection", "orbit": "o4", "name": "Connection & Relationships", "desc": "Family, friendship, community and belonging — and the support we can draw on."},
  {"id": "lifeexp", "orbit": "o4", "name": "Life Experiences", "desc": "What we have lived through. Major events, losses and long stretches of pressure can leave a lasting imprint on body and mind."}
];

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  "medical": {
    "label": "Medical specialist",
    "short": "Medical",
    "color": "#3E4A43",
    "role": "Assesses, diagnoses and treats within specialty",
    "scope": "Registered medical doctor. Can assess, diagnose and treat within their specialty, and refer on where needed."
  },
  "allied": {
    "label": "Regulated & allied health professional",
    "short": "Regulated & allied",
    "color": "#B08A4E",
    "role": "Assesses and treats within scope",
    "scope": "Statutorily regulated health professional. Assesses and treats within their professional scope of practice."
  },
  "nutrition": {
    "label": "Nutrition professional",
    "short": "Nutrition",
    "color": "#4E7A5C",
    "role": "Supportive care within scope",
    "scope": "Nutrition professional providing evidence-informed guidance within their training. Works alongside, not instead of, medical care."
  },
  "integrative": {
    "label": "Naturopathic & functional practitioner",
    "short": "Naturopathic & functional",
    "color": "#6F5E9E",
    "role": "Supportive care within scope",
    "scope": "Whole-person, lifestyle-focused support within their training and any underlying registration. Refers on for medical assessment."
  },
  "accredited": {
    "label": "Accredited practitioner",
    "short": "Accredited",
    "color": "#2F7F86",
    "role": "Supportive care within scope",
    "scope": "Practitioner on a professional register accredited by the Professional Standards Authority. Works within their accredited scope."
  },
  "coach": {
    "label": "Coach · non-clinical",
    "short": "Coaching",
    "color": "#7A5A2A",
    "role": "Habit, goal and lifestyle support",
    "scope": "Supports goals, motivation and habit change. Does not diagnose, treat or prescribe, and refers on when clinical input is needed."
  }
};

/** 45 canonical disciplines. Moons reference these by id — never duplicate a discipline per system. */
export const DISCIPLINES: DisciplineDef[] = [
  {"id": "gp", "name": "General Practitioner", "cat": "medical", "reg": "GMC", "scope": "First point of medical contact. Assesses, diagnoses, treats and refers across the whole body."},
  {"id": "neuro", "name": "Neurologist", "cat": "medical", "reg": "GMC"},
  {"id": "psychiatrist", "name": "Psychiatrist", "cat": "medical", "reg": "GMC"},
  {"id": "endo", "name": "Endocrinologist", "cat": "medical", "reg": "GMC"},
  {"id": "cardiologist", "name": "Cardiologist", "cat": "medical", "reg": "GMC"},
  {"id": "respphys", "name": "Respiratory physician", "cat": "medical", "reg": "GMC"},
  {"id": "gastro", "name": "Gastroenterologist", "cat": "medical", "reg": "GMC"},
  {"id": "immuno", "name": "Clinical immunologist & allergist", "cat": "medical", "reg": "GMC"},
  {"id": "nephro", "name": "Nephrologist", "cat": "medical", "reg": "GMC"},
  {"id": "uro", "name": "Urologist", "cat": "medical", "reg": "GMC"},
  {"id": "rheum", "name": "Rheumatologist", "cat": "medical", "reg": "GMC"},
  {"id": "ortho", "name": "Orthopaedic surgeon", "cat": "medical", "reg": "GMC"},
  {"id": "derm", "name": "Dermatologist", "cat": "medical", "reg": "GMC"},
  {"id": "obgyn", "name": "Obstetrician & gynaecologist", "cat": "medical", "reg": "GMC"},
  {"id": "ophth", "name": "Ophthalmologist", "cat": "medical", "reg": "GMC"},
  {"id": "ent", "name": "ENT surgeon", "cat": "medical", "reg": "GMC"},
  {"id": "sem", "name": "Sport & exercise medicine physician", "cat": "medical", "reg": "GMC"},
  {"id": "integrativedr", "name": "Integrative medicine doctor", "cat": "medical", "reg": "GMC", "scope": "Registered medical doctor with additional integrative training. Scope is that of their medical specialty."},
  {"id": "physio", "name": "Physiotherapist", "cat": "allied", "reg": "HCPC"},
  {"id": "dietitian", "name": "Dietitian", "cat": "allied", "reg": "HCPC", "scope": "Statutorily regulated. Assesses and treats diet-related medical conditions, including in clinical settings."},
  {"id": "psychologist", "name": "Practitioner psychologist", "cat": "allied", "reg": "HCPC"},
  {"id": "ot", "name": "Occupational therapist", "cat": "allied", "reg": "HCPC"},
  {"id": "podiatrist", "name": "Podiatrist", "cat": "allied", "reg": "HCPC"},
  {"id": "slt", "name": "Speech & language therapist", "cat": "allied", "reg": "HCPC"},
  {"id": "audiologist", "name": "Audiologist", "cat": "allied", "reg": "HCPC / RCCP"},
  {"id": "optometrist", "name": "Optometrist", "cat": "allied", "reg": "GOC"},
  {"id": "pharmacist", "name": "Pharmacist", "cat": "allied", "reg": "GPhC", "scope": "Statutorily regulated medicines expert. Advises on medicines and, if qualified as an independent prescriber, can prescribe within scope.", "role": "Medicines advice within scope"},
  {"id": "nurse", "name": "Specialist nurse", "cat": "allied", "reg": "NMC", "scope": "Registered nurse with specialist training (for example diabetes, continence or respiratory). Works within their area of practice."},
  {"id": "midwife", "name": "Midwife", "cat": "allied", "reg": "NMC"},
  {"id": "osteopath", "name": "Osteopath", "cat": "allied", "reg": "GOsC"},
  {"id": "chiro", "name": "Chiropractor", "cat": "allied", "reg": "GCC"},
  {"id": "nutritionist", "name": "Registered nutritionist", "cat": "nutrition", "reg": "AfN · UKVRN", "scope": "Provides evidence-based nutrition information and guidance for health and wellbeing."},
  {"id": "ntherapist", "name": "Nutritional therapist", "cat": "nutrition", "reg": "BANT / CNHC", "scope": "Personalised nutrition and lifestyle support. Works alongside, not instead of, medical care."},
  {"id": "naturopath", "name": "Naturopathic practitioner", "cat": "integrative", "reg": "Voluntary register (e.g. CNHC)", "scope": "Whole-person, natural-therapy and lifestyle support within their training. Not statutorily regulated; refers on for medical assessment."},
  {"id": "fm", "name": "Functional medicine practitioner", "cat": "integrative", "reg": "Depends on underlying registration", "scope": "Not a protected title. What they can do depends entirely on their underlying professional registration and training."},
  {"id": "counsellor", "name": "Counsellor / psychotherapist", "cat": "accredited", "reg": "BACP / UKCP (PSA accredited)"},
  {"id": "cep", "name": "Clinical exercise physiologist", "cat": "accredited", "reg": "RCCP (PSA accredited)", "scope": "Designs and supervises exercise programmes for people living with long-term conditions, within scope."},
  {"id": "sleepphys", "name": "Sleep & respiratory physiologist", "cat": "accredited", "reg": "RCCP (PSA accredited)", "scope": "Carries out and interprets sleep and breathing studies within a clinical team."},
  {"id": "healthcoach", "name": "Health & wellbeing coach", "cat": "coach", "reg": "Professional membership (e.g. UKHCA) — not a clinical register"},
  {"id": "lifestylecoach", "name": "Lifestyle coach", "cat": "coach", "reg": "Not a clinical register"},
  {"id": "nutritioncoach", "name": "Nutrition coach", "cat": "coach", "reg": "Not a clinical register"},
  {"id": "movementcoach", "name": "Movement & exercise coach", "cat": "coach", "reg": "CIMSPA-recognised training — not a clinical register"},
  {"id": "sleepcoach", "name": "Sleep coach", "cat": "coach", "reg": "Not a clinical register"},
  {"id": "stresscoach", "name": "Stress & resilience coach", "cat": "coach", "reg": "Not a clinical register"},
  {"id": "behaviourcoach", "name": "Behaviour change coach", "cat": "coach", "reg": "Not a clinical register"}
];

/** system id → discipline ids, in display order (first = most direct). */
export const LINKS: Record<string, string[]> = {
  nervous: ["neuro", "gp", "physio", "ot", "psychologist", "slt"],
  endocrine: ["endo", "gp", "nurse", "dietitian", "ntherapist"],
  cardio: ["cardiologist", "gp", "nurse", "cep", "dietitian", "healthcoach"],
  respiratory: ["respphys", "gp", "physio", "nurse", "sleepphys", "pharmacist"],
  digestive: ["gastro", "gp", "dietitian", "nutritionist", "ntherapist", "naturopath", "fm"],
  immune: ["immuno", "gp", "rheum", "pharmacist", "dietitian"],
  renal: ["nephro", "uro", "gp", "nurse", "dietitian"],
  muscular: ["sem", "physio", "rheum", "cep", "osteopath", "movementcoach"],
  skeletal: ["ortho", "rheum", "physio", "osteopath", "chiro", "podiatrist"],
  skin: ["derm", "gp", "nurse", "pharmacist", "ntherapist"],
  reproductive: ["obgyn", "uro", "gp", "midwife", "nurse", "ntherapist"],
  sensory: ["ophth", "optometrist", "ent", "audiologist", "neuro", "ot"],
  metabolism: ["endo", "dietitian", "nutritionist", "ntherapist", "fm", "cep", "healthcoach"],
  biotrans: ["gastro", "nephro", "pharmacist", "gp", "naturopath", "ntherapist"],
  gutbrain: ["gastro", "psychiatrist", "psychologist", "dietitian", "ntherapist", "fm"],
  inflammation: ["rheum", "immuno", "derm", "gp", "physio", "dietitian", "integrativedr"],
  hormonal: ["endo", "obgyn", "gp", "nurse", "ntherapist", "integrativedr", "fm"],
  circadian: ["sleepphys", "respphys", "psychologist", "gp", "sleepcoach"],
  nutrition: ["dietitian", "nutritionist", "ntherapist", "naturopath", "nutritioncoach", "healthcoach"],
  movement: ["physio", "cep", "sem", "ot", "movementcoach"],
  sleep: ["sleepphys", "psychologist", "gp", "sleepcoach", "healthcoach"],
  stress: ["psychologist", "counsellor", "psychiatrist", "gp", "stresscoach", "healthcoach"],
  environment: ["gp", "immuno", "ot", "naturopath", "lifestylecoach"],
  lifestyle: ["healthcoach", "lifestylecoach", "behaviourcoach", "psychologist", "gp"],
  connection: ["psychologist", "counsellor", "gp", "lifestylecoach", "healthcoach"],
  lifeexp: ["psychologist", "counsellor", "psychiatrist", "gp", "stresscoach"]
};

export const DIMENSIONS: DimensionDef[] = [
  {"name": "Physical", "color": "#7C6F58"},
  {"name": "Mental", "color": "#3F7F77"},
  {"name": "Emotional", "color": "#A0685C"},
  {"name": "Social", "color": "#8A6A35"},
  {"name": "Spiritual", "color": "#6E5E9C"},
  {"name": "Environmental", "color": "#8BB188"}
];

/**
 * Roots → foundations → systems. Educational associations showing how everyday influences can reach
 * the body. Not causes, not a diagnosis. Drawn as glowing threads in the galaxy.
 */
export const PATHWAYS: PathwayDef[] = [
  ["nutrition", "metabolism", "endocrine"],
  ["nutrition", "gutbrain", "digestive"],
  ["nutrition", "inflammation", "immune"],
  ["nutrition", "biotrans", "digestive"],
  ["movement", "metabolism", "muscular"],
  ["movement", "metabolism", "cardio"],
  ["movement", "inflammation", "skeletal"],
  ["sleep", "circadian", "endocrine"],
  ["sleep", "circadian", "nervous"],
  ["sleep", "inflammation", "immune"],
  ["stress", "hormonal", "endocrine"],
  ["stress", "hormonal", "cardio"],
  ["stress", "hormonal", "nervous"],
  ["stress", "gutbrain", "digestive"],
  ["stress", "inflammation", "skin"],
  ["environment", "circadian", "nervous"],
  ["environment", "inflammation", "respiratory"],
  ["environment", "inflammation", "skin"],
  ["environment", "biotrans", "renal"],
  ["lifestyle", "metabolism", "cardio"],
  ["lifestyle", "circadian", "endocrine"],
  ["lifestyle", "biotrans", "digestive"],
  ["connection", "hormonal", "nervous"],
  ["connection", "hormonal", "cardio"],
  ["connection", "inflammation", "immune"],
  ["lifeexp", "hormonal", "endocrine"],
  ["lifeexp", "gutbrain", "digestive"],
  ["lifeexp", "inflammation", "immune"]
];

/**
 * The leaves: everyday experiences, traced back to their roots ("Start from what you notice").
 * General public education only — never about an individual, never ranked, no "you may have".
 */
export const EXPERIENCES: ExperienceDef[] = [
  {"id": "tired", "short": "Tiredness", "name": "Tiredness & low energy", "desc": "Feeling drained, even after rest. Energy depends on how we sleep, eat, move and recover — and on how metabolism and hormones keep pace.", "paths": ["sleep>circadian>endocrine", "nutrition>metabolism>endocrine", "stress>hormonal>endocrine", "movement>metabolism>muscular", "lifestyle>circadian>endocrine"], "help": ["gp", "dietitian", "ntherapist", "sleepcoach", "healthcoach"], "care": "See your GP if tiredness lasts more than a few weeks, comes on suddenly, or comes with weight loss, breathlessness or heavy periods."},
  {"id": "bloating", "short": "Bloating", "name": "Bloating & digestive discomfort", "desc": "Fullness, wind or an unsettled gut. Digestion responds to what and how we eat — and to stress, through the conversation between gut and brain.", "paths": ["nutrition>gutbrain>digestive", "stress>gutbrain>digestive", "nutrition>biotrans>digestive", "lifeexp>gutbrain>digestive"], "help": ["gp", "gastro", "dietitian", "ntherapist", "naturopath"], "care": "See your GP promptly for bloating that keeps coming back, a change in bowel habit, blood in your stool, unexplained weight loss or difficulty swallowing."},
  {"id": "sleep", "short": "Poor sleep", "name": "Poor sleep", "desc": "Trouble falling or staying asleep, or waking unrefreshed. The body clock is set by light, routine and stress as much as by bedtime.", "paths": ["environment>circadian>nervous", "sleep>circadian>nervous", "stress>hormonal>endocrine", "lifestyle>circadian>endocrine"], "help": ["gp", "sleepphys", "psychologist", "sleepcoach"], "care": "See your GP if poor sleep lasts for months, or if you snore loudly, stop breathing in your sleep or feel very sleepy during the day."},
  {"id": "mood", "short": "Low mood", "name": "Low mood", "desc": "Feeling flat, low or not yourself. Mood is shaped by sleep, connection and what we have lived through — and by the conversation between gut and brain.", "paths": ["sleep>circadian>nervous", "connection>hormonal>nervous", "stress>hormonal>nervous", "lifeexp>hormonal>endocrine", "nutrition>gutbrain>digestive"], "help": ["gp", "psychologist", "counsellor", "psychiatrist"], "care": "If low mood lasts more than two weeks, talk to your GP. If you feel unable to keep yourself safe, call 999, NHS 111 (choose the mental health option) or Samaritans on 116 123."},
  {"id": "fog", "short": "Brain fog", "name": "Brain fog", "desc": "Finding it hard to focus, remember or think clearly. Clear thinking draws on sleep, steady energy and how the body handles stress.", "paths": ["sleep>circadian>nervous", "nutrition>metabolism>endocrine", "stress>hormonal>nervous", "sleep>inflammation>immune"], "help": ["gp", "ntherapist", "dietitian", "psychologist", "sleepcoach"], "care": "See your GP if brain fog is new or getting worse. Call 999 for sudden confusion, slurred speech, or weakness on one side of the body."},
  {"id": "aches", "short": "Aches & stiffness", "name": "Aches & stiffness", "desc": "Sore muscles, stiff joints or a body that feels tight. Movement, recovery, sleep and inflammation all play a part.", "paths": ["movement>inflammation>skeletal", "movement>metabolism>muscular", "sleep>inflammation>immune", "nutrition>inflammation>immune"], "help": ["gp", "physio", "rheum", "osteopath", "movementcoach"], "care": "See your GP for swollen joints, morning stiffness that lasts more than 30 minutes, or pain that wakes you at night or follows an injury."},
  {"id": "skin", "short": "Skin flare-ups", "name": "Skin flare-ups", "desc": "Itching, redness, dryness or breakouts. Skin is our boundary with the world around us, and often reflects stress and inflammation inside.", "paths": ["environment>inflammation>skin", "stress>inflammation>skin", "nutrition>inflammation>immune", "nutrition>gutbrain>digestive"], "help": ["gp", "derm", "pharmacist", "ntherapist", "dietitian"], "care": "Get urgent help for a rash that does not fade when a glass is pressed on it, or swelling of the face or lips. See your GP for a mole that changes or a rash that will not settle."},
  {"id": "stressed", "short": "Feeling stressed", "name": "Feeling stressed or on edge", "desc": "Tense, wired or overwhelmed. The stress response is a whole-body signal — it reaches the heart, hormones, sleep and digestion.", "paths": ["stress>hormonal>endocrine", "stress>hormonal>cardio", "connection>hormonal>nervous", "lifeexp>hormonal>endocrine", "sleep>circadian>nervous"], "help": ["gp", "psychologist", "counsellor", "stresscoach"], "care": "Talk to your GP if stress or anxiety is affecting daily life. If you feel unable to cope or unsafe, call NHS 111 (choose the mental health option) or Samaritans on 116 123."}
];

/** Rotating centre phrases (5.2 s cycle, 1.1 s crossfade). First one is the static/reduced-motion label. */
export const PHRASES: string[] = ["Uniquely You", "One of a Kind", "Beautifully Different", "Nobody Quite Like You", "Made to Be You", "Wonderfully Individual", "Created Like No Other"];

/* ---------------- runtime graph (shape consumed by NIGalaxy) ---------------- */
export interface GalaxyPath { id: string; i: number; root: string; proc: string; sys: string }
export interface GalaxyNode { id: string; orbit: any; name: string; desc: string; idx: number; k: number; links: GalaxyDiscipline[]; paths: GalaxyPath[] }
export interface GalaxyDiscipline { id: string; name: string; cat: CategoryId; reg: string; scope: string; role: string; coach: boolean; systems: string[] }
export interface GalaxyExperience {
  id: string; short: string; name: string; desc: string; care: string; paths: GalaxyPath[]; help: GalaxyDiscipline[];
  systems: string[]; procs: string[]; roots: string[]; nodes: string[];
}
export interface GalaxyData {
  ORBITS: (OrbitDef & { nodes: GalaxyNode[] })[];
  nodes: GalaxyNode[]; nodeById: Record<string, GalaxyNode>;
  CATS: Record<CategoryId, CategoryDef>;
  discs: GalaxyDiscipline[]; discById: Record<string, GalaxyDiscipline>;
  /** [name, colour] tuples */ DIMS: [string, string][];
  paths: GalaxyPath[]; pathById: Record<string, GalaxyPath>;
  exps: GalaxyExperience[]; expById: Record<string, GalaxyExperience>;
}

export function buildGalaxyData(): GalaxyData {
  const ORB = ORBITS.map((o) => ({ ...o, nodes: [] as GalaxyNode[] }));
  const orbitById: Record<string, any> = {};
  ORB.forEach((o) => { orbitById[o.id] = o; });
  const nodes: GalaxyNode[] = SYSTEMS.map((n, i) => {
    const o = orbitById[n.orbit];
    const nd: GalaxyNode = { id: n.id, orbit: o, name: n.name, desc: n.desc, idx: i, k: o.nodes.length, links: [], paths: [] };
    o.nodes.push(nd);
    return nd;
  });
  const nodeById: Record<string, GalaxyNode> = {};
  nodes.forEach((n) => { nodeById[n.id] = n; });
  const discs: GalaxyDiscipline[] = DISCIPLINES.map((d) => {
    const c = CATEGORIES[d.cat];
    return { id: d.id, name: d.name, cat: d.cat, reg: d.reg, scope: d.scope || c.scope, role: d.role || c.role, coach: d.cat === 'coach', systems: [] };
  });
  const discById: Record<string, GalaxyDiscipline> = {};
  discs.forEach((d) => { discById[d.id] = d; });
  nodes.forEach((n) => {
    n.links = (LINKS[n.id] || []).map((id) => {
      const d = discById[id];
      if (!d) throw new Error('galaxy-data: unknown discipline ' + id + ' linked from ' + n.id);
      d.systems.push(n.id);
      return d;
    });
  });
  const paths: GalaxyPath[] = PATHWAYS.map((q, i) => ({ id: q.join('>'), i, root: q[0], proc: q[1], sys: q[2] }));
  const pathById: Record<string, GalaxyPath> = {};
  paths.forEach((q) => { pathById[q.id] = q; });
  nodes.forEach((n) => { n.paths = paths.filter((q) => q.root === n.id || q.proc === n.id || q.sys === n.id); });
  const uniq = (arr: string[]) => arr.filter((v, i) => arr.indexOf(v) === i);
  const exps: GalaxyExperience[] = EXPERIENCES.map((x) => {
    const ps = x.paths.map((id) => {
      const q = pathById[id];
      if (!q) throw new Error('galaxy-data: unknown pathway ' + id + ' in experience ' + x.id);
      return q;
    });
    const systems = uniq(ps.map((q) => q.sys)), procs = uniq(ps.map((q) => q.proc)), roots = uniq(ps.map((q) => q.root));
    return { id: x.id, short: x.short, name: x.name, desc: x.desc, care: x.care, paths: ps,
      help: x.help.map((id) => { const d = discById[id]; if (!d) throw new Error('galaxy-data: unknown discipline ' + id + ' in experience ' + x.id); return d; }),
      systems, procs, roots, nodes: systems.concat(procs, roots) };
  });
  const expById: Record<string, GalaxyExperience> = {};
  exps.forEach((x) => { expById[x.id] = x; });
  return { ORBITS: ORB, nodes, nodeById, CATS: { ...CATEGORIES }, discs, discById,
    DIMS: DIMENSIONS.map((d) => [d.name, d.color] as [string, string]), paths, pathById, exps, expById };
}
