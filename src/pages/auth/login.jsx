import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars -- `motion` est utilisé en JSX (<motion.div>), que la config ESLint ne détecte pas.
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  FiBell, FiTool, FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, FiSearch,
  FiZap, FiUsers, FiShield
} from 'react-icons/fi';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useLoginTransition } from '../../context/LoginTransitionContext';
import { getMfaStatus, getVerifiedFactorId, openApiSession, startEnrollment, verifyCode } from '../../utils/mfa';
import Brand from '../../components/Brand';
import { REPAIR_TOOLS } from '../../components/repairTools';

const ORBIT_RADIUS = 150;
const ORBIT_DURATION = 40;

// Messages qui défilent sous l'animation.
const HIGHLIGHTS = [
  { Icon: FiZap, text: 'Suivi des réparations en temps réel' },
  { Icon: FiBell, text: 'Techniciens notifiés dès l’assignation' },
  { Icon: FiUsers, text: 'Planning et messagerie d’équipe' },
  { Icon: FiShield, text: 'Accès sécurisé selon votre rôle' }
];

function RepairOrbit({ reduceMotion }) {
  const spin = reduceMotion ? {} : { rotate: 360 };
  const counterSpin = reduceMotion ? {} : { rotate: -360 };
  const spinTransition = { duration: ORBIT_DURATION, repeat: Infinity, ease: 'linear' };

  return (
    <div className="relative mx-auto h-[380px] w-[380px]" aria-hidden="true">
      {/* Cercles décoratifs */}
      <div className="absolute inset-[40px] rounded-full border border-white/10" />
      <div className="absolute inset-[85px] rounded-full border border-dashed border-white/10" />

      {/* Centre : clé à molette + halo pulsé */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {!reduceMotion && (
          <motion.div
            className="absolute inset-0 rounded-3xl bg-blue-500/40"
            animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <motion.div
          className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-900/50"
          animate={reduceMotion ? {} : { rotate: [0, -12, 12, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
        >
          <FiTool className="text-5xl text-white" />
        </motion.div>
      </div>

      {/* Anneau en rotation ; chaque icône tourne en sens inverse pour rester droite */}
      <motion.div className="absolute inset-0" animate={spin} transition={spinTransition}>
        {REPAIR_TOOLS.map((satellite, i) => {
          const { Icon: SatelliteIcon, angle, tone } = satellite;
          const rad = (angle * Math.PI) / 180;
          return (
            <div
              key={angle}
              className="absolute"
              style={{
                left: `calc(50% + ${Math.cos(rad) * ORBIT_RADIUS}px)`,
                top: `calc(50% + ${Math.sin(rad) * ORBIT_RADIUS}px)`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <motion.div animate={counterSpin} transition={spinTransition}>
                <motion.div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} shadow-lg shadow-black/30 ring-1 ring-white/20`}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: [0, -8, 0] }}
                  transition={{
                    opacity: { delay: 0.3 + i * 0.12, duration: 0.5 },
                    scale: { delay: 0.3 + i * 0.12, type: 'spring', stiffness: 260, damping: 18 },
                    y: { duration: 3 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }
                  }}
                >
                  <SatelliteIcon className="text-2xl text-white" />
                </motion.div>
              </motion.div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

function ShowcasePanel({ reduceMotion }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % HIGHLIGHTS.length), 3500);
    return () => clearInterval(id);
  }, []);

  const { Icon: HighlightIcon, text } = HIGHLIGHTS[index];

  return (
    <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 lg:flex lg:flex-col lg:justify-between p-12 xl:p-16 text-white">
      {/* Halos lumineux animés */}
      <motion.div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl"
        animate={reduceMotion ? {} : { x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/25 blur-3xl"
        animate={reduceMotion ? {} : { x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Trame de points */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      <motion.div
        className="relative"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Brand className="text-4xl" />
        <p className="mt-2 text-sm font-medium uppercase tracking-[0.25em] text-blue-200/70">Réseau d'ateliers de réparation</p>
      </motion.div>

      <div className="relative">
        <RepairOrbit reduceMotion={reduceMotion} />
      </div>

      <div className="relative max-w-md">
        <motion.h1
          className="text-3xl xl:text-4xl font-bold leading-tight"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Du dépôt de l'appareil<br />
          <span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">jusqu'à la facture.</span>
        </motion.h1>

        <div className="mt-6 h-8">
          <AnimatePresence mode="wait">
            <motion.p
              key={index}
              className="flex items-center gap-3 text-base text-blue-100/90"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <HighlightIcon className="shrink-0 text-xl text-sky-300" />
              {text}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex gap-2" aria-hidden="true">
          {HIGHLIGHTS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-8 bg-sky-300' : 'w-3 bg-white/20'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// Saisie du code à 6 chiffres (activation et connexion).
function CodeInput({ value, onChange, inputClass }) {
  return (
    <div>
      <label htmlFor="login-code" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        Code à 6 chiffres
      </label>
      <div className="relative">
        <FiShield className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id="login-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className={`${inputClass} font-mono text-lg tracking-[0.5em]`}
          placeholder="000000"
        />
      </div>
    </div>
  );
}

// Première activation : QR code à scanner avec l'application d'authentification.
function EnrollInstructions({ enrollment }) {
  const [showSecret, setShowSecret] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <li><span className="font-semibold text-slate-900 dark:text-white">1.</span> Installez une application d'authentification (Google Authenticator, Microsoft Authenticator, Authy…).</li>
        <li><span className="font-semibold text-slate-900 dark:text-white">2.</span> Scannez ce QR code avec l'application.</li>
        <li><span className="font-semibold text-slate-900 dark:text-white">3.</span> Saisissez le code à 6 chiffres qu'elle affiche.</li>
      </ol>
      <div className="mt-4 flex justify-center">
        <img src={enrollment.qrCode} alt="QR code d'activation de la double authentification" className="h-44 w-44 rounded-xl bg-white p-2" />
      </div>
      <button
        type="button"
        onClick={() => setShowSecret((v) => !v)}
        className="mt-3 w-full text-center text-xs font-semibold text-blue-600 hover:underline dark:text-sky-400"
      >
        {showSecret ? 'Masquer la clé' : 'Impossible de scanner ? Afficher la clé à saisir'}
      </button>
      {showSecret && (
        <p className="mt-2 break-all rounded-lg bg-slate-100 p-2 text-center font-mono text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          {enrollment.secret}
        </p>
      )}
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Étapes : 'password' → 'enroll' (première activation du 2FA) ou 'challenge' (code) → tableau de bord.
  const [step, setStep] = useState('password');
  const [enrollment, setEnrollment] = useState(null); // { factorId, qrCode, secret }
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState('');
  const { playLoginTransition } = useLoginTransition();
  const { user, mfaVerified, loading: authLoading } = useAuth();
  const reduceMotion = useReducedMotion();
  const resumed = useRef(false);

  // Après le mot de passe : code à saisir si le 2FA est activé, sinon activation obligatoire.
  const goToSecondFactor = async () => {
    const { verified, enrolled } = await getMfaStatus();
    if (verified) return finishLogin();
    if (enrolled) {
      setFactorId(await getVerifiedFactorId());
      setStep('challenge');
    } else {
      setEnrollment(await startEnrollment());
      setStep('enroll');
    }
  };

  // Session déjà ouverte au mot de passe (page rechargée, ou renvoyé ici par une page protégée) :
  // on reprend directement à l'étape du code.
  useEffect(() => {
    if (authLoading || !user || mfaVerified || resumed.current) return;
    resumed.current = true;
    goToSecondFactor().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule reprise par visite
  }, [authLoading, user, mfaVerified]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Bloque la reprise automatique (useEffect ci-dessus) : c'est ce gestionnaire qui enchaîne.
    resumed.current = true;
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      await goToSecondFactor();
    } catch (err) {
      resumed.current = false;
      console.error("Erreur de connexion:", err.message);
      setError("Identifiants incorrects. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await verifyCode(step === 'enroll' ? enrollment.factorId : factorId, code);
      await finishLogin();
    } catch (err) {
      console.error('Code 2FA refusé :', err.message);
      setError('Code incorrect ou expiré. Saisissez le code actuellement affiché par votre application.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  // Session aal2 obtenue : jeton de l'API puis redirection vers le tableau de bord du rôle.
  const finishLogin = async () => {
    // Non bloquant : si l'API est indisponible, l'app fonctionne sur Supabase seul
    // (messagerie/présence/calendrier), seul le module Réparations serait affecté.
    try {
      await openApiSession();
    } catch (apiErr) {
      console.error('Connexion au backend Réparations impossible :', apiErr.message);
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { data: employe } = await supabase
      .from('employes')
      .select('role')
      .eq('email', authUser.email)
      .maybeSingle();

    if (employe?.role === 'Administrateur') {
      playLoginTransition('/admin', 'Ouverture de l’administration…');
    } else if (employe?.role === 'Technicien') {
      playLoginTransition('/technicien', 'Préparation de votre atelier…');
    } else if (employe) {
      playLoginTransition('/manager', 'Préparation de votre boutique…');
    } else {
      playLoginTransition('/client', 'Chargement de votre suivi…');
    }
  };

  // Abandon de l'étape du code : on ferme la session ouverte par le mot de passe.
  const cancelSecondFactor = async () => {
    await supabase.auth.signOut();
    setStep('password');
    setEnrollment(null);
    setFactorId(null);
    setCode('');
    setPassword('');
    setError(null);
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-50 dark:bg-slate-950 lg:grid-cols-2">
      <ShowcasePanel reduceMotion={reduceMotion} />

      <main className="relative flex flex-col px-6 pt-8 pb-24 sm:px-12 lg:pb-8">
        {/* Logo visible seulement sur petit écran (le panneau animé est masqué). Le bouton de thème
            clair/sombre est global à l'application (App.jsx). */}
        <Brand className="text-2xl text-slate-900 dark:text-white lg:hidden" />

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, x: reduceMotion ? 0 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-sky-400">
              {step === 'password' ? 'Espace employés' : 'Double authentification'}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {step === 'password' && 'Bon retour parmi nous'}
              {step === 'enroll' && 'Sécurisez votre compte'}
              {step === 'challenge' && 'Vérification en deux étapes'}
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400">
              {step === 'password' && 'Connectez-vous pour accéder à votre atelier.'}
              {step === 'enroll' && 'La double authentification est obligatoire. Activez-la une fois : à chaque connexion, votre application vous donnera un code.'}
              {step === 'challenge' && 'Saisissez le code à 6 chiffres affiché par votre application d’authentification.'}
            </p>

            <AnimatePresence>
              {error && (
                <motion.div
                  key={error}
                  role="alert"
                  className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0, x: reduceMotion ? 0 : [0, -8, 8, -5, 5, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {step === 'password' ? (
            <>
            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="jean.dupont@fixeo.fr"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Mot de passe
                </label>
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-12`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={loading || reduceMotion ? {} : { y: -2 }}
                whileTap={loading ? {} : { scale: 0.98 }}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Connexion en cours…
                  </>
                ) : (
                  <>
                    Se connecter
                    <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </motion.button>
            </form>

            <Link
              to="/client"
              className="mt-8 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-sky-400">
                <FiSearch className="text-xl" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-slate-900 dark:text-white">Vous êtes client ?</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">Suivez votre réparation avec votre numéro de suivi</span>
              </span>
              <FiArrowRight className="text-slate-400" />
            </Link>
            </>
            ) : (
              <form onSubmit={handleCode} className="mt-8 space-y-5">
                {step === 'enroll' && enrollment && <EnrollInstructions enrollment={enrollment} />}
                <CodeInput value={code} onChange={setCode} inputClass={inputClass} />

                <motion.button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  whileHover={loading || reduceMotion ? {} : { y: -2 }}
                  whileTap={loading ? {} : { scale: 0.98 }}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:shadow-xl hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Vérification…
                    </>
                  ) : (
                    <>
                      {step === 'enroll' ? 'Activer et continuer' : 'Vérifier'}
                      <FiArrowRight className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </motion.button>

                <div className="flex flex-col items-center gap-2 text-sm">
                  {step === 'challenge' && (
                    <p className="text-center text-slate-500 dark:text-slate-400">
                      Téléphone perdu ou changé ? Contactez l'administrateur pour réinitialiser votre double authentification.
                    </p>
                  )}
                  <button type="button" onClick={cancelSecondFactor} className="font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Annuler et changer de compte
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} FiXeo S.A.S. — Besoin d'aide ? Contactez l'administrateur.
        </p>
      </main>
    </div>
  );
}
