import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../supabaseClient';
import Avatar from './Avatar';
import TypingDots from './TypingDots';
import { sendPushNotification } from '../utils/pushNotifications';
import { useAuth } from '../context/AuthContext';

const TYPING_BROADCAST_THROTTLE_MS = 2000;
const TYPING_INDICATOR_TIMEOUT_MS = 3000;
const LIKE_EMOJI = '👍';

const EMOJIS = [
  '😀', '😂', '😍', '😊', '😉', '😢', '😭', '😡',
  '👍', '👎', '🙏', '👏', '🎉', '❤️', '🔥', '💯',
  '😴', '🤔', '😅', '😎', '🤝', '🙌', '👌', '😱',
  '🥳', '😇', '🤗', '😬', '🚀', '✅', '⏰', '🛠️'
];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDateLabel(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return "Aujourd'hui";
  if (isSameDay(date, yesterday)) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

// Port de src/components/MessageThread.jsx (web) : même table `messages`, mêmes
// canaux Realtime (thread + typing-inbox), donc interopérable en direct avec le web.
export default function MessageThread({ currentUserId, otherUserId, otherUserName, otherUserAvatar }) {
  const { userData } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const listRef = useRef(null);
  const channelRef = useRef(null);
  const typingOutboxRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutRef = useRef(null);

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
      if (!error) setMessages(data || []);
      setLoading(false);
    };

    const markAsRead = async () => {
      await supabase.from('messages').update({ lu: true }).eq('id_destinataire', currentUserId).eq('id_expediteur', otherUserId).eq('lu', false);
    };

    fetchMessages();
    markAsRead();

    const pairKey = [currentUserId, otherUserId].sort((a, b) => a - b).join('-');
    const channel = supabase.channel(`thread-${pairKey}`);
    channelRef.current = channel;

    const typingOutbox = supabase.channel(`typing-inbox-${otherUserId}`);
    typingOutboxRef.current = typingOutbox;
    typingOutbox.subscribe();

    const applyUpdate = (payload) => {
      const msg = payload.new;
      if (msg.id_expediteur !== otherUserId && msg.id_destinataire !== otherUserId) return;
      setMessages((prev) => prev.map((m) => (m.id_message === msg.id_message ? msg : m)));
    };

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `id_destinataire=eq.${currentUserId}` }, (payload) => {
        if (payload.new.id_expediteur !== otherUserId) return;
        setMessages((prev) => [...prev, payload.new]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        supabase.from('messages').update({ lu: true }).eq('id_message', payload.new.id_message).then(() => {});
      })
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
    };
  }, [currentUserId, otherUserId]);

  const listData = useMemo(() => {
    const items = [];
    let lastLabel = null;
    messages.forEach((m) => {
      const label = getDateLabel(m.date_envoi);
      if (label !== lastLabel) {
        items.push({ type: 'separator', id: `sep-${m.id_message}`, label });
        lastLabel = label;
      }
      items.push({ type: 'message', id: String(m.id_message), message: m });
    });
    return items;
  }, [messages]);

  const sendTypingSignal = (text) => {
    setNewMessage(text);
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_BROADCAST_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { from: currentUserId } });
      typingOutboxRef.current?.send({ type: 'broadcast', event: 'typing', payload: { from: currentUserId } });
    }
  };

  const toggleReaction = async (message) => {
    const nextReaction = message.reaction === LIKE_EMOJI ? null : LIKE_EMOJI;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { data, error } = await supabase.from('messages').update({ reaction: nextReaction }).eq('id_message', message.id_message).select().single();
    if (!error && data) setMessages((prev) => prev.map((m) => (m.id_message === data.id_message ? data : m)));
  };

  const handleSend = async () => {
    const contenu = newMessage.trim();
    if (!contenu) return;
    setSending(true);
    try {
      const { data, error } = await supabase.from('messages').insert([{ id_expediteur: currentUserId, id_destinataire: otherUserId, contenu }]).select().single();
      if (error) throw error;
      setMessages((prev) => [...prev, data]);
      setNewMessage('');

      const { data: recipient } = await supabase.from('employes').select('push_token').eq('id_employe', otherUserId).maybeSingle();
      if (recipient?.push_token) {
        const senderName = userData ? `${userData.prenom} ${userData.nom}` : 'Nouveau message';
        sendPushNotification(recipient.push_token, senderName, contenu, { type: 'message' });
      }
    } catch (err) {
      console.error("Erreur lors de l'envoi du message :", err.message);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => {
    if (item.type === 'separator') {
      return (
        <View className="items-center my-2">
          <Text className="text-[11px] font-semibold text-slate-500 bg-slate-200 px-3 py-1 rounded-full">{item.label}</Text>
        </View>
      );
    }

    const m = item.message;
    const isMine = m.id_expediteur === currentUserId;

    return (
      <View className={`flex-row items-end gap-1.5 mb-3 ${isMine ? 'justify-end' : 'justify-start'}`}>
        {!isMine && <Avatar url={otherUserAvatar} name={otherUserName} size={24} />}
        <TouchableOpacity
          onLongPress={() => toggleReaction(m)}
          activeOpacity={0.85}
          className={`max-w-[75%] px-3 py-2 rounded-2xl ${isMine ? 'bg-blue-600 rounded-br-sm' : 'bg-white border border-slate-200 rounded-bl-sm'}`}
        >
          {!isMine && <Text className="text-[10px] font-bold text-blue-500 uppercase mb-0.5">{otherUserName}</Text>}
          <Text className={isMine ? 'text-white' : 'text-slate-700'}>{m.contenu}</Text>
          <View className={`flex-row items-center gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}>
            <Text className={`text-[10px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
              {new Date(m.date_envoi).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMine && (
              <View className="flex-row">
                <Feather name="check" size={12} color={m.lu ? '#7dd3fc' : '#bfdbfe'} />
                {m.lu && <Feather name="check" size={12} color="#7dd3fc" style={{ marginLeft: -6 }} />}
              </View>
            )}
          </View>
          {m.reaction && (
            <View className="absolute -bottom-2 -right-1 bg-white border border-slate-200 rounded-full px-1.5 py-0.5">
              <Text className="text-[11px]">{m.reaction}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={!loading && (
          <Text className="text-center text-slate-400 italic py-6">Aucun message pour l'instant.</Text>
        )}
        ListFooterComponent={otherTyping ? (
          <View className="flex-row items-end gap-2 mb-2">
            <Avatar url={otherUserAvatar} name={otherUserName} size={24} />
            <View className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-3">
              <TypingDots />
            </View>
          </View>
        ) : null}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20, flexGrow: 1 }}
      />

      <View className="flex-row items-center gap-2 px-3 pt-3 pb-4 border-t border-slate-200 bg-white shadow-sm">
        <TouchableOpacity onPress={() => setShowEmojiPicker(true)} className="p-2">
          <Feather name="smile" size={20} color="#94a3b8" />
        </TouchableOpacity>
        <TextInput
          value={newMessage}
          onChangeText={sendTypingSignal}
          placeholder={`Écrire à ${otherUserName}...`}
          className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || !newMessage.trim()}
          className={`w-10 h-10 rounded-full items-center justify-center ${sending || !newMessage.trim() ? 'bg-blue-300' : 'bg-blue-600'}`}
        >
          <Feather name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
        <TouchableOpacity className="flex-1 bg-black/30 justify-end" activeOpacity={1} onPress={() => setShowEmojiPicker(false)}>
          <View className="bg-white rounded-t-2xl p-4 flex-row flex-wrap">
            {EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => {
                  setNewMessage((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="items-center justify-center py-2"
                style={{ width: '12.5%' }}
              >
                <Text className="text-2xl">{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
