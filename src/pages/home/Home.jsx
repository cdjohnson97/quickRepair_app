import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import {
  FiSmartphone, FiTablet, FiMonitor, FiBatteryCharging, FiCpu, FiBell, FiSearch, FiArrowRight,
  FiMapPin, FiPhone, FiMail, FiCheckCircle, FiCheck, FiClock, FiLogIn, FiNavigation, FiMessageCircle
} from 'react-icons/fi';
import { apiClient } from '../../apiClient';
import Brand from '../../components/Brand';
import { STATUS_COLORS } from '../../constants/statuts';
import { TILE_URL, TILE_ATTRIBUTION } from '../../utils/leafletSetup';

// Page d'accueil publique (clients, hors entreprise) : présentation, services, boutiques,
// contact et accès au suivi de réparation. Aucune donnée privée : les boutiques viennent
// de la route publique GET /boutiques/public.

const SERVICES = [
  { Icon: FiSmartphone, title: 'Smartphones', text: 'Écran cassé, batterie fatiguée, connecteur de charge, caméra : nous remettons votre téléphone en état.' },
  { Icon: FiTablet, title: 'Tablettes', text: 'Vitre tactile, écran, batterie et boutons, avec des pièces adaptées à votre modèle.' },
  { Icon: FiMonitor, title: 'Ordinateurs', text: 'Portables et fixes : alimentation, écran, clavier, lenteurs, remplacement de disque.' },
  { Icon: FiBatteryCharging, title: 'Batterie et charge', text: 'Remplacement de batterie et réparation des connecteurs de charge.' },
  { Icon: FiCpu, title: 'Diagnostic et devis', text: 'Un technicien identifie la panne et vous envoie un devis avant toute intervention.' },
  { Icon: FiBell, title: 'Suivi en ligne', text: 'Avec votre numéro de suivi, suivez chaque étape et téléchargez votre facture.' }
];

const STEPS = [
  { Icon: FiMapPin, title: 'Déposez votre appareil', text: 'Dans la boutique FiXeo la plus proche. Vous repartez avec votre numéro de suivi.' },
  { Icon: FiSearch, title: 'Suivez la réparation', text: 'Diagnostic, devis, pièces, réparation : chaque étape apparaît en ligne avec les commentaires du technicien.' },
  { Icon: FiCheckCircle, title: 'Récupérez-le', text: 'Votre appareil est prêt : passez le chercher en boutique et téléchargez votre facture.' }
];

// Aperçu illustratif du suivi dans l'en-tête (pas de vraie donnée).
const DEMO_TIMELINE = [
  { id: 1, label: 'Déposé', done: true },
  { id: 2, label: 'Diagnostic', done: true },
  { id: 3, label: 'Devis accepté', done: true },
  { id: 5, label: 'En cours de réparation', current: true },
  { id: 7, label: 'Prête à récupérer' }
];

const hasCoords = (b) => b.latitude != null && b.longitude != null;
const telHref = (tel) => `tel:${tel.replace(/[^\d+]/g, '')}`;

// Apparition au défilement, désactivée si l'utilisateur préfère réduire les animations.
function Reveal({ as = 'div', children, delay = 0, className = '' }) {
  const reduceMotion = useReducedMotion();
  const Tag = reduceMotion ? as : motion[as];
  const animation = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: 0.5, delay }
      };
  return (
    <Tag className={className} {...animation}>
      {children}
    </Tag>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-sky-400">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-slate-500 dark:text-slate-400">{text}</p>}
    </Reveal>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#accueil" aria-label="FiXeo — haut de page">
          <Brand className="text-2xl text-slate-900 dark:text-white" />
        </a>
        <nav aria-label="Sections de la page" className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
          <a href="#services" className="transition hover:text-blue-600 dark:hover:text-sky-400">Services</a>
          <a href="#fonctionnement" className="transition hover:text-blue-600 dark:hover:text-sky-400">Comment ça marche</a>
          <a href="#boutiques" className="transition hover:text-blue-600 dark:hover:text-sky-400">Nos boutiques</a>
          <a href="#contact" className="transition hover:text-blue-600 dark:hover:text-sky-400">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white sm:flex">
            <FiLogIn /> Espace employés
          </Link>
          <Link to="/client" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            Suivre mon appareil
          </Link>
        </div>
      </div>
    </header>
  );
}

