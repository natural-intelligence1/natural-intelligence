# Intake V2 — Complete Question-Wording Review Pack

STATUS:
SOLICITOR WORDING REVIEW REQUIRED

ARCHITECTURE:
LEGAL SECOND PASS — GREEN

PURPOSE:
Review individual question wording only against the already-approved architecture.

Generated from the canonical question registry
(`packages/db/src/intakeV2/registry.ts`) by
`packages/db/scripts/generate-question-wording-review.ts` — wording is
verbatim, never paraphrased; absent values are marked
"— (not present in canonical source)". No client answers (synthetic or otherwise) appear
and no legal conclusions are drawn.

Total user-facing questions: **115**

## Chapter: Arriving (`arrival`)
Chapter intro shown to the client: "A gentle start — there are no wrong answers here."

### `v2.arrival.feeling` (v1)

- **Client-facing wording (verbatim):** How are you feeling about your health, arriving here today?
- **Screen:** 1 · **Domain/section:** Arriving
- **Answer type:** multichip
- **Help text:** Choose anything that fits, or say it in your own way below.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Capture the client’s presenting concerns factually, in their own words, for their practitioner.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Hopeful · Tired of not knowing · Worried · Curious · Frustrated · Ready for a change · Overwhelmed · Calm
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.arrival.feeling_words` (v1)

- **Client-facing wording (verbatim):** Anything you want to add in your own words?
- **Screen:** 1 · **Domain/section:** Arriving
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Capture the client’s presenting concerns factually, in their own words, for their practitioner.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: About you (`about`)

### `v2.about.full_name` (v1)

- **Client-facing wording (verbatim):** Your full name
- **Screen:** 1 · **Domain/section:** About you
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** yes · **Skippable:** no
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.preferred_name` (v1)

- **Client-facing wording (verbatim):** What should we call you?
- **Screen:** 1 · **Domain/section:** About you
- **Answer type:** text
- **Help text:** The name you like to be addressed by.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.dob` (v1)

- **Client-facing wording (verbatim):** Your date of birth
- **Screen:** 2 · **Domain/section:** About you
- **Answer type:** date
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** yes · **Skippable:** no
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.pathway` (v1)

- **Client-facing wording (verbatim):** Which best describes you, for the health questions that differ by body?
- **Screen:** 2 · **Domain/section:** About you
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Some questions — cycles, pregnancies, prostate — only make sense for some bodies. This routes you past the ones that don’t apply.
- **Required:** yes · **Skippable:** no
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Female health questions apply to me · Male health questions apply to me · Prefer to discuss with a practitioner · Prefer not to say
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.address` (v1)

- **Client-facing wording (verbatim):** Your address
- **Screen:** 3 · **Domain/section:** About you
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.phone` (v1)

- **Client-facing wording (verbatim):** Phone number
- **Screen:** 3 · **Domain/section:** About you
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.relationship` (v1)

- **Client-facing wording (verbatim):** Relationship situation
- **Screen:** 4 · **Domain/section:** About you
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Single · In a relationship · Married / civil partnership · Separated or divorced · Widowed · Prefer not to say
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.children` (v1)

- **Client-facing wording (verbatim):** Children, and their ages (if any)
- **Screen:** 4 · **Domain/section:** About you
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.occupation` (v1)

- **Client-facing wording (verbatim):** What do you do for work?
- **Screen:** 5 · **Domain/section:** About you
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.work_pattern` (v1)

- **Client-facing wording (verbatim):** Your working pattern
- **Screen:** 5 · **Domain/section:** About you
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Daytime hours · Shifts including nights · Part-time · Not currently working · Retired · Student · Other
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.height` (v1)

- **Client-facing wording (verbatim):** Height (however you know it)
- **Screen:** 6 · **Domain/section:** About you
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.weight` (v1)

- **Client-facing wording (verbatim):** Weight (however you know it)
- **Screen:** 6 · **Domain/section:** About you
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.about.how_found` (v1)

- **Client-facing wording (verbatim):** How did you come to Natural Intelligence?
- **Screen:** 6 · **Domain/section:** About you
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** A friend or family member · A practitioner · A workshop or event · Searching online · Social media · Other
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Care already in place (`care_in_place`)

### `v2.care.gp_name` (v1)

- **Client-facing wording (verbatim):** Your GP’s name (if you have one)
- **Screen:** 1 · **Domain/section:** Care already in place
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.care.gp_practice` (v1)

- **Client-facing wording (verbatim):** GP practice name
- **Screen:** 1 · **Domain/section:** Care already in place
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.care.gp_address` (v1)

- **Client-facing wording (verbatim):** GP practice address
- **Screen:** 1 · **Domain/section:** Care already in place
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.care.gp_phone` (v1)

