import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Avec Vite, l'icône de marqueur par défaut de Leaflet ne trouve pas ses images :
// on la redéfinit une fois pour toutes les cartes de l'application.
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });

// Fond de carte OpenStreetMap : gratuit et sans clé API (les tuiles CARTO en exigent une désormais).
// L'attribution est obligatoire selon la politique d'usage d'OpenStreetMap.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
