function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTimeFr(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}h ${m}`;
}

// Texte de statut de connexion : "En ligne" si en ligne, sinon dernière connexion connue.
// Aujourd'hui -> juste l'heure ; hier -> "hier à HHhMM" ; sinon -> la date.
export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Jamais connecté';
  const date = new Date(lastSeen);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return `Dernière connexion à ${formatTimeFr(date)}`;
  }
  if (isSameDay(date, yesterday)) {
    return `Dernière connexion hier à ${formatTimeFr(date)}`;
  }

  return `Dernière connexion le ${date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  })}`;
}