- **Client-facing wording (verbatim):** GP practice phone number
- **Screen:** 1 · **Domain/section:** Care already in place
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.care.gp_contact_permission` (v1)

- **Client-facing wording (verbatim):** May Natural Intelligence contact your GP if a practitioner believes it would help your care?
- **Screen:** 2 · **Domain/section:** Care already in place
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** This is its own separate permission — nothing is sent to your GP without it, and you can change it at any time in Privacy & Data Controls.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Yes, you may contact my GP · No, not at the moment · Ask me first each time
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.care.specialists` (v1)

- **Client-facing wording (verbatim):** Any consultants or specialists you see, or have seen recently
- **Screen:** 3 · **Domain/section:** Care already in place
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.care.other_practitioners` (v1)

- **Client-facing wording (verbatim):** Any other practitioners you currently see — conventional or complementary
- **Screen:** 3 · **Domain/section:** Care already in place
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.care.awaiting` (v1)

- **Client-facing wording (verbatim):** Are you waiting for any investigations, results or appointments?
- **Screen:** 3 · **Domain/section:** Care already in place
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Yes · No · Not sure
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.care.awaiting_detail` (v1)

- **Client-facing wording (verbatim):** If yes — what are you waiting for?
- **Screen:** 3 · **Domain/section:** Care already in place
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Question shown only when `v2.care.awaiting` = Yes
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record the care the client already has so NI care fits around it (GP, specialists, pending items).
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: What brings you here (`concerns`)
Chapter intro shown to the client: "Your own words first. Lists come later."

### `v2.concerns.own_words` (v1)

- **Client-facing wording (verbatim):** In your own words, what would you most like help to understand or improve?
- **Screen:** 1 · **Domain/section:** What brings you here
- **Answer type:** textarea
- **Help text:** Take your time. This is the most important answer in the whole intake.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** yes · **Skippable:** no
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Capture the client’s presenting concerns factually, in their own words, for their practitioner.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.concerns.list` (v1)

- **Client-facing wording (verbatim):** If it helps, break that into separate concerns
- **Screen:** 2 · **Domain/section:** What brings you here
- **Answer type:** repeatable
- **Help text:** Add up to five. A practitioner will go through each one with you properly — you don’t need to cover everything here.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Capture the client’s presenting concerns factually, in their own words, for their practitioner.
- **safety_capture status:** not a safety-capture question
- **Card fields (verbatim labels):** The concern, in a few of your own words · Roughly how long it has been going on · Is it changing? · What you have already tried · What would a good outcome look like for you?
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.concerns.anything_else` (v1)

- **Client-facing wording (verbatim):** Is there anything else you want us to know before we go on?
- **Screen:** 3 · **Domain/section:** What brings you here
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Capture the client’s presenting concerns factually, in their own words, for their practitioner.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Your medical history (`medical_history`)

### `v2.history.diagnosed` (v1)

- **Client-facing wording (verbatim):** Conditions a doctor has formally told you that you have
- **Screen:** 1 · **Domain/section:** Your medical history
- **Answer type:** repeatable
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record diagnoses, investigations and referrals exactly as reported and attributed by the client.
- **safety_capture status:** not a safety-capture question
- **Card fields (verbatim labels):** Condition · Roughly when (year is fine)
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.history.significant_illness` (v1)

- **Client-facing wording (verbatim):** Significant illnesses over your life, even if long past
- **Screen:** 2 · **Domain/section:** Your medical history
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record diagnoses, investigations and referrals exactly as reported and attributed by the client.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.history.admissions` (v1)

- **Client-facing wording (verbatim):** Hospital admissions, and roughly when
- **Screen:** 2 · **Domain/section:** Your medical history
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record diagnoses, investigations and referrals exactly as reported and attributed by the client.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.history.surgery` (v1)

- **Client-facing wording (verbatim):** Operations or procedures, and roughly when
- **Screen:** 2 · **Domain/section:** Your medical history
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record diagnoses, investigations and referrals exactly as reported and attributed by the client.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.history.recent_tests` (v1)

- **Client-facing wording (verbatim):** Tests or investigations in the last year or so
- **Screen:** 3 · **Domain/section:** Your medical history
- **Answer type:** textarea
- **Help text:** If you have a copy of a lab report, you can add it in BioHub — your practitioner will be able to see the organised results.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record diagnoses, investigations and referrals exactly as reported and attributed by the client.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.history.specialist_care` (v1)

- **Client-facing wording (verbatim):** Are you currently under, or waiting for, specialist care?
- **Screen:** 3 · **Domain/section:** Your medical history
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record diagnoses, investigations and referrals exactly as reported and attributed by the client.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Yes · No · Not sure
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Medication (`medication`)

