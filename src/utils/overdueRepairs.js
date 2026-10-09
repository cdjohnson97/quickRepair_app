import { supabase } from '../supabaseClient';
import { toISODate } from './calendarEvents';

// Préfixe des messages d'urgence envoyés depuis l'alerte « réparations en retard » du manager.
// Sert à les repérer pour les afficher en rouge (bulle de conversation, notification).
export const URGENT_PREFIX = '⚠️ URGENT';

export const isUrgentMessage = (contenu) => typeof contenu === 'string' && contenu.startsWith(URGENT_PREFIX);

const CLOSED_STATUSES = [6, 8];

// Réparations non clôturées dont l'échéance (fin du dernier bloc « réparation » du calendrier)
// est passée ou tombe aujourd'hui. Renvoie [{ rep, due: 'AAAA-MM-JJ', daysLate }], les plus en
// retard d'abord (daysLate = 0 → à rendre aujourd'hui). Une réparation sans bloc planifié est ignorée.
export async function fetchOverdueRepairs(repairs) {
  const openRepairs = repairs.filter((r) => !CLOSED_STATUSES.includes(r.id_statut_actuel));
  if (openRepairs.length === 0) return [];

  const { data, error } = await supabase
    .from('calendrier_evenements')
    .select('id_reparation, date_fin')
    .eq('type', 'reparation')
    .in('id_reparation', openRepairs.map((r) => r.id_reparation));
  if (error) {
    console.error('Erreur lors du calcul des retards :', error.message);
    return [];
  }

  // Une réparation replanifiée a plusieurs blocs : on garde l'échéance la plus tardive.
  const dueByRepair = new Map();
  (data || []).forEach((ev) => {
    const current = dueByRepair.get(ev.id_reparation);
    if (!current || ev.date_fin > current) dueByRepair.set(ev.id_reparation, ev.date_fin);
  });

  const todayIso = toISODate(new Date());
  return openRepairs
    .filter((rep) => dueByRepair.has(rep.id_reparation) && dueByRepair.get(rep.id_reparation) <= todayIso)
    .map((rep) => {
      const due = dueByRepair.get(rep.id_reparation);
      return { rep, due, daysLate: Math.round((Date.parse(todayIso) - Date.parse(due)) / 86400000) };
    })
    .sort((a, b) => b.daysLate - a.daysLate);
}

export function formatDueDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
