export const MIXED_CATEGORY = 'Repas mixte (8.1%+2.6%)';
export const CATEGORY_26 = 'Repas 2.6%';
export const PAYERS = ['Robin', 'Malek', 'Kurt'] as const;
export type Payer = typeof PAYERS[number];

export const CATEGORIES = [
  'Repas 8.1%',
  'Repas 2.6%',
  'Repas mixte (8.1%+2.6%)',
  'Frais de représentation',
  'Frais de déplacements',
  'Frais de bureau',
] as const;

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const DROPBOX_BASE_PATH = '/Tickets';
