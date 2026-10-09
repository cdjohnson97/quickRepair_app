import Swal from 'sweetalert2';
import { isUrgentMessage } from './overdueRepairs';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Toast de notification pour un nouveau message : avatar (ou initiales) et texte côte à côte.
// Construit en `html` plutôt que `title`/`text`/`imageUrl` car SweetAlert2 ne place l'image
// qu'à côté du titre, pas du texte, ce qui donnait un rendu déséquilibré.
// `onClick`, si fourni, est appelé quand l'utilisateur clique le toast (ex: ouvrir le fil concerné).
// Un message d'urgence (voir utils/overdueRepairs.js) reste affiché plus longtemps, en rouge.
export function fireMessageToast(sender, contenu, onClick) {
  const urgent = isUrgentMessage(contenu);
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: urgent ? 12000 : 5000,
    timerProgressBar: true,
    customClass: { popup: urgent ? 'qr-message-toast qr-message-toast-urgent' : 'qr-message-toast' },
    didOpen: (toastEl) => {
      if (!onClick) return;
      toastEl.style.cursor = 'pointer';
      toastEl.addEventListener('click', () => {
        onClick();
        Swal.close();
      });
    }
  });

  const name = sender ? `${sender.prenom} ${sender.nom}` : null;
  const avatarHtml = sender?.avatar_url
    ? `<img src="${escapeHtml(sender.avatar_url)}" class="qr-toast-avatar" />`
    : `<div class="qr-toast-avatar qr-toast-avatar-fallback">${escapeHtml(name ? name.trim()[0].toUpperCase() : '?')}</div>`;

  Toast.fire({
    html: `
      <div class="qr-toast-row">
        ${avatarHtml}
        <div class="qr-toast-text">
          <p class="qr-toast-title">${urgent ? 'Message urgent ⚠️' : 'Nouveau message 💬'}</p>
          <p class="qr-toast-body">${name ? `<b>${escapeHtml(name)}</b> : ` : ''}${escapeHtml(contenu)}</p>
        </div>
      </div>
    `
  });
}
