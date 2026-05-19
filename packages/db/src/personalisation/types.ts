// Domain types for the personalisation module (PS.1).
// Mirror the CHECK constraints on public.user_personalisation — keep in sync
// with migration 0047_ps1_user_personalisation.

export type BiologicalSex = 'male' | 'female'

export type Religion =
  | 'muslim'
  | 'christian'
  | 'jewish'
  | 'hindu'
  | 'buddhist'
  | 'sikh'
  | 'secular'
  | 'prefer_not_to_say'
  | 'other'

export type ReligiousContentPreference = 'show' | 'hide'

// Row shape on public.user_personalisation. biological_sex is nullable (intake
// not yet completed); religion + religious_content_preference are NOT NULL
// (defaults applied by the table).
export interface UserPersonalisation {
  userId:                     string
  biologicalSex:              BiologicalSex | null
  religion:                   Religion
  religiousContentPreference: ReligiousContentPreference
  clinicalNotesOnSex:         string | null
  createdAt:                  string
  updatedAt:                  string
}

// Shape exposed by the practitioner_client_personalisation view (column-scoped:
// religion + religious_content_preference are intentionally NOT included).
export interface PractitionerClientPersonalisation {
  userId:             string
  biologicalSex:      BiologicalSex | null
  clinicalNotesOnSex: string | null
  updatedAt:          string
}
