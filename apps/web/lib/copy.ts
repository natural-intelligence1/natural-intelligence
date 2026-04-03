/**
 * Natural Intelligence — Web App UI Copy
 *
 * All user-facing strings live here. No text is hardcoded in components.
 * To change any label, heading, or message: edit this file only.
 */

export const copy = {
  brand: {
    name:    'Natural Intelligence',
    tagline: 'Intelligent, natural healthcare — for everyone',
    taglineShort: 'Natural healthcare for everyone',
    copyright: `© ${new Date().getFullYear()} Natural Intelligence. All rights reserved.`,
  },

  nav: {
    directory:  'Directory',
    workshops:  'Workshops',
    resources:  'Resources',
    community:  'Community',
    apply:      'Apply to join',
    login:      'Log in',
    signup:     'Sign up',
    dashboard:  'Dashboard',
    logout:     'Log out',
    menu:       'Open menu',
    close:      'Close menu',
  },

  footer: {
    sections: {
      platform: {
        heading: 'Platform',
        links: ['Directory', 'Workshops', 'Resources', 'Community'],
      },
      practitioners: {
        heading: 'Practitioners',
        links: ['Apply to join', 'Practitioner standards', 'Trust framework'],
      },
      support: {
        heading: 'Support',
        links: ['Submit a request', 'Referral programme', 'Charity referrals'],
      },
    },
    legal: {
      terms:   'Terms of use',
      privacy: 'Privacy policy',
      cookies: 'Cookie policy',
    },
  },

  home: {
    hero: {
      headline:    'Intelligent, natural healthcare — for everyone',
      subheadline: 'Connect with vetted naturopathic and functional medicine practitioners. Access workshops, resources, and a trusted community built around whole-person health.',
      ctaPrimary:   'Find a practitioner',
      ctaSecondary: 'Apply to join',
    },
    pillars: {
      heading: 'How we support you',
      items: [
        {
          title:       'Learn',
          description: 'Access practitioner-curated articles, guides, and resources on natural and functional medicine.',
        },
        {
          title:       'Connect',
          description: 'Find vetted practitioners who align with your values and health goals.',
        },
        {
          title:       'Support',
          description: 'Submit a referral or support request. We match you with the right practitioner or programme.',
        },
      ],
    },
    featuredPractitioners: {
      heading:  'Featured practitioners',
      subheading: 'Verified and trusted by our community',
      cta:      'View all practitioners',
      empty:    'Practitioners joining soon.',
    },
    upcomingWorkshops: {
      heading:    'Upcoming workshops',
      subheading: 'Live sessions hosted by our practitioners',
      cta:        'View all workshops',
      empty:      'Workshops being scheduled.',
    },
    howItWorks: {
      heading: 'How it works',
      members: {
        heading: 'For members',
        steps: [
          { step: '01', title: 'Create your account', description: 'Sign up free in under a minute. No clinical history required.' },
          { step: '02', title: 'Browse the directory', description: 'Filter practitioners by specialty, modality, and trust level.' },
          { step: '03', title: 'Connect and attend', description: 'Register for workshops or submit a support request for personalised matching.' },
        ],
      },
      practitioners: {
        heading: 'For practitioners',
        steps: [
          { step: '01', title: 'Apply to join', description: 'Submit your credentials, bio, and motivation. Our team reviews every application.' },
          { step: '02', title: 'Get verified', description: 'Approved practitioners receive a trust badge visible across the platform.' },
          { step: '03', title: 'Grow your practice', description: 'Host workshops, publish resources, and connect with members who need your expertise.' },
        ],
      },
    },
  },

  directory: {
    heading:     'Practitioner directory',
    subheading:  'Browse our community of verified natural health practitioners',
    searchLabel: 'Search practitioners',
    searchPlaceholder: 'Name or specialty…',
    filters: {
      heading:      'Filters',
      trustLevel:   'Trust level',
      vetted:       'Vetted',
      unvetted:     'Community listed',
      specialties:  'Specialties',
      modalities:   'Modalities',
      clearAll:     'Clear filters',
    },
    card: {
      viewProfile:  'View profile',
      vettedBadge:  'Vetted practitioner',
      years:        'years experience',
    },
    empty:   'No practitioners match your search.',
    loading: 'Loading practitioners…',
  },

  practitionerProfile: {
    sections: {
      about:       'About',
      specialties: 'Specialties',
      credentials: 'Credentials',
      modalities:  'Modalities & approaches',
      events:      'Upcoming events',
    },
    cta: {
      supportRequest: 'Submit a support request',
      website:        'Visit website',
      linkedin:       'LinkedIn profile',
    },
    vettedBadge:  'Verified practitioner',
    noEvents:     'No upcoming events.',
  },

  workshops: {
    heading:    'Workshops & events',
    subheading: 'Live sessions, webinars, and group programmes',
    filters: {
      all:          'All types',
      workshop:     'Workshop',
      webinar:      'Webinar',
      qa:           'Q&A',
      group_session:'Group session',
    },
    card: {
      register:     'Register',
      registered:   'Registered',
      full:         'Full',
      online:       'Online',
      capacity:     'spaces remaining',
      loginToRegister: 'Log in to register',
    },
    modal: {
      heading:    'Register for this event',
      consent:    'I agree to the workshop terms and understand this is an educational session, not clinical advice.',
      confirm:    'Confirm registration',
      cancel:     'Cancel',
    },
    empty:   'No upcoming workshops.',
    loading: 'Loading events…',
  },

  resources: {
    heading:    'Resource library',
    subheading: 'Practitioner-curated articles, guides, and links',
    filters: {
      all:           'All types',
      article:       'Article',
      guide:         'Guide',
      video_link:    'Video',
      podcast_link:  'Podcast',
      external_link: 'External link',
    },
    card: {
      readMore: 'Read more',
      visit:    'Visit resource',
    },
    empty:   'No resources published yet.',
    loading: 'Loading resources…',
  },

  community: {
    heading:     'Community',
    subheading:  'Share, discuss, and learn with the Natural Intelligence community',
    compose: {
      placeholder: 'Share something with the community…',
      post:        'Post',
      addImage:    'Add image',
    },
    post: {
      like:     'Like',
      comment:  'Reply',
      delete:   'Delete',
      loadMore: 'Load more replies',
    },
    empty:       'No posts yet. Be the first to share something.',
    loginPrompt: 'Log in to post and join the conversation.',
  },

  apply: {
    heading:    'Apply to join as a practitioner',
    subheading: 'Tell us about yourself. Our team reviews every application personally.',
    sections: {
      personal:     'Personal details',
      professional: 'Professional background',
      motivation:   'Your motivation',
      links:        'Online presence',
      consent:      'Confirmation',
    },
    fields: {
      fullName:        'Full name',
      email:           'Email address',
      phone:           'Phone number',
      specialties:     'Specialties',
      specialtiesHint: 'Separate with commas — e.g. Naturopathy, Nutrition, Herbal medicine',
      credentials:     'Qualifications & credentials',
      yearsExperience: 'Years of experience',
      modalities:      'Modalities practiced',
      bio:             'Short bio',
      motivation:      'Why do you want to join Natural Intelligence?',
      websiteUrl:      'Website URL',
      linkedinUrl:     'LinkedIn URL',
      consent:         'I confirm my details are accurate and I agree to the Natural Intelligence practitioner terms.',
    },
    placeholders: {
      fullName:    'Your full name',
      email:       'you@example.com',
      phone:       '+44…',
      credentials: 'e.g. BSc Naturopathy (BCNH), mBANT',
      years:       '0',
      modalities:  'e.g. Nutritional therapy, Herbal medicine, Functional testing',
      bio:         'A short paragraph about your practice and approach…',
      motivation:  'What draws you to this community and what you hope to contribute…',
      website:     'https://yourwebsite.com',
      linkedin:    'https://linkedin.com/in/yourprofile',
    },
    submit:   'Submit application',
    success: {
      heading:    'Application received',
      body:       'Thank you. We review every application personally and will be in touch within 5 working days.',
    },
  },

  support: {
    heading:    'Support & referral',
    subheading: 'Tell us what you need. We will connect you with the right practitioner or programme.',
    fields: {
      fullName:    'Full name',
      email:       'Email address',
      phone:       'Phone number',
      requestType: 'Type of request',
      description: 'Tell us what you need',
      urgency:     'Urgency',
      consent:     'I agree to my information being used to match me with appropriate support.',
    },
    placeholders: {
      fullName:    'Your full name',
      email:       'you@example.com',
      phone:       '+44…',
      description: 'Please describe what support you are looking for…',
    },
    requestTypes: {
      general:            'General enquiry',
      referral:           'Referral request',
      charity_referral:   'Charity-supported referral',
      practitioner_match: 'Practitioner matching',
      other:              'Other',
    },
    urgencyLevels: {
      low:    'Not urgent',
      normal: 'Normal',
      high:   'Urgent',
    },
    submit:  'Submit request',
    success: {
      heading: 'Request received',
      body:    'Thank you. A member of our team will review your request and be in touch shortly.',
    },
  },

  auth: {
    login: {
      heading:   'Welcome back',
      subheading:'Log in to your Natural Intelligence account',
      email:     'Email address',
      password:  'Password',
      submit:    'Log in',
      noAccount: 'New to Natural Intelligence?',
      signup:    'Create an account',
      forgot:    'Forgot password?',
    },
    signup: {
      heading:        'Create your account',
      subheading:     'Join the Natural Intelligence community',
      fullName:       'Full name',
      email:          'Email address',
      password:       'Password',
      passwordHint:   'At least 8 characters',
      consentTerms:   'I agree to the Natural Intelligence terms of use and privacy policy.',
      consentData:    'I consent to my data being processed to provide the platform service.',
      submit:         'Create account',
      hasAccount:     'Already have an account?',
      login:          'Log in',
    },
    errors: {
      generic:         'Something went wrong. Please try again.',
      invalidCredentials: 'Invalid email or password.',
      emailTaken:      'An account with this email already exists.',
      weakPassword:    'Password must be at least 8 characters.',
      consentRequired: 'You must agree to the terms to continue.',
    },
  },

  dashboard: {
    heading:    'Your dashboard',
    sections: {
      workshops:  'My registered workshops',
      requests:   'My support requests',
      saved:      'Saved practitioners',
      quickLinks: 'Quick links',
    },
    quickLinks: [
      { label: 'Browse directory',   href: '/directory' },
      { label: 'Find a workshop',    href: '/workshops' },
      { label: 'Submit a request',   href: '/support' },
      { label: 'Browse resources',   href: '/resources' },
    ],
    empty: {
      workshops:  'You have not registered for any workshops yet.',
      requests:   'You have not submitted any support requests yet.',
      saved:      'Saved practitioners will appear here.',
    },
    status: {
      new:       'New',
      in_review: 'In review',
      actioned:  'Actioned',
      closed:    'Closed',
    },
  },

  errors: {
    notFound:    'Page not found',
    serverError: 'Something went wrong',
    accessDenied:'Access denied',
    backHome:    'Back to home',
  },
} as const

export type Copy = typeof copy
