import { formatLastSeen } from './lastSeen';
import { formatDateRangeFr, getAvailability } from './calendarEvents';

// Classes de couleur par statut, adaptées au fond (carte claire vs en-tête sombre).
export const STATUS_LINE_CLASSES = {
  card: { busy: 'text-amber-600 dark:text-amber-400 font-semibold', online: 'text-emerald-500 font-semibold', offline: 'text-slate-400' },
  darkHeader: { busy: 'text-amber-400 font-semibold', online: 'text-emerald-400 font-semibold', offline: 'text-slate-300' }
};

// Combine présence temps réel + disponibilité calendrier en une seule ligne de statut,
// réutilisée par les cartes/fiches équipe (Manager, Admin).
export function getStatusLine({ online, events, idEmploye, lastSeen, variant = 'card' }) {
  const avail = getAvailability(events, idEmploye);
  const classes = STATUS_LINE_CLASSES[variant];

  if (avail.busy) {
    const suffix = `Occupé jusqu'au ${formatDateRangeFr(avail.until, avail.until)}`;
    return { text: online ? `En ligne · ${suffix}` : suffix, className: classes.busy };
  }
  if (online) {
    return { text: 'En ligne', className: classes.online };
  }
  return { text: formatLastSeen(lastSeen), className: classes.offline };
}
