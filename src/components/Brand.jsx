// Logo texte FiXeo : le « X » central en dégradé bleu. Utilisé sur la page de connexion,
// l'écran de transition et la barre de navigation.
export default function Brand({ className = '' }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      Fi<span className="bg-gradient-to-br from-sky-300 to-blue-500 bg-clip-text text-transparent">X</span>eo
    </span>
  );
}
