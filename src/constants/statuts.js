// Couleurs par id_statut, partagées entre les dashboards (badges Tailwind + graphiques Recharts).
// Les libellés eux-mêmes restent en base (table `statuts`) : ce fichier ne fixe que le rendu visuel.

export const STATUS_BADGE_CLASSES = {
  1: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  2: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  4: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200',
  5: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  6: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  7: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200',
  8: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  9: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const getStatusBadgeColor = (idStatut) => STATUS_BADGE_CLASSES[idStatut] || STATUS_BADGE_CLASSES[1];

// Variante avec bordure colorée, utilisée par le suivi client (badges à bord épais).
export const STATUS_BORDER_BADGE_CLASSES = {
  1: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
  2: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700',
  3: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700',
  4: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900 dark:text-rose-200 dark:border-rose-700',
  5: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700',
  6: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-700',
  7: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900 dark:text-teal-200 dark:border-teal-700',
  8: 'bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
  9: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700',
};

export const getStatusBorderBadgeColor = (idStatut) => STATUS_BORDER_BADGE_CLASSES[idStatut] || STATUS_BORDER_BADGE_CLASSES[1];

// Mêmes familles de couleurs que STATUS_BADGE_CLASSES, en hex pour les graphiques Recharts.
export const STATUS_COLORS = {
  1: '#64748b', // slate - Déposé
  2: '#a855f7', // purple - Diagnostic
  3: '#eab308', // yellow - Devis envoyé
  4: '#f43f5e', // rose - En attente pièce
  5: '#3b82f6', // blue - En cours
  6: '#10b981', // emerald - Terminée
  7: '#14b8a6', // teal - Prête
  8: '#6b7280', // gray - Livrée
  9: '#ef4444', // red - Annulée
};
