import { Fragment, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { FiSend, FiCheck, FiSmile, FiThumbsUp } from 'react-icons/fi';
import Avatar from './Avatar';
import TypingDots from './TypingDots';
import { sendPushNotification } from '../utils/pushNotifications';
import { useAuth } from '../context/AuthContext';

const TYPING_BROADCAST_THROTTLE_MS = 2000;
const TYPING_INDICATOR_TIMEOUT_MS = 3000;
const LIKE_EMOJI = '👍';

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "Aujourd'hui" / "Hier" / date complète, pour regrouper les messages par jour
// au lieu de répéter la date dans chaque bulle.
function getDateLabel(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Aujourd'hui";
  if (isSameDay(date, yesterday)) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
}

const EMOJIS = [
  '😀', '😂', '😍', '😊', '😉', '😢', '😭', '😡',
  '👍', '👎', '🙏', '👏', '🎉', '❤️', '🔥', '💯',
  '😴', '🤔', '😅', '😎', '🤝', '🙌', '👌', '😱',
  '🥳', '😇', '🤗', '😬', '🚀', '✅', '⏰', '🛠️'
];

// Fil de conversation à deux entre currentUserId et otherUserId (table `messages`).
// Réutilisé côté manager (fiche technicien) et côté technicien (espace personnel).
export default function MessageThread({ currentUserId, otherUserId, otherUserName, otherUserAvatar }) {
  const { userData } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  const typingOutboxRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    let active = true;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(id_expediteur.eq.${currentUserId},id_destinataire.eq.${otherUserId}),and(id_expediteur.eq.${otherUserId},id_destinataire.eq.${currentUserId})`)
        .order('date_envoi', { ascending: true });

      if (!active) return;
      if (error) {
        console.error("Erreur lors du chargement des messages :", error.message);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    const markAsRead = async () => {
      await supabase
        .from('messages')
        .update({ lu: true })
        .eq('id_destinataire', currentUserId)
        .eq('id_expediteur', otherUserId)
        .eq('lu', false);
    };

    fetchMessages();
    markAsRead();

    // Nom de canal symétrique : les deux participants doivent rejoindre le même topic
    // pour que les messages broadcast (frappe) se propagent entre eux.
    const pairKey = [currentUserId, otherUserId].sort((a, b) => a - b).join('-');
    const channel = supabase.channel(`thread-${pairKey}`);
    channelRef.current = channel;

    // Canal dédié à l'envoi de "je tape" vers la boîte de l'autre personne : reste actif
    // même si l'autre n'a pas ce fil ouvert (écouté globalement par useTypingIndicator,
    // ex. sur le tableau de bord manager).
    const typingOutbox = supabase.channel(`typing-inbox-${otherUserId}`);
    typingOutboxRef.current = typingOutbox;
    typingOutbox.subscribe();

    const applyUpdate = (payload) => {
      const msg = payload.new;
      if (msg.id_expediteur !== otherUserId && msg.id_destinataire !== otherUserId) return;
      setMessages((prev) => prev.map((m) => (m.id_message === msg.id_message ? msg : m)));
    };

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `id_destinataire=eq.${currentUserId}` },
        (payload) => {
          if (payload.new.id_expediteur !== otherUserId) return;
          setMessages((prev) => [...prev, payload.new]);
          supabase.from('messages').update({ lu: true }).eq('id_message', payload.new.id_message).then(() => {});
        }
      )
      // Accusé de lecture + réactions : tout message de ce fil qui change (lu par l'un,
      // "j'aime" posé par l'autre) doit se refléter en direct des deux côtés.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `id_expediteur=eq.${currentUserId}` }, applyUpdate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `id_destinataire=eq.${currentUserId}` }, applyUpdate)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.from !== otherUserId) return;
        setOtherTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), TYPING_INDICATOR_TIMEOUT_MS);
      })
      .subscribe();

    return () => {
      active = false;
      clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      supabase.removeChannel(typingOutbox);
      channelRef.current = null;
      typingOutboxRef.current = null;
    };
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const sendTypingSignal = () => {
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_BROADCAST_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { from: currentUserId } });
      typingOutboxRef.current?.send({ type: 'broadcast', event: 'typing', payload: { from: currentUserId } });
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    sendTypingSignal();
  };

  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const toggleReaction = async (message) => {
    const nextReaction = message.reaction === LIKE_EMOJI ? null : LIKE_EMOJI;
    const { data, error } = await supabase
      .from('messages')
      .update({ reaction: nextReaction })
      .eq('id_message', message.id_message)
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => prev.map((m) => (m.id_message === data.id_message ? data : m)));
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const contenu = newMessage.trim();
    if (!contenu) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ id_expediteur: currentUserId, id_destinataire: otherUserId, contenu }])
        .select()
        .single();

      if (error) throw error;
      setMessages((prev) => [...prev, data]);
      setNewMessage('');

      const { data: recipient } = await supabase.from('employes').select('push_token').eq('id_employe', otherUserId).maybeSingle();
      if (recipient?.push_token) {
        const senderName = userData ? `${userData.prenom} ${userData.nom}` : 'Nouveau message';
        sendPushNotification(recipient.push_token, senderName, contenu, { type: 'message' });
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi du message :", error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-80">
      <div className="flex-grow overflow-y-auto space-y-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
        {loading ? (
          <p className="text-center text-sm text-slate-400 italic py-6">Chargement...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-slate-400 italic py-6">Aucun message pour l'instant.</p>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const isMine = m.id_expediteur === currentUserId;
              const dateLabel = getDateLabel(m.date_envoi);
              const showDateSeparator = i === 0 || getDateLabel(messages[i - 1].date_envoi) !== dateLabel;

              const bubble = (
                <div className={`relative max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                }`}>
                  {!isMine && (
                    <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wide mb-0.5">{otherUserName}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.contenu}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}>
                    <p className={`text-[10px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
                      {new Date(m.date_envoi).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isMine && (
                      <span className={`flex items-center ${m.lu ? 'text-sky-300' : 'text-blue-200'}`} title={m.lu ? 'Lu' : 'Envoyé'}>
                        <FiCheck size={12} className={m.lu ? '-mr-1.5' : ''} />
                        {m.lu && <FiCheck size={12} />}
                      </span>
                    )}
                  </div>
                  {m.reaction && (
                    <span className={`absolute -bottom-2 ${isMine ? 'right-1' : 'left-1'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] leading-none px-1.5 py-1 shadow-sm`}>
                      {m.reaction}
                    </span>
                  )}
                </div>
              );
              const likeButton = (
                <button
                  onClick={() => toggleReaction(m)}
                  title="J'aime"
                  className={`opacity-0 group-hover:opacity-100 transition mb-1 shrink-0 ${m.reaction ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                >
                  <FiThumbsUp size={14} />
                </button>
              );

              return (
                <Fragment key={m.id_message}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700/70 px-3 py-1 rounded-full">
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 14, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    className={`group flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    {isMine ? (
                      <>
                        {likeButton}
                        {bubble}
                      </>
                    ) : (
                      <>
                        <Avatar url={otherUserAvatar} name={otherUserName} size={24} />
                        {bubble}
                        {likeButton}
                      </>
                    )}
                  </motion.div>
                </Fragment>
              );
            })}
          </AnimatePresence>
        )}
        {otherTyping && (
          <div className="flex items-end gap-2 justify-start">
            <Avatar url={otherUserAvatar} name={otherUserName} size={24} />
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-3.5 py-3 flex items-center gap-1">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="relative flex gap-2 mt-3">
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full mb-2 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 grid grid-cols-8 gap-1 z-10"
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="text-lg hover:bg-slate-100 dark:hover:bg-slate-700 rounded p-1 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          title="Émojis"
          className="text-slate-400 hover:text-amber-500 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 flex items-center justify-center transition"
        >
          <FiSmile size={18} />
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder={`Écrire à ${otherUserName}...`}
          className="flex-grow border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 rounded-lg font-bold flex items-center justify-center transition"
        >
          <FiSend />
        </button>
      </form>
    </div>
  );
}
