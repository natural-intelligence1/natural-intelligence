// Barrel for the corporate prospectus request flow.

export {
  ORGANISATION_TYPES, ORGANISATION_TYPE_LABELS,
  AUDIENCES, AUDIENCE_LABELS, audienceOptionsFor,
  SIZE_BANDS, SIZE_BAND_LABELS,
  INTERESTS, INTEREST_LABELS,
  TIMINGS, TIMING_LABELS,
  PROSPECTUS_DOCUMENTS, PROSPECTUS_DOCUMENT_DEFS,
  routeProspectus, documentTitles, validateProspectusEnquiry,
} from './routing'
export type {
  OrganisationType, Audience, SizeBand, Interest, Timing,
  ProspectusDocumentId, ProspectusDocumentDef, RoutingResult, ProspectusEnquiryInput,
} from './routing'

export {
  isProspectusRequestEnabled, createProspectusEnquiry, signProspectusDocuments,
  deliverProspectus, listProspectusEnquiries, setProspectusFollowUpStatus,
} from './enquiries'
export type {
  CreateEnquiryResult, DeliveryOutcome, ProspectusEnquiryRow,
} from './enquiries'