### `v2.medication.items` (v1)

- **Client-facing wording (verbatim):** Medication you take, or have recently taken
- **Screen:** 1 · **Domain/section:** Medication
- **Answer type:** repeatable
- **Help text:** Include hormonal contraception, HRT, and anything you buy over the counter and take regularly. Copy amounts from the label — no need to translate them.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record medication facts exactly as written so the practitioner sees the full picture.
- **safety_capture status:** not a safety-capture question
- **Card fields (verbatim labels):** Name of the medication · What you take it for, in your words · Amount, as written on the label · How often · When you started (roughly) · Current or past? · Anything you have noticed while on it · Who prescribes or supplies it (if known)
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Supplements & natural remedies (`supplements`)

### `v2.supplements.items` (v1)

- **Client-facing wording (verbatim):** Supplements and natural remedies you take or use
- **Screen:** 1 · **Domain/section:** Supplements & natural remedies
- **Answer type:** repeatable
- **Help text:** Herbs, vitamins, minerals, powders, teas, tinctures — and anything you put on your skin for health reasons, like oils or creams.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Record supplement facts exactly as written so the practitioner sees the full picture.
- **safety_capture status:** not a safety-capture question
- **Card fields (verbatim labels):** Product name · Brand · What you take or use it for · Amount, as written on the label · How often · When you started (roughly) · Who suggested it? · Taken by mouth or applied to skin?
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Family health (`family`)

### `v2.family.members` (v1)

- **Client-facing wording (verbatim):** Health conditions in your close family, as far as you know
- **Screen:** 1 · **Domain/section:** Family health
- **Answer type:** repeatable
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Family patterns help a practitioner understand your wider picture. ‘Not sure’ is a completely fine answer.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Family health context as the client recalls it — context for the practitioner, never NI inference.
- **safety_capture status:** not a safety-capture question
- **Card fields (verbatim labels):** Family member · Anything in these areas? · Any detail you know (optional)
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Early life & past health (`early_life`)

### `v2.early.birth` (v1)

- **Client-facing wording (verbatim):** Anything you know about your birth and infancy
- **Screen:** 1 · **Domain/section:** Early life & past health
- **Answer type:** textarea
- **Help text:** Early or late, feeding as a baby, anything your family mentioned. ‘Don’t know’ is fine.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Early-life and past-health context, "if known" — part of the whole-person story.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.early.childhood_illness` (v1)

- **Client-facing wording (verbatim):** Illnesses that kept coming back in childhood, or conditions doctors named back then
- **Screen:** 1 · **Domain/section:** Early life & past health
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Early-life and past-health context, "if known" — part of the whole-person story.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.early.childhood_medication` (v1)

- **Client-facing wording (verbatim):** Medication you remember taking often as a child — antibiotics, inhalers, anything else
- **Screen:** 2 · **Domain/section:** Early life & past health
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Early-life and past-health context, "if known" — part of the whole-person story.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.early.vaccine_reactions` (v1)

- **Client-facing wording (verbatim):** Any reactions to vaccinations you or your family noticed
- **Screen:** 2 · **Domain/section:** Early life & past health
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Early-life and past-health context, "if known" — part of the whole-person story.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.early.injuries` (v1)

- **Client-facing wording (verbatim):** Significant accidents or injuries, at any age
- **Screen:** 3 · **Domain/section:** Early life & past health
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Early-life and past-health context, "if known" — part of the whole-person story.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.early.major_events` (v1)

- **Client-facing wording (verbatim):** Major health events in your adult life we haven’t covered yet
- **Screen:** 3 · **Domain/section:** Early life & past health
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Early-life and past-health context, "if known" — part of the whole-person story.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: A quick check across your body (`systems_overview`)

### `v2.systems.noticed` (v1)

- **Client-facing wording (verbatim):** Where have you noticed anything — big or small?
- **Screen:** 1 · **Domain/section:** A quick check across your body
- **Answer type:** multichip
- **Help text:** Choose any areas of your body that have been on your mind. We’ll only ask more about the areas you pick.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Digestion · Head, nerves & senses · Sleep · Mood & stress · Energy, hormones & metabolism · Immune system & allergies · Breathing, sinuses, throat & ears · Urinary · Heart & circulation · Muscles & joints · Skin, hair & nails · Reproductive health · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Digestion (`digestion`)

### `v2.digestion.noticed` (v1)

- **Client-facing wording (verbatim):** Select anything you have noticed with your digestion
- **Screen:** 1 · **Domain/section:** Digestion
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Digestion
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Blood in the stool · Black, tar-like stool · Difficulty swallowing · A change in your usual bowel habit
- **Answer options (verbatim):** Heartburn or reflux · Bad breath · Bloating · Burping · Wind · Tummy pain or cramping · Constipation · Loose stools or diarrhoea · Needing to go urgently · Going very often · Going infrequently · A change in your usual bowel habit · Mucus in the stool · Blood in the stool · Black, tar-like stool · Feeling sick · Vomiting · Reactions to particular foods · Difficulty swallowing · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.digestion.bowel_frequency` (v1)

