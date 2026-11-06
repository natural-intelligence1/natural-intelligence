import { describe, it, expect } from 'vitest'
import { isConsentGateExempt } from './consentGate'

describe('isConsentGateExempt', () => {
  it('exempts the privacy controls', () => {
    expect(isConsentGateExempt('/dashboard/privacy')).toBe(true)
  })

  it('exempts the data rights channel', () => {
    expect(isConsentGateExempt('/dashboard/requests')).toBe(true)
  })

  it('exempts nested pages under an exempt route', () => {
    expect(isConsentGateExempt('/dashboard/privacy/export')).toBe(true)
    expect(isConsentGateExempt('/dashboard/requests/abc-123')).toBe(true)
  })

  it('gates everything that collects or shows health data', () => {
    for (const p of [
      '/dashboard',
      '/dashboard/intake',
      '/dashboard/intake-v2',
      '/dashboard/synopsis',
      '/dashboard/story',
      '/dashboard/biohub',
      '/dashboard/profile',
    ]) {
      expect(isConsentGateExempt(p)).toBe(false)
    }
  })

  it('is not fooled by a prefix that only looks exempt', () => {
    expect(isConsentGateExempt('/dashboard/privacy-settings')).toBe(false)
    expect(isConsentGateExempt('/dashboard/requests-archive')).toBe(false)
  })

  it('gates when the pathname is unknown', () => {
    expect(isConsentGateExempt(null)).toBe(false)
    expect(isConsentGateExempt(undefined)).toBe(false)
    expect(isConsentGateExempt('')).toBe(false)
  })
})
