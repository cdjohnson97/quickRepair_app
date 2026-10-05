// Équivalent RN de src/constants/statuts.js (web) : mêmes couleurs par id_statut,
// via des classes NativeWind au lieu de classes Tailwind DOM.
export const STATUS_BADGE_CLASSES = {
  1: 'bg-slate-100 text-slate-700',
  2: 'bg-purple-100 text-purple-700',
  3: 'bg-yellow-100 text-yellow-800',
  4: 'bg-rose-100 text-rose-700',
  5: 'bg-blue-100 text-blue-700',
  6: 'bg-emerald-100 text-emerald-700',
  7: 'bg-teal-100 text-teal-700',
  8: 'bg-gray-200 text-gray-800',
  9: 'bg-red-100 text-red-800'
};

export const getStatusBadgeColor = (idStatut) => STATUS_BADGE_CLASSES[idStatut] || STATUS_BADGE_CLASSES[1];

export const TERMINATED_STATUS_IDS = [6, 8];
