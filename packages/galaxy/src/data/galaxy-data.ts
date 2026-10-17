/*
 * NI Living Galaxy — canonical content model.
 * Single source of truth for orbits, systems, disciplines and the discipline→system links.
 * CLINICAL SIGN-OFF REQUIRED before production: the LINKS table and every scope/role sentence.
 * Later: replace DISCIPLINES/LINKS with the practitioner directory (see CLAUDE.md §Data integration).
 */

export type OrbitId = 'o1' | 'o2' | 'o3' | 'o4';
export type CategoryId = 'medical' | 'allied' | 'nutrition' | 'integrative' | 'accredited' | 'coach';

export interface OrbitDef {
  id: OrbitId; num: number; name: string; blurb: string;
  /** semi-major axis (scene units) */ a: number; /** eccentricity */ e: number;
  /** inclination, degrees */ inc: number; /** ascending node, degrees */ node: number;
  dir: 1 | -1; /** planet colours */ A: string; B: string;
  /** 0 = organ system, 1 = cross-system network, 2 = whole-person influence */ kind: 0 | 1 | 2;
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

export const ORBITS: OrbitDef[] = [
  {"id": "o1", "num": 1, "name": "Core Regulatory Systems", "blurb": "Systems that continuously regulate the internal environment.", "a": 17.5, "e": 0.07, "inc": 5, "node": 20, "dir": 1, "A": "#5A9E96", "B": "#2D6863", "kind": 0},
  {"id": "o2", "num": 2, "name": "Specialised Functional Systems", "blurb": "Structure, movement, protection, reproduction and perception.", "a": 28, "e": 0.08, "inc": -8, "node": 140, "dir": -1, "A": "#7595BE", "B": "#3C5C86", "kind": 0},
  {"id": "o3", "num": 3, "name": "Cross-System Functional Networks", "blurb": "Processes that run across several systems — not separate organs.", "a": 38.5, "e": 0.06, "inc": 10, "node": 250, "dir": 1, "A": "#9989C0", "B": "#5A4C82", "kind": 1},
  {"id": "o4", "num": 4, "name": "Whole-Person Influences", "blurb": "Everyday factors that shape how every system functions.", "a": 49, "e": 0.07, "inc": -15, "node": 80, "dir": -1, "A": "#8BB188", "B": "#4E7A5C", "kind": 2}
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
  {"id": "environment", "orbit": "o4", "name": "Environment", "desc": "Home, work and natural surroundings — air, light, noise, green space and exposures."},
  {"id": "lifestyle", "orbit": "o4", "name": "Lifestyle & Behaviour", "desc": "Daily habits, routines and relationships, and the choices that shape them over time."}
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
  environment: ["gp", "ot", "naturopath", "lifestylecoach"],
  lifestyle: ["healthcoach", "lifestylecoach", "behaviourcoach", "psychologist", "gp"]
};

export const DIMENSIONS: DimensionDef[] = [
  {"name": "Physical", "color": "#7C6F58"},
  {"name": "Mental", "color": "#3F7F77"},
  {"name": "Emotional", "color": "#A0685C"},
  {"name": "Social", "color": "#8A6A35"},
  {"name": "Spiritual", "color": "#6E5E9C"},
  {"name": "Environmental", "color": "#8BB188"}
];

/** Rotating centre phrases (5.2 s cycle, 1.1 s crossfade). First one is the static/reduced-motion label. */
export const PHRASES: string[] = ["Uniquely You", "One of a Kind", "Beautifully Different", "Nobody Quite Like You", "Made to Be You", "Wonderfully Individual", "Created Like No Other"];

/* ---------------- runtime graph (shape consumed by NIGalaxy) ---------------- */
export interface GalaxyNode { id: string; orbit: any; name: string; desc: string; idx: number; k: number; links: GalaxyDiscipline[] }
export interface GalaxyDiscipline { id: string; name: string; cat: CategoryId; reg: string; scope: string; role: string; coach: boolean; systems: string[] }
export interface GalaxyData {
  ORBITS: (OrbitDef & { nodes: GalaxyNode[] })[];
  nodes: GalaxyNode[]; nodeById: Record<string, GalaxyNode>;
  CATS: Record<CategoryId, CategoryDef>;
  discs: GalaxyDiscipline[]; discById: Record<string, GalaxyDiscipline>;
  /** [name, colour] tuples */ DIMS: [string, string][];
}

export function buildGalaxyData(): GalaxyData {
  const ORB = ORBITS.map((o) => ({ ...o, nodes: [] as GalaxyNode[] }));
  const orbitById: Record<string, any> = {};
  ORB.forEach((o) => { orbitById[o.id] = o; });
  const nodes: GalaxyNode[] = SYSTEMS.map((n, i) => {
    const o = orbitById[n.orbit];
    const nd: GalaxyNode = { id: n.id, orbit: o, name: n.name, desc: n.desc, idx: i, k: o.nodes.length, links: [] };
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
  return { ORBITS: ORB, nodes, nodeById, CATS: { ...CATEGORIES }, discs, discById, DIMS: DIMENSIONS.map((d) => [d.name, d.color] as [string, string]) };
}
