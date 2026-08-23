import { z } from 'zod'

/* ── Schémas (source de vérité des types) ─────────────────────────── */

const linkSchema = z.object({
  label: z.string(),
  value: z.string(),
  href: z.string(),
})

const statSchema = z.object({
  value: z.string(),
  label: z.string(),
  detail: z.string(),
})

const experienceSchema = z.object({
  id: z.string(),
  role: z.string(),
  company: z.string(),
  period: z.string(),
  start: z.string(),
  end: z.string(),
  type: z.string().optional(),
  summary: z.string(),
  highlights: z.array(z.string()),
  tags: z.array(z.string()),
})

const skillGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  kicker: z.string(),
  items: z.array(z.string()),
})

const educationSchema = z.object({
  degree: z.string(),
  school: z.string(),
  period: z.string(),
  detail: z.string(),
})

const cvSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  title: z.string(),
  tagline: z.string(),
  location: z.string(),
  profile: z.string(),
  contact: z.array(linkSchema),
  stats: z.array(statSchema),
  experiences: z.array(experienceSchema),
  skillGroups: z.array(skillGroupSchema),
  education: z.array(educationSchema),
  letter: z.object({
    subject: z.string(),
    salutation: z.string(),
    paragraphs: z.array(z.string()),
    closing: z.string(),
    signature: z.string(),
  }),
})

export type Link = z.infer<typeof linkSchema>
export type Stat = z.infer<typeof statSchema>
export type Experience = z.infer<typeof experienceSchema>
export type SkillGroup = z.infer<typeof skillGroupSchema>
export type Education = z.infer<typeof educationSchema>
export type Cv = z.infer<typeof cvSchema>

/* ── Contenu ──────────────────────────────────────────────────────── */

export const EMAIL = 'farah.elbid@gmail.com'
export const PHONE = '+33 6 44 83 21 21'
// À remplacer par l'URL exacte du profil LinkedIn.
export const LINKEDIN_URL = 'https://www.linkedin.com/'
export const CV_PDF = '/cv-farah-elbid.pdf'