function TrackingPreview() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm" aria-hidden="true">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200/70">Exemple de suivi</p>
          <p className="mt-1 font-mono text-lg font-bold text-white">QR-48213</p>
        </div>
        <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-sky-300 ring-1 ring-sky-400/30">iPhone 13</span>
      </div>
      <ol className="space-y-4">
        {DEMO_TIMELINE.map((step) => (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: step.done || step.current ? STATUS_COLORS[step.id] : 'rgba(255,255,255,0.1)' }}
            >
              {step.current && !reduceMotion && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[step.id] }}
                  animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              {step.done ? <FiCheck className="relative" /> : step.current ? <FiClock className="relative" /> : null}
            </span>
            <span className={step.done || step.current ? 'font-medium text-white' : 'text-blue-100/50'}>{step.label}</span>
            {step.current && <span className="ml-auto text-xs font-semibold text-sky-300">En ce moment</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [numero, setNumero] = useState('');

  const handleTrack = (e) => {
    e.preventDefault();
    const value = numero.trim();
    navigate(value ? `/client?numero=${encodeURIComponent(value)}` : '/client');
  };

  return (
    <section id="accueil" className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/25 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-blue-200/70">Réseau d'ateliers de réparation</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            Votre appareil réparé,{' '}
            <span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">suivi à chaque étape.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-blue-100/80">
            Smartphones, tablettes, ordinateurs : déposez votre appareil dans l'une de nos boutiques et suivez sa réparation
            en ligne, du diagnostic jusqu'à la facture.
          </p>

          <form onSubmit={handleTrack} className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
            <label htmlFor="home-tracking" className="sr-only">Numéro de suivi</label>
            <div className="relative flex-1">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="home-tracking"
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value.toUpperCase())}
                placeholder="N° de suivi (ex : QR-12345)"
                className="w-full rounded-xl border border-white/10 bg-white py-3.5 pl-11 pr-4 font-semibold uppercase text-slate-900 outline-none placeholder:font-normal placeholder:normal-case placeholder:text-slate-400 focus:ring-4 focus:ring-sky-400/40"
              />
            </div>
            <button type="submit" className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3.5 font-semibold shadow-lg shadow-blue-900/40 transition hover:shadow-xl">
              Suivre mon appareil
              <FiArrowRight className="transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          <a href="#contact" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-white">
            <FiMessageCircle /> Une question ? Contacter le service
          </a>
        </motion.div>

        <motion.div
          className="mx-auto w-full max-w-md"
          initial={reduceMotion ? false : { opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <TrackingPreview />
        </motion.div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionTitle
          eyebrow="Nos services"
          title="Tout ce qui se répare, on s'en occupe"
          text="Nos techniciens interviennent sur vos appareils du quotidien, avec un devis avant chaque réparation."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service, i) => {
            const { Icon, title, text } = service;
            return (
              <Reveal key={title} delay={i * 0.05}>
                <article className="h-full rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl text-blue-600 dark:bg-blue-900/40 dark:text-sky-400">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="fonctionnement" className="scroll-mt-20 bg-white px-4 py-20 dark:bg-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionTitle eyebrow="Comment ça marche" title="Trois étapes, zéro surprise" />
        <ol className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const { Icon, title, text } = step;
            return (
              <Reveal as="li" key={title} delay={i * 0.1} className="text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl text-white shadow-lg shadow-blue-600/25">
                  <Icon aria-hidden="true" />
                </span>
                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-sky-400">Étape {i + 1}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">{text}</p>
              </Reveal>
            );
          })}
        </ol>
        <Reveal className="mt-12 text-center">
          <Link to="/client" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700">
            Suivre mon appareil <FiArrowRight />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// Cadre la carte sur toutes les boutiques, puis sur celle sélectionnée dans la liste.
function MapFocus({ points, selected }) {
  const map = useMap();
  useEffect(() => {
    if (selected) map.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.8 });
    else if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40] });
  }, [map, points, selected]);
  return null;
}

