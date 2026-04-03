/**
 * Natural Intelligence — Admin App UI Copy
 * All admin user-facing strings live here. No text hardcoded in components.
 */

export const copy = {
  brand: {
    name:   'Natural Intelligence',
    suffix: 'Admin',
  },

  nav: {
    dashboard:    'Dashboard',
    applications: 'Applications',
    practitioners:'Practitioners',
    support:      'Support requests',
    workshops:    'Workshops',
    resources:    'Resources',
    members:      'Members',
    logout:       'Log out',
  },

  login: {
    heading:    'Admin access',
    subheading: 'Sign in to the Natural Intelligence admin panel',
    email:      'Email address',
    password:   'Password',
    submit:     'Sign in',
    error:      'Invalid credentials or insufficient permissions.',
  },

  dashboard: {
    heading:    'Overview',
    metrics: {
      pendingApplications: 'Pending applications',
      newSupportRequests:  'New support requests',
      totalMembers:        'Total members',
      publishedWorkshops:  'Published workshops',
      publishedResources:  'Published resources',
    },
  },

  applications: {
    heading:    'Practitioner applications',
    subheading: 'Review and action all submitted applications',
    columns: {
      name:        'Name',
      email:       'Email',
      specialties: 'Specialties',
      status:      'Status',
      submitted:   'Submitted',
    },
    statuses: {
      pending:   'Pending',
      reviewing: 'Reviewing',
      approved:  'Approved',
      rejected:  'Rejected',
    },
    detail: {
      sections: {
        personal:     'Personal details',
        professional: 'Professional background',
        motivation:   'Motivation',
        links:        'Links',
        review:       'Review',
      },
      fields: {
        fullName:        'Full name',
        email:           'Email',
        phone:           'Phone',
        specialties:     'Specialties',
        credentials:     'Credentials',
        yearsExperience: 'Years experience',
        modalities:      'Modalities',
        bio:             'Bio',
        motivation:      'Motivation',
        websiteUrl:      'Website',
        linkedinUrl:     'LinkedIn',
        submittedAt:     'Submitted',
        reviewerNotes:   'Reviewer notes',
      },
      actions: {
        approve:   'Approve',
        reject:    'Reject',
        reviewing: 'Mark as reviewing',
      },
      notesPlaceholder: 'Add internal notes…',
    },
    empty: 'No applications found.',
  },

  support: {
    heading:    'Support requests',
    subheading: 'Review and action incoming member support requests',
    columns: {
      name:        'Name',
      email:       'Email',
      requestType: 'Type',
      urgency:     'Urgency',
      status:      'Status',
      submitted:   'Submitted',
    },
    statuses: {
      new:       'New',
      in_review: 'In review',
      actioned:  'Actioned',
      closed:    'Closed',
    },
    urgency: {
      low:    'Low',
      normal: 'Normal',
      high:   'High',
    },
    requestTypes: {
      general:            'General enquiry',
      referral:           'Referral',
      charity_referral:   'Charity referral',
      practitioner_match: 'Practitioner match',
      other:              'Other',
    },
    detail: {
      fields: {
        fullName:    'Full name',
        email:       'Email',
        phone:       'Phone',
        requestType: 'Request type',
        description: 'Description',
        urgency:     'Urgency',
        status:      'Status',
        memberSince: 'Member since',
        adminNotes:  'Admin notes',
      },
      notesPlaceholder: 'Add internal notes…',
      saveNotes:        'Save notes',
      updateStatus:     'Update status',
    },
    empty: 'No support requests found.',
  },

  workshops: {
    heading:    'Workshops & events',
    subheading: 'Manage all platform events',
    createNew:  'Create event',
    columns: {
      title:  'Title',
      type:   'Type',
      starts: 'Starts',
      status: 'Status',
      capacity: 'Capacity',
    },
    statuses: {
      draft:     'Draft',
      published: 'Published',
      cancelled: 'Cancelled',
      completed: 'Completed',
    },
    types: {
      workshop:      'Workshop',
      webinar:       'Webinar',
      qa:            'Q&A',
      group_session: 'Group session',
    },
    form: {
      heading:     {
        create: 'Create event',
        edit:   'Edit event',
      },
      fields: {
        title:       'Title',
        description: 'Description',
        type:        'Event type',
        startsAt:    'Start date & time',
        endsAt:      'End date & time',
        location:    'Location',
        isOnline:    'Online event',
        meetingUrl:  'Meeting URL',
        maxCapacity: 'Max capacity',
        status:      'Status',
      },
      save:   'Save event',
      cancel: 'Cancel',
    },
    empty: 'No events yet.',
  },

  resources: {
    heading:    'Resources',
    subheading: 'Manage the practitioner-curated resource library',
    createNew:  'Create resource',
    columns: {
      title:  'Title',
      type:   'Type',
      status: 'Status',
      author: 'Author',
    },
    types: {
      article:       'Article',
      guide:         'Guide',
      video_link:    'Video',
      podcast_link:  'Podcast',
      external_link: 'External link',
    },
    statuses: {
      draft:     'Draft',
      published: 'Published',
      archived:  'Archived',
    },
    form: {
      heading: {
        create: 'Create resource',
        edit:   'Edit resource',
      },
      fields: {
        title:       'Title',
        description: 'Short description',
        body:        'Body content',
        type:        'Resource type',
        topicTags:   'Topic tags',
        tagsHint:    'Separate with commas',
        status:      'Status',
      },
      save:   'Save resource',
      cancel: 'Cancel',
    },
    empty: 'No resources yet.',
  },

  members: {
    heading:    'Members',
    subheading: 'All registered platform members',
    columns: {
      name:   'Name',
      email:  'Email',
      joined: 'Joined',
      role:   'Role',
    },
    empty: 'No members yet.',
  },

  shared: {
    save:          'Save',
    cancel:        'Cancel',
    delete:        'Delete',
    edit:          'Edit',
    view:          'View',
    back:          'Back',
    loading:       'Loading…',
    noData:        'No data.',
    actions:       'Actions',
    confirmDelete: 'Are you sure? This cannot be undone.',
    saved:         'Saved.',
    error:         'Something went wrong. Please try again.',
    accessDenied:  'Access denied.',
  },
} as const

export type AdminCopy = typeof copy
