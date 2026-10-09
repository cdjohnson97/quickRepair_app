import { FiSmartphone, FiMonitor, FiTablet, FiBatteryCharging, FiCpu, FiBell } from 'react-icons/fi';

// Outils / appareils qui gravitent autour de la clé à molette (page de connexion et écran de
// transition). `angle` : position en degrés sur le cercle ; `tone` : dégradé Tailwind de la pastille.
export const REPAIR_TOOLS = [
  { Icon: FiSmartphone, angle: 0, tone: 'from-sky-400 to-blue-600' },
  { Icon: FiMonitor, angle: 60, tone: 'from-indigo-400 to-violet-600' },
  { Icon: FiTablet, angle: 120, tone: 'from-cyan-400 to-sky-600' },
  { Icon: FiBatteryCharging, angle: 180, tone: 'from-emerald-400 to-teal-600' },
  { Icon: FiCpu, angle: 240, tone: 'from-fuchsia-400 to-purple-600' },
  { Icon: FiBell, angle: 300, tone: 'from-amber-400 to-orange-600' }
];