function BoutiqueCard({ boutique, active, onSelect }) {
  const located = hasCoords(boutique);
  return (
    <article
      className={`rounded-2xl border bg-white p-5 transition dark:bg-slate-900 ${
        active ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(boutique.id_boutique)}
        disabled={!located}
        className="w-full text-left disabled:cursor-default"
        aria-label={located ? `Voir ${boutique.nom} sur la carte` : undefined}
      >
        <h3 className="font-semibold text-slate-900 dark:text-white">{boutique.nom}</h3>
        {(boutique.adresse || boutique.ville) && (
          <p className="mt-1 flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
            <FiMapPin className="mt-0.5 shrink-0" aria-hidden="true" />
            {[boutique.adresse, boutique.ville].filter(Boolean).join(', ')}
          </p>
        )}
      </button>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {boutique.telephone && (
          <a href={telHref(boutique.telephone)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-900/40">
            <FiPhone aria-hidden="true" /> {boutique.telephone}
          </a>
        )}
        {located && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${boutique.latitude},${boutique.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-900/40"
          >
            <FiNavigation aria-hidden="true" /> Itinéraire
          </a>
        )}
      </div>
    </article>
  );
}

function Boutiques({ boutiques, status }) {
  const [selectedId, setSelectedId] = useState(null);
  const located = useMemo(() => boutiques.filter(hasCoords), [boutiques]);
  const points = useMemo(() => located.map((b) => [b.latitude, b.longitude]), [located]);
  const selected = located.find((b) => b.id_boutique === selectedId) || null;

  return (
    <section id="boutiques" className="scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionTitle
          eyebrow="Nos boutiques"
          title="Un atelier FiXeo près de chez vous"
          text="Déposez votre appareil dans la boutique de votre choix : c'est elle qui assure la réparation et vous tient informé."
        />

        {status === 'loading' && <p className="text-center text-slate-500 dark:text-slate-400">Chargement des boutiques…</p>}
        {status === 'error' && (
          <p role="alert" className="text-center text-slate-500 dark:text-slate-400">
            La liste des boutiques est momentanément indisponible. Réessayez dans quelques instants.
          </p>
        )}

        {status === 'ready' && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="max-h-[480px] space-y-4 overflow-y-auto pr-1 lg:col-span-2">
              {boutiques.map((b) => (
                <BoutiqueCard key={b.id_boutique} boutique={b} active={b.id_boutique === selectedId} onSelect={setSelectedId} />
              ))}
            </div>
            <div className="relative z-0 h-[360px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 lg:col-span-3 lg:h-[480px]">
              <MapContainer center={[46.6, 2.4]} zoom={6} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
                <MapFocus points={points} selected={selected} />
                {located.map((b) => (
                  <Marker key={b.id_boutique} position={[b.latitude, b.longitude]} eventHandlers={{ click: () => setSelectedId(b.id_boutique) }}>
                    <Popup>
                      <strong>{b.nom}</strong>
                      {b.adresse && <><br />{b.adresse}</>}
                      {b.ville && <><br />{b.ville}</>}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Contact({ boutiques, status }) {
  const reachable = useMemo(() => boutiques.filter((b) => b.telephone || b.email_contact), [boutiques]);
  const [selectedId, setSelectedId] = useState('');
  const boutique = reachable.find((b) => String(b.id_boutique) === selectedId) || reachable[0];

  return (
    <section id="contact" className="scroll-mt-20 px-4 pb-20 sm:px-6">
      <Reveal className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-xl shadow-blue-600/20 sm:p-12">
        <h2 className="text-3xl font-bold">Contacter le service</h2>
        <p className="mt-3 max-w-xl text-blue-100">
          Une question sur une réparation, un devis ou un délai ? Choisissez votre boutique et appelez-la ou écrivez-lui
          directement. Pensez à indiquer votre numéro de suivi.
        </p>

        {status === 'ready' && boutique ? (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="contact-boutique" className="mb-1.5 block text-sm font-semibold text-blue-100">Votre boutique</label>
              <select
                id="contact-boutique"
                value={String(boutique.id_boutique)}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-xl border-0 bg-white px-4 py-3 font-medium text-slate-900 outline-none focus:ring-4 focus:ring-sky-300/50"
              >
                {reachable.map((b) => (
                  <option key={b.id_boutique} value={String(b.id_boutique)}>
                    {b.nom}{b.ville ? ` — ${b.ville}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {boutique.telephone && (
              <a href={telHref(boutique.telephone)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-blue-700 transition hover:bg-blue-50">
                <FiPhone aria-hidden="true" /> Appeler
              </a>
            )}
            {boutique.email_contact && (
              <a
                href={`mailto:${boutique.email_contact}?subject=${encodeURIComponent('Demande d\'information — FiXeo')}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/25"
              >
                <FiMail aria-hidden="true" /> Écrire un e-mail
              </a>
            )}
          </div>
        ) : (
          <p className="mt-8 text-blue-100">
            {status === 'loading' ? 'Chargement des coordonnées…' : 'Rendez-vous directement dans l\'une de nos boutiques.'}
          </p>
        )}

        <Link to="/client" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white/90 underline-offset-4 hover:underline">
          Vous avez un numéro de suivi ? Suivre mon appareil <FiArrowRight aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 px-4 py-8 dark:border-slate-800 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400 sm:flex-row">
        <p>© {new Date().getFullYear()} FiXeo S.A.S. — Réseau d'ateliers de réparation</p>
        <nav aria-label="Liens de pied de page" className="flex gap-5">
          <Link to="/client" className="hover:text-blue-600 dark:hover:text-sky-400">Suivre mon appareil</Link>
          <a href="#contact" className="hover:text-blue-600 dark:hover:text-sky-400">Contact</a>
          <Link to="/login" className="hover:text-blue-600 dark:hover:text-sky-400">Espace employés</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function Home() {
  const [boutiques, setBoutiques] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/boutiques/public')
      .then(({ data }) => {
        if (cancelled) return;
        setBoutiques(data);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <SiteHeader />
      <main>
        <Hero />
        <Services />
        <HowItWorks />
        <Boutiques boutiques={boutiques} status={status} />
        <Contact boutiques={boutiques} status={status} />
      </main>
      <SiteFooter />
    </div>
  );
}
