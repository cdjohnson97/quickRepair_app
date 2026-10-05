const PALETTE = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500'
];

function colorFor(name) {
  const str = name || '?';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFor(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// Avatar réutilisable : photo si `url` fourni, sinon initiales colorées.
// `online` (true/false) affiche un point de statut ; laisser undefined pour ne rien afficher.
export default function Avatar({ url, name, size = 36, online }) {
  const dotSize = Math.max(8, Math.round(size * 0.28));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <img
          src={url}
          alt={name || 'avatar'}
          className="rounded-full object-cover w-full h-full border border-slate-200 dark:border-slate-700"
        />
      ) : (
        <div
          className={`rounded-full w-full h-full flex items-center justify-center text-white font-bold ${colorFor(name)}`}
          style={{ fontSize: size * 0.4 }}
        >
          {initialsFor(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-slate-800 ${online ? 'bg-emerald-500' : 'bg-slate-400'}`}
          style={{ width: dotSize, height: dotSize }}
        />
      )}
    </div>
  );
}