- **Client-facing wording (verbatim):** How often do your bowels usually open?
- **Screen:** 2 · **Domain/section:** Digestion
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Digestion
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** More than three times a day · One to three times a day · Most days · Every two or three days · Less often than that
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.digestion.stool_form` (v1)

- **Client-facing wording (verbatim):** Which picture looks most like your usual stool?
- **Screen:** 2 · **Domain/section:** Digestion
- **Answer type:** stool_form
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** What leaves the body says a lot about what’s happening inside it. Practitioners find this genuinely useful.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Digestion
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Hard separate lumps · Lumpy and sausage-shaped · Sausage-shaped with surface cracks · Smooth and soft · Soft blobs · Mushy with ragged edges · Entirely liquid
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Head, nerves & senses (`nervous`)

### `v2.nervous.noticed` (v1)

- **Client-facing wording (verbatim):** Select anything you have noticed
- **Screen:** 1 · **Domain/section:** Head, nerves & senses
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Head, nerves & senses
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Fainting or blacking out · A seizure or convulsion · Sudden weakness in an arm or leg · Losing part or all of your vision
- **Answer options (verbatim):** Headaches · Migraines · Dizziness · The room spinning (vertigo) · Fainting or blacking out · A seizure or convulsion · Weakness · Sudden weakness in an arm or leg · Brain fog or memory slips · Trouble concentrating · Pins and needles · Numbness · Shaking or tremor · Ringing in the ears · Changes in your vision · Losing part or all of your vision · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Sleep (`sleep`)

### `v2.sleep.hours` (v1)

- **Client-facing wording (verbatim):** Roughly how many hours do you sleep most nights?
- **Screen:** 1 · **Domain/section:** Sleep
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Sleep
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Under 5 · 5–6 · 6–7 · 7–8 · 8–9 · More than 9 · It varies wildly
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.sleep.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed about your sleep?
- **Screen:** 1 · **Domain/section:** Sleep
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Sleep
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Night sweats that soak the bedding
- **Answer options (verbatim):** Takes a long time to fall asleep · Waking in the night · Hard to get back to sleep once awake · Waking very early · Waking unrefreshed · An irregular pattern · Vivid or disturbing dreams · Night sweats · Night sweats that soak the bedding · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Mood & stress (`mood_stress`)

### `v2.mood.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed in yourself lately?
- **Screen:** 1 · **Domain/section:** Mood & stress
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Mood & stress
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Anxiety · Low mood · Low motivation · Irritability · Mood swings · Feeling overwhelmed · Finding it hard to cope · Pulling away from people · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.mood.load` (v1)

- **Client-facing wording (verbatim):** How does life’s load feel at the moment?
- **Screen:** 2 · **Domain/section:** Mood & stress
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Mood & stress
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Light at the moment · Manageable · Heavy · Very hard to carry · Prefer not to say
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.mood.stressors` (v1)

- **Client-facing wording (verbatim):** What is weighing on you most, if anything?
- **Screen:** 2 · **Domain/section:** Mood & stress
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Mood & stress
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.mood.coping` (v1)

- **Client-facing wording (verbatim):** What helps you unwind or cope?
- **Screen:** 2 · **Domain/section:** Mood & stress
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Mood & stress
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.mood.safety` (v1)

- **Client-facing wording (verbatim):** Have you had thoughts of harming yourself recently?
- **Screen:** 3 · **Domain/section:** Mood & stress
- **Answer type:** select
- **Help text:** If things feel very hard right now, you can call Samaritans free any time on 116 123, contact NHS 111, or call 999 in an emergency. Support is there whatever you answer here.
- **Why-we-ask text:** We ask everyone this, so your practitioner can care for the whole of you. You can skip it.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Mood & stress
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Sometimes · Yes
- **Answer options (verbatim):** No · Sometimes · Yes · Prefer not to say
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Energy, hormones & metabolism (`energy_metabolic`)

