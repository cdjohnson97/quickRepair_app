import { formatLastSeen } from './lastSeen';
import { formatDateRangeFr, getAvailability } from './calendarEvents';

// Port de src/utils/statusLine.js (web) : combine présence temps réel + disponibilité
// calendrier en une seule ligne de statut, réutilisée par les fiches employé.
export const STATUS_LINE_CLASSES = {
  busy: 'text-amber-600 font-semibold',
  online: 'text-emerald-500 font-semibold',
  offline: 'text-slate-400'
};

export function getStatusLine({ online, events, idEmploye, lastSeen }) {
  const avail = getAvailability(events, idEmploye);

  if (avail.busy) {
    const suffix = `Occupé jusqu'au ${formatDateRangeFr(avail.until, avail.until)}`;
    return { text: online ? `En ligne · ${suffix}` : suffix, className: STATUS_LINE_CLASSES.busy };
  }
  if (online) {
    return { text: 'En ligne', className: STATUS_LINE_CLASSES.online };
  }
  return { text: formatLastSeen(lastSeen), className: STATUS_LINE_CLASSES.offline };
}
