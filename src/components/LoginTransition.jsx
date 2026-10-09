// eslint-disable-next-line no-unused-vars -- `motion` est utilisé en JSX (<motion.div>), que la config ESLint ne détecte pas.
import { motion, useReducedMotion } from 'framer-motion';
import { FiTool } from 'react-icons/fi';
import Brand from './Brand';
import { REPAIR_TOOLS } from './repairTools';

const ORBIT_RADIUS = 115;
// Durée de l'animation avant de pouvoir afficher le tableau de bord (en secondes).
const DURATION = 2.4;

// Écran plein page joué juste après la connexion : les outils de la page de connexion jaillissent
// de la clé à molette, se mettent en orbite, puis la barre de progression appelle `onFinished`.
export default function LoginTransition({ label, onFinished }) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0.6 : DURATION;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[4000] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-6 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 1.04 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {/* Halos et trame de points, comme sur la page de connexion */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/25 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      <div className="relative h-[300px] w-[300px]" aria-hidden="true">
        <motion.div
          className="absolute inset-[35px] rounded-full border border-dashed border-white/15"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        />

        {/* Centre : clé à molette qui pulse */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          {!reduceMotion && (
            <motion.div
              className="absolute inset-0 rounded-3xl bg-blue-500/40"
              animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <motion.div
            className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-900/50"
            initial={{ scale: 0, rotate: -90 }}
            animate={reduceMotion ? { scale: 1, rotate: 0 } : { scale: 1, rotate: [-90, 0, -15, 15, 0] }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          >
            <FiTool className="text-4xl text-white" />
          </motion.div>
        </div>

        {/* Outils : partent du centre vers l'orbite, puis l'anneau tourne */}
        <motion.div
          className="absolute inset-0"
          animate={reduceMotion ? {} : { rotate: 120 }}
          transition={{ duration: DURATION + 1, ease: 'easeInOut' }}
        >
          {REPAIR_TOOLS.map((tool, i) => {
            const { Icon: ToolIcon, angle, tone } = tool;
            const rad = (angle * Math.PI) / 180;
            return (
              <motion.div
                key={angle}
                className="absolute left-1/2 top-1/2 -ml-6 -mt-6"
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                animate={{ x: Math.cos(rad) * ORBIT_RADIUS, y: Math.sin(rad) * ORBIT_RADIUS, opacity: 1, scale: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.45 + i * 0.1, type: 'spring', stiffness: 170, damping: 14 }}
              >
                <motion.div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} shadow-lg shadow-black/30 ring-1 ring-white/20`}
                  animate={reduceMotion ? {} : { rotate: -120, y: [0, -6, 0] }}
                  transition={{
                    rotate: { duration: DURATION + 1, ease: 'easeInOut' },
                    y: { duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }
                  }}
                >
                  <ToolIcon className="text-xl text-white" />
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <motion.div
        className="relative mt-6 flex w-full max-w-xs flex-col items-center text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <Brand className="text-4xl" />
        <p className="mt-3 text-sm text-blue-100/80">{label}</p>

        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sky-300 to-blue-500"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration, ease: 'easeInOut' }}
            onAnimationComplete={onFinished}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
