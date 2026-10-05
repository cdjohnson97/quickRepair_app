// Trois points qui rebondissent en cascade (façon Messenger/WhatsApp), réutilisés
// dans la bulle de frappe du fil de discussion et sur les cartes du tableau de bord.
export default function TypingDots({ size = 6, className = 'bg-slate-400 dark:bg-slate-500' }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full animate-bounce ${className}`} style={{ width: size, height: size, animationDelay: '0ms' }} />
      <span className={`rounded-full animate-bounce ${className}`} style={{ width: size, height: size, animationDelay: '150ms' }} />
      <span className={`rounded-full animate-bounce ${className}`} style={{ width: size, height: size, animationDelay: '300ms' }} />
    </span>
  );
}