### `v2.energy.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed with energy, appetite or temperature?
- **Screen:** 1 · **Domain/section:** Energy, hormones & metabolism
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Energy, hormones & metabolism
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Weight going down without trying · Swelling at the front of the neck
- **Answer options (verbatim):** Tiredness that doesn’t lift · Low energy · Energy that crashes at certain times of day · Feeling shaky if a meal is missed · Strong cravings · Unusual thirst · Passing water very often · Weight going up without change in habits · Weight going down without trying · Feeling unusually cold · Feeling unusually hot · Sweating heavily · A thyroid condition I know about · Swelling at the front of the neck · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Reproductive health (`reproductive`)

### `v2.repro.female` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed? (female health)
- **Screen:** 1 · **Domain/section:** Reproductive health
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Cycles and hormones touch energy, mood, skin and sleep — this helps your practitioner see the whole picture. Skip anything you prefer to discuss in person.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Reproductive health; Question shown only when `v2.about.pathway` = Female health questions apply to me
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Reproductive and hormonal health facts, captured respectfully on the client’s chosen pathway. Shown only when the pathway is selected; gentle why-we-ask language; no interpretation.
- **safety_capture status:** YES — clinician-enumerated options: Bleeding between periods · Bleeding after sex
- **Answer options (verbatim):** Irregular cycles · Heavy periods · Painful periods · Bleeding between periods · Bleeding after sex · Pelvic pain · Symptoms in the days before a period · Thrush or infections · Hot flushes · Night sweats · Vaginal dryness · Changes in desire · Fertility concerns · Menopause or perimenopause symptoms · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.repro.female_status` (v1)

- **Client-facing wording (verbatim):** Which describes your cycle at the moment?
- **Screen:** 2 · **Domain/section:** Reproductive health
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Cycle stage changes which later questions make sense — nothing more is read into it.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Reproductive health; Question shown only when `v2.about.pathway` = Female health questions apply to me
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Reproductive and hormonal health facts, captured respectfully on the client’s chosen pathway. Shown only when the pathway is selected; gentle why-we-ask language; no interpretation.
- **safety_capture status:** YES — clinician-enumerated options: Pregnant or possibly pregnant
- **Answer options (verbatim):** Regular cycles · Irregular cycles · No periods currently · Pregnant or possibly pregnant · Breastfeeding · Perimenopause · Post-menopause · Prefer not to say
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.repro.pregnancies` (v1)

- **Client-facing wording (verbatim):** Pregnancies and their outcomes, if you are comfortable sharing
- **Screen:** 2 · **Domain/section:** Reproductive health
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Pregnancy history can shape hormonal and nutritional context. Share only what feels right — you can leave this blank.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Reproductive health; Question shown only when `v2.about.pathway` = Female health questions apply to me
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Reproductive and hormonal health facts, captured respectfully on the client’s chosen pathway. Shown only when the pathway is selected; gentle why-we-ask language; no interpretation.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.repro.male` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed? (male health)
- **Screen:** 1 · **Domain/section:** Reproductive health
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** These questions touch hormones, sleep and circulation — they help your practitioner see the whole picture. Skip anything you prefer to discuss in person.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Reproductive health; Question shown only when `v2.about.pathway` = Male health questions apply to me
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Reproductive and hormonal health facts, captured respectfully on the client’s chosen pathway. Shown only when the pathway is selected; gentle why-we-ask language; no interpretation.
- **safety_capture status:** YES — clinician-enumerated options: Discomfort in the pelvis or testicles
- **Answer options (verbatim):** Changes in desire · Fertility concerns · Difficulty with erections · Passing water very often · Difficulty starting to pass water · A weak stream · Not feeling fully empty afterwards · Discomfort in the pelvis or testicles · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.repro.children` (v1)