export const cv: Cv = {
  firstName: 'Farah',
  lastName: 'Elbid',
  title: 'Directrice adjointe du marketing digital',
  tagline:
    'Acquisition, fundraising digital et data au service de l’impact humanitaire.',
  location: '93200 Saint-Denis',
  profile:
    'Professionnelle du marketing digital avec près de 7 ans d’expérience dans l’humanitaire, de l’alternance à la direction adjointe. Expertise en acquisition, fundraising digital, data et performance. Management d’équipes et pilotage de campagnes à forts enjeux.',

  contact: [
    { label: 'Email', value: EMAIL, href: `mailto:${EMAIL}` },
    { label: 'Téléphone', value: PHONE, href: 'tel:+33644832121' },
    { label: 'LinkedIn', value: 'Profil LinkedIn', href: LINKEDIN_URL },
    { label: 'Localisation', value: '93200 Saint-Denis', href: '' },
  ],

  stats: [
    {
      value: '+800 %',
      label: 'de collecte digitale',
      detail: 'Croissance pilotée entre 2021 et 2025',
    },
    {
      value: '10',
      label: 'personnes managées',
      detail: 'Acquisition, CRM, web, contenus, analytics',
    },
    {
      value: '7 ans',
      label: 'dans l’humanitaire',
      detail: 'De l’alternance à la direction adjointe',
    },
    {
      value: '3',
      label: 'temps forts par an',
      detail: 'Ramadan, urgences, fin d’année',
    },
  ],

  experiences: [
    {
      id: 'directrice-adjointe',
      role: 'Directrice adjointe du marketing digital',
      company: 'Human Appeal France',
      period: 'Juin 2026 — aujourd’hui',
      start: '2026',
      end: 'Aujourd’hui',
      summary:
        'Pilotage de la stratégie marketing digital et de la performance de collecte, avec management et coordination des expertises acquisition, CRM, web, contenus et analytics.',
      highlights: [
        'Structuration du pilotage par la data et des rituels de performance',
        'Optimisation des parcours donateurs, de l’entrée en relation à la fidélisation',
        'Développement de nouveaux leviers : automatisation et IA générative',
      ],
      tags: ['Stratégie', 'Management', 'Data', 'Innovation'],
    },
    {
      id: 'responsable-marketing',
      role: 'Responsable marketing digital',
      company: 'Human Appeal France',
      period: 'Sept. 2021 — juin 2026',
      start: '2021',
      end: '2026',
      summary:
        'Pilotage de l’acquisition et de la collecte digitale multicanale avec une approche orientée ROI, conversion et croissance.',
      highlights: [
        'Contribution à une hausse de plus de 800 % des collectes entre 2021 et 2025',
        'Management d’équipes pluridisciplinaires sur toute la chaîne digitale',
        'Pilotage des grands temps forts : Ramadan, urgences humanitaires, fin d’année',
      ],
      tags: ['Acquisition', 'Paid Media', 'ROI', 'Conversion'],
    },
    {
      id: 'chargee-communication',
      role: 'Chargée de communication digitale',
      company: 'Human Appeal France',
      period: 'Nov. 2019 — sept. 2021',
      start: '2019',
      end: '2021',
      type: 'Alternance',
      summary:
        'Déploiement de la stratégie de communication digitale, création de contenus et participation aux campagnes de collecte.',
      highlights: [
        'Contribution à la structuration de l’écosystème digital de l’association',
        'Montée en puissance des campagnes de collecte en ligne',
      ],
      tags: ['Contenus', 'Campagnes', 'Social media'],
    },
    {
      id: 'chargee-contenu',
      role: 'Chargée de contenu digital',
      company: 'Cent Philtres',
      period: 'Sept. 2018 — sept. 2019',
      start: '2018',
      end: '2019',
      type: 'Alternance',
      summary:
        'Création et animation des contenus social media, gestion du site e-commerce et déploiement des campagnes emailing.',
      highlights: [
        'Gestion du site e-commerce sous Prestashop',
        'Déploiement des campagnes emailing et animation éditoriale',
      ],
      tags: ['E-commerce', 'Emailing', 'Éditorial'],
    },
  ],

  skillGroups: [
    {
      id: 'management',
      title: 'Management',
      kicker: 'Faire avancer une équipe et des décisions',
      items: [
        'Leadership',
        'Réflexion stratégique',
        'Prise de décision',
        'Organisation & priorisation',
        'Collaboration transverse',
        'Résolution de problèmes',
      ],
    },
    {
      id: 'expertises',
      title: 'Expertises',
      kicker: 'Le cœur du métier, de l’acquisition à la conversion',
      items: [
        'Stratégie digitale',
        'Acquisition & Paid Media',
        'SEO & SEM',
        'Data & Performance',
        'Conversion & parcours donateur',
        'Emailing & Automation',
      ],
    },
    {
      id: 'outils',
      title: 'Outils',
      kicker: 'L’environnement de travail au quotidien',
      items: [
        'Salesforce',
        'GA4',
        'Search Console',
        'SEMrush',
        'Plateformes Ads',
        'IA générative',
        'Brevo',
        'Mailchimp',
        'SendinBlue',
        'Notion',
        'ClickUp',
        'Trello',
        'Asana',
      ],
    },
  ],

  education: [
    {
      degree: 'Master Management & Transformation Digitale',
      school: 'EFREI Paris & EDC',
      period: '2019 — 2021',
      detail: 'Double diplôme en management, transformation digitale et ingénierie.',
    },
  ],

  letter: {
    subject: 'Candidature au poste de Responsable Innovation & Développement Digital',
    salutation: 'Madame, Monsieur,',
    paragraphs: [
      'Je pourrais vous écrire que votre offre correspond à mon profil. Ce serait vrai, mais ce ne serait pas la raison principale de ma candidature. Ce qui m’intéresse surtout, c’est le problème que ce poste cherche à résoudre : faire évoluer la collecte vers un modèle réellement 360°, où acquisition, fidélisation, data, expérience donateur et innovation ne fonctionnent plus en silos.',
      'C’est précisément à la croisée de ces enjeux que j’ai construit mon parcours chez Human Appeal France. Arrivée en 2019 en alternance sur la communication digitale, j’ai évolué comme Responsable marketing digital puis, depuis juin 2026, comme Directrice adjointe du marketing digital. Cette progression m’a conduite de l’exécution au pilotage de la performance, puis au management et à la structuration de la stratégie digitale.',
      'J’ai notamment piloté l’acquisition et la collecte digitale multicanale avec une forte culture du ROI, de la conversion et de l’optimisation des coûts, contribuant à une croissance de plus de 850 % des revenus de l’organisation entre 2020 et 2025. J’ai également managé une équipe de dix personnes et piloté les grands temps forts de collecte — Ramadan, urgences humanitaires et fin d’année — dans des contextes où performance, réactivité et expérience donateur doivent constamment s’équilibrer.',
      'La dimension innovation du poste fait particulièrement écho à la manière dont je souhaite poursuivre mon évolution : exploiter davantage la donnée pour arbitrer, tester et personnaliser ; automatiser ce qui peut l’être ; intégrer l’IA lorsqu’elle apporte un gain réel ; et surtout décloisonner les leviers pour construire une lecture plus globale de la performance et de la relation donateur.',
      'Enfin, ma candidature répond à un choix professionnel clair. L’humanitaire est le secteur dans lequel j’ai toujours souhaité construire ma carrière et dans lequel je souhaite continuer à évoluer. Après près de sept années au sein de Human Appeal France, j’ai envie de mettre l’expérience acquise au service d’un nouvel environnement, de confronter mes méthodes à d’autres pratiques et d’élargir mon impact.',
      'Le projet porté par le SIF représente à mes yeux cette possibilité : poursuivre cet engagement tout en franchissant une nouvelle étape vers un pilotage plus transversal de la collecte, de la performance et de l’innovation.',
      'Je serais ravie de pouvoir en échanger avec vous.',
    ],
    closing: 'Bien cordialement,',
    signature: 'Farah Elbid',
  },
}

export const cvSchemas = {
  cv: cvSchema,
  experience: experienceSchema,
  skillGroup: skillGroupSchema,
} as const
