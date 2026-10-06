// Corporate prospectus routing — exhaustive over the brief's routing table.

import { describe, it, expect } from 'vitest'
import {
  routeProspectus, audienceOptionsFor, validateProspectusEnquiry,
  ORGANISATION_TYPES, AUDIENCES, PROSPECTUS_DOCUMENT_DEFS, PROSPECTUS_DOCUMENTS,
} from './routing'
import type { OrganisationType, Audience, ProspectusEnquiryInput } from './routing'

describe('routing table — every branch in the brief', () => {
  const cases: [OrganisationType, Audience, string[]][] = [
    ['care_setting',    'residents',        ['care_residents']],
    ['care_setting',    'staff',            ['care_staff']],
    ['care_setting',    'both',             ['care_residents', 'care_staff']],
    ['workplace',       'employees',        ['workplaces']],
    ['workplace',       'combination',      ['workplaces']],
    ['school_college',  'staff',            ['workplaces']],
    ['school_college',  'students',         ['community_faith']],
    ['school_college',  'parents_families', ['community_faith']],
    ['school_college',  'combination',      ['community_faith']],
    ['community_faith', 'members',          ['community_faith']],
    ['charity',         'service_users',    ['community_faith']],
    ['other',           'employees',        ['workplaces']],
  ]

  for (const [type, audience, expected] of cases) {
    it(`${type} + ${audience} → ${expected.join(' + ')}`, () => {
      expect(routeProspectus(type, audience).documents).toEqual(expected)
    })
  }

  it('care setting + both is the only dual-document route, and explains itself', () => {
    const dual = routeProspectus('care_setting', 'both')
    expect(dual.variant).toBe('dual')
    expect(dual.documents).toHaveLength(2)
    expect(dual.coveringNote.toLowerCase()).toContain('both')

    for (const type of ORGANISATION_TYPES) {
      for (const audience of audienceOptionsFor(type)) {
        const r = routeProspectus(type, audience)
        if (!(type === 'care_setting' && audience === 'both')) {
          expect(r.documents, `${type}/${audience}`).toHaveLength(1)
        }
      }
    }
  })

  it('"Other" routes to workplaces AND flags personal review', () => {
    const r = routeProspectus('other', 'combination')
    expect(r.documents).toEqual(['workplaces'])
    expect(r.needsManualReview).toBe(true)
    expect(r.variant).toBe('other')
  })

  it('no other route asks for manual review', () => {
    for (const type of ORGANISATION_TYPES) {
      for (const audience of audienceOptionsFor(type)) {
        if (type === 'other') continue
        expect(routeProspectus(type, audience).needsManualReview, `${type}/${audience}`).toBe(false)
      }
    }
  })

  it('every organisation type and audience combination resolves to real documents', () => {
    for (const type of ORGANISATION_TYPES) {
      for (const audience of audienceOptionsFor(type)) {
        const r = routeProspectus(type, audience)
        expect(r.documents.length).toBeGreaterThan(0)
        for (const id of r.documents) {
          expect(PROSPECTUS_DOCUMENTS).toContain(id)
          expect(PROSPECTUS_DOCUMENT_DEFS[id].storageKey).toMatch(/\.pdf$/)
        }
      }
    }
  })
})

describe('audience options branch on organisation type', () => {
  it('care settings offer residents / staff / both', () => {
    expect(audienceOptionsFor('care_setting')).toEqual(['residents', 'staff', 'both'])
  })
  it('schools offer students / staff / parents and families / a combination', () => {
    expect(audienceOptionsFor('school_college')).toEqual(['students', 'staff', 'parents_families', 'combination'])
  })
  it('everything else offers employees / members / service users / a combination', () => {
    for (const type of ['workplace', 'community_faith', 'charity', 'other'] as OrganisationType[]) {
      expect(audienceOptionsFor(type)).toEqual(['employees', 'members', 'service_users', 'combination'])
    }
  })
  it('every listed audience is a known audience', () => {
    for (const type of ORGANISATION_TYPES) {
      for (const a of audienceOptionsFor(type)) expect(AUDIENCES).toContain(a)
    }
  })
})

describe('validation', () => {
  const valid: ProspectusEnquiryInput = {
    organisationType: 'care_setting', audience: 'both', sizeBand: '25_75',
    interests: ['sleep'], timing: 'next_few_months',
    contactName: 'A Person', organisationName: 'Example Care Home',
    role: 'Manager', email: 'person@example.org',
  }

  it('accepts a complete enquiry', () => {
    expect(validateProspectusEnquiry(valid)).toEqual({})
  })

  it('requires the five routing answers and the contact fields', () => {
    const errors = validateProspectusEnquiry({})
    for (const field of ['organisationType', 'audience', 'sizeBand', 'interests', 'timing',
      'contactName', 'organisationName', 'role', 'email']) {
      expect(errors, field).toHaveProperty(field)
    }
  })

  it('rejects an audience that does not belong to the chosen organisation type', () => {
    expect(validateProspectusEnquiry({ ...valid, organisationType: 'workplace', audience: 'residents' }))
      .toHaveProperty('audience')
  })

  it('rejects a malformed email', () => {
    expect(validateProspectusEnquiry({ ...valid, email: 'not-an-email' })).toHaveProperty('email')
  })

  it('phone, free text and marketing opt-in are all optional', () => {
    expect(validateProspectusEnquiry({ ...valid, phone: undefined, anythingElse: undefined }))
      .toEqual({})
  })

  it('never asks for budget — no budget field exists on the input', () => {
    expect(Object.keys(valid)).not.toContain('budget')
    expect(JSON.stringify(PROSPECTUS_DOCUMENT_DEFS).toLowerCase()).not.toContain('budget')
  })
})