- **Client-facing wording (verbatim):** Do you have children?
- **Screen:** 2 · **Domain/section:** Reproductive health
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Simply part of the fertility picture — nothing more is read into it.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Reproductive health; Question shown only when `v2.about.pathway` = Male health questions apply to me
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Reproductive and hormonal health facts, captured respectfully on the client’s chosen pathway. Shown only when the pathway is selected; gentle why-we-ask language; no interpretation.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.repro.sexual_health` (v1)

- **Client-facing wording (verbatim):** Anything from your sexual health history you would like noted? (completely optional)
- **Screen:** 3 · **Domain/section:** Reproductive health
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Some infections, medications and hormones can be relevant to a health history. This is entirely yours to skip — a practitioner will only ever ask what is relevant and comfortable.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Reproductive health
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Reproductive and hormonal health facts, captured respectfully on the client’s chosen pathway. Shown only when the pathway is selected; gentle why-we-ask language; no interpretation.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Immune system & allergies (`immune`)

### `v2.immune.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed with immunity, allergies or healing?
- **Screen:** 1 · **Domain/section:** Immune system & allergies
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Immune system & allergies
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Swelling or lumps I can’t explain · A fever that won’t go away
- **Answer options (verbatim):** Allergies I know about · Foods I suspect don’t agree with me · Wounds that heal slowly · Asthma · Eczema · Hives · Infections that keep coming · Cold sores · An autoimmune condition · Swelling or lumps I can’t explain · A fever that won’t go away · A reaction to a recent vaccination · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.immune.allergy_detail` (v1)

- **Client-facing wording (verbatim):** If you have allergies or suspected intolerances, tell us what and what happens
- **Screen:** 2 · **Domain/section:** Immune system & allergies
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Immune system & allergies; Question shown only when `v2.immune.noticed` includes: Allergies I know about / Foods I suspect don’t agree with me
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Breathing, sinuses, throat & ears (`breathing`)

### `v2.breathing.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed with breathing, sinuses, throat or ears?
- **Screen:** 1 · **Domain/section:** Breathing, sinuses, throat & ears
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Breathing, sinuses, throat & ears
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Sudden breathlessness · Blood when coughing · Lips turning blue · Swelling of the face, lips, tongue or throat · A cough that won’t go
- **Answer options (verbatim):** Wheezing · Asthma · Chest infections · Mucus dripping down the back of the throat · Coughing up mucus · Sinus trouble · Getting out of breath easily · Sudden breathlessness · Throat or tonsil infections · Ear infections · A cough that won’t go · A dry cough · A dry throat · Blood when coughing · Lips turning blue · Swelling of the face, lips, tongue or throat · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Urinary (`urinary`)

### `v2.urinary.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed when passing water?
- **Screen:** 1 · **Domain/section:** Urinary
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Urinary
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Blood in the urine · Pain in the side or lower back
- **Answer options (verbatim):** Going very often · Sudden urgency · Burning or pain · Blood in the urine · Pain in the side or lower back · Difficulty going · Not feeling fully empty · Water infections that keep coming back · Changes in colour or smell · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Heart & circulation (`heart`)

### `v2.heart.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed with your heart or circulation?
- **Screen:** 1 · **Domain/section:** Heart & circulation
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Heart & circulation
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Chest pain or tightness · Fainting · A painful calf that is swollen, warm or tender
- **Answer options (verbatim):** Chest pain or tightness · Getting short of breath · A racing, thumping or fluttering heart · Swollen ankles or legs · Fainting · Varicose veins · Cold hands and feet · Blood pressure I know about · Cholesterol I know about · A painful calf that is swollen, warm or tender · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Muscles & joints (`muscles_joints`)

### `v2.muscles.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed with muscles, joints or your back?
- **Screen:** 1 · **Domain/section:** Muscles & joints
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Muscles & joints
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: Severe bone pain that doesn’t ease · Low back trouble along with difficulty passing water, opening bowels, or numbness underneath
- **Answer options (verbatim):** Joint pain · Joint stiffness · Joint swelling · Back pain · Neck pain · An injury that hasn’t settled · Muscle spasms · Cramps · Very slow recovery after exertion · Severe bone pain that doesn’t ease · Low back trouble along with difficulty passing water, opening bowels, or numbness underneath · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Skin, hair & nails (`skin`)

### `v2.skin.noticed` (v1)

- **Client-facing wording (verbatim):** Anything you have noticed with skin, hair or nails?
- **Screen:** 1 · **Domain/section:** Skin, hair & nails
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Skin, hair & nails
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** YES — clinician-enumerated options: A mole or skin patch that is changing
- **Answer options (verbatim):** Acne or breakouts · Dry skin · Oily skin · Eczema · Reactions where things touch the skin · Psoriasis · Fungal problems · Sensitive skin · A rash · Itching · Hair thinning or loss · Changes in your nails · A mole or skin patch that is changing · None of these
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.skin.products` (v1)

- **Client-facing wording (verbatim):** What do you put on your skin and hair? Brands are helpful if you know them.
- **Screen:** 2 · **Domain/section:** Skin, hair & nails
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Section shown only when `v2.systems.noticed` includes: Skin, hair & nails
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Screening-depth factual review across body systems, in the client’s selections and words.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: What you actually eat (`food_diary`)

### `v2.diary.entries` (v1)

- **Client-facing wording (verbatim):** What have you actually eaten and drunk?
- **Screen:** 1 · **Domain/section:** What you actually eat
- **Answer type:** diary
- **Help text:** Start with today or yesterday — meals, snacks and drinks, with rough times. Add up to three days if you can; skip and come back whenever suits. Nobody is judging your plate.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: How often foods appear (`food_frequency`)

### `v2.foodfreq.fruit` (v1)

- **Client-facing wording (verbatim):** Fruit
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.vegetables` (v1)

