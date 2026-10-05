// Envoie une notification push via l'API Expo, directement depuis le client (pas de backend
// dédié dans ce projet). N'échoue jamais bruyamment : un jeton manquant/expiré est loggé,
// pas remonté, pour ne jamais bloquer l'action principale (envoi de message, assignation).
export async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: pushToken, sound: 'default', title, body, data })
    });
  } catch (error) {
    console.warn('Envoi de la notification push impossible :', error.message);
  }
}