- **Client-facing wording (verbatim):** Vegetables
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.greens` (v1)

- **Client-facing wording (verbatim):** Leafy greens specifically
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.legumes` (v1)

- **Client-facing wording (verbatim):** Beans, lentils and pulses
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.red_meat` (v1)

- **Client-facing wording (verbatim):** Red meat
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.poultry` (v1)

- **Client-facing wording (verbatim):** Chicken and other poultry
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.fish` (v1)

- **Client-facing wording (verbatim):** Fish
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.eggs` (v1)

- **Client-facing wording (verbatim):** Eggs
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.dairy` (v1)

- **Client-facing wording (verbatim):** Dairy
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.plant_protein` (v1)

- **Client-facing wording (verbatim):** Plant proteins like tofu or tempeh
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.gluten` (v1)

- **Client-facing wording (verbatim):** Bread, pasta and other gluten-containing foods
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.refined` (v1)

- **Client-facing wording (verbatim):** Refined or sugary foods
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.sweets` (v1)

- **Client-facing wording (verbatim):** Sweets and confectionery
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.tinned` (v1)

- **Client-facing wording (verbatim):** Tinned foods
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.frozen` (v1)

- **Client-facing wording (verbatim):** Frozen meals
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.takeaway` (v1)

- **Client-facing wording (verbatim):** Takeaways
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.foodfreq.prepackaged` (v1)

- **Client-facing wording (verbatim):** Pre-packaged meals
- **Screen:** 1 · **Domain/section:** How often foods appear
- **Answer type:** frequency
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · A few times a month · A few times a week · Most days · Every day
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Eating habits & your kitchen (`eating_habits`)

### `v2.eating.pattern` (v1)

- **Client-facing wording (verbatim):** How would you describe the way you eat?
- **Screen:** 1 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Omnivore · Vegetarian · Vegan · Pescatarian · Halal · Gluten-free · Dairy-free · Other
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.eating.restrictions` (v1)

- **Client-facing wording (verbatim):** Any restrictions, and the reason behind them?
- **Screen:** 1 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.eating.reactions` (v1)

- **Client-facing wording (verbatim):** Foods that clearly disagree with you, and what happens
- **Screen:** 2 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.eating.dislikes` (v1)

- **Client-facing wording (verbatim):** Foods you simply can’t stand
- **Screen:** 2 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.eating.how` (v1)

- **Client-facing wording (verbatim):** How does eating usually happen for you?
- **Screen:** 3 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** I eat quickly · I eat slowly · I chew well · I barely chew · Often on the move · Often while stressed · Often at a table, unhurried · I skip meals · I often eat past full · Small portions · Large portions
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.kitchen.cooks` (v1)

- **Client-facing wording (verbatim):** Who mostly cooks at home?
- **Screen:** 4 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Me · Someone else · Shared · Mostly not cooked at home
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.kitchen.confidence` (v1)

- **Client-facing wording (verbatim):** How confident are you in the kitchen?
- **Screen:** 4 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Very confident · Comfortable with basics · Limited · I avoid cooking
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.kitchen.methods` (v1)

- **Client-facing wording (verbatim):** How is food usually cooked?
- **Screen:** 4 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** multichip
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Fresh from scratch · Batch cooked · Oven · Hob · Air fryer · Microwave · Deep fried · Raw or salads · Slow cooker
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.kitchen.shopping` (v1)

- **Client-facing wording (verbatim):** Where do you mostly shop for food?
- **Screen:** 5 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.kitchen.budget` (v1)

- **Client-facing wording (verbatim):** How does the food budget feel?
- **Screen:** 5 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Real suggestions from a practitioner have to fit real life. This stays between you and them.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Comfortable · Okay with care · Tight · Very tight · Prefer not to say
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.kitchen.recipe_support` (v1)

- **Client-facing wording (verbatim):** Would recipe ideas from your practitioner be welcome?
- **Screen:** 5 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Yes please · Maybe · No thanks
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.kitchen.change_hard` (v1)

- **Client-facing wording (verbatim):** Honestly — what would make changing how you eat hard to stick to?
- **Screen:** 5 · **Domain/section:** Eating habits & your kitchen
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Drinks (`drinks`)

### `v2.drinks.water` (v1)

- **Client-facing wording (verbatim):** Water — roughly how much a day?
- **Screen:** 1 · **Domain/section:** Drinks
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Hardly any · A glass or two · Around a litre · 1–2 litres · More than 2 litres
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.drinks.caffeine` (v1)

- **Client-facing wording (verbatim):** Tea or coffee — how many cups a day?
- **Screen:** 1 · **Domain/section:** Drinks
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** None · 1–2 · 3–4 · 5 or more
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.drinks.alcohol` (v1)

- **Client-facing wording (verbatim):** Alcohol — how often?
- **Screen:** 1 · **Domain/section:** Drinks
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Never · Special occasions · Most weeks · Most days
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.drinks.herbal` (v1)

- **Client-facing wording (verbatim):** Herbal teas — how often?
- **Screen:** 1 · **Domain/section:** Drinks
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · Sometimes · Most days
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.drinks.juices` (v1)

- **Client-facing wording (verbatim):** Juices — how often?
- **Screen:** 1 · **Domain/section:** Drinks
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · Sometimes · Most days
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.drinks.sugary` (v1)

- **Client-facing wording (verbatim):** Sugary or fizzy drinks — how often?
- **Screen:** 1 · **Domain/section:** Drinks
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Rarely or never · Sometimes · Most days
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.drinks.other` (v1)

- **Client-facing wording (verbatim):** Anything else you drink regularly?
- **Screen:** 1 · **Domain/section:** Drinks
- **Answer type:** text
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Life & routine (`lifestyle`)

### `v2.life.balance` (v1)

- **Client-facing wording (verbatim):** How does the balance between work and the rest of life feel?
- **Screen:** 1 · **Domain/section:** Life & routine
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Life, work, environment and practice context so care fits the client’s actual life.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** Healthy · Mostly fine · Tilted the wrong way · Consumed by work · Prefer not to say
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.life.movement` (v1)

- **Client-facing wording (verbatim):** How does movement show up in your week? Exercise, walking, anything at all — type, how often, how long.
- **Screen:** 1 · **Domain/section:** Life & routine
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Life, work, environment and practice context so care fits the client’s actual life.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.life.hobbies` (v1)

- **Client-facing wording (verbatim):** What do you do for joy?
- **Screen:** 2 · **Domain/section:** Life & routine
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Life, work, environment and practice context so care fits the client’s actual life.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.life.smoking` (v1)

- **Client-facing wording (verbatim):** Do you smoke or vape?
- **Screen:** 2 · **Domain/section:** Life & routine
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Life, work, environment and practice context so care fits the client’s actual life.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** No, never have · Used to, stopped · Occasionally · Daily
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.life.drugs` (v1)

- **Client-facing wording (verbatim):** Do you use recreational drugs?
- **Screen:** 2 · **Domain/section:** Life & routine
- **Answer type:** select
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** Asked without judgement — some substances interact with herbs, supplements and medication, and your practitioner needs the true picture.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Life, work, environment and practice context so care fits the client’s actual life.
- **safety_capture status:** not a safety-capture question
- **Answer options (verbatim):** No · Occasionally · Regularly · Prefer not to say
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.life.caring` (v1)

- **Client-facing wording (verbatim):** Do you care for anyone — children, parents, others?
- **Screen:** 3 · **Domain/section:** Life & routine
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Life, work, environment and practice context so care fits the client’s actual life.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

### `v2.life.faith_practices` (v1)

- **Client-facing wording (verbatim):** Any faith or cultural practices that shape your eating, fasting, routines or appointments?
- **Screen:** 3 · **Domain/section:** Life & routine
- **Answer type:** textarea
- **Help text:** — (not present in canonical source)
- **Why-we-ask text:** So suggestions and scheduling can respect how you actually live — fasting periods, food practices, prayer times, modesty preferences.
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** sensitive (why-we-ask required)
- **Purpose (domain-level):** Life, work, environment and practice context so care fits the client’s actual life.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Your timeline (`timeline`)

### `v2.timeline.events` (v1)

- **Client-facing wording (verbatim):** Your health and life timeline
- **Screen:** 1 · **Domain/section:** Your timeline
- **Answer type:** timeline
- **Help text:** Add the moments that mattered — an illness, a move, a loss, a birth, a change. Age or year, what happened, and a note if you like. No interpretation, just your story in order.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** no · **Skippable:** yes
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** The client’s own health-and-life timeline, with their emphasis, for the practitioner.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1

## Chapter: Read it back (`review`)

### `v2.review.confirmed` (v1)

- **Client-facing wording (verbatim):** I have read my answers back and they are mine, as I meant them.
- **Screen:** 1 · **Domain/section:** Read it back
- **Answer type:** yesno
- **Help text:** Your health intake will not be submitted until the required choices for your selected NI service are complete.
- **Why-we-ask text:** — (not present in canonical source)
- **Required:** yes · **Skippable:** no
- **Conditional rule:** Always shown within its chapter
- **Sensitivity marker:** standard
- **Purpose (domain-level):** Capture the client’s presenting concerns factually, in their own words, for their practitioner.
- **safety_capture status:** not a safety-capture question
- **Source/version:** packages/db/src/intakeV2/registry.ts · question version 1
