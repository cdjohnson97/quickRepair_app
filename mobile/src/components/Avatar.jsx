import { Image, Text, View } from 'react-native';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#06b6d4', '#f97316', '#ec4899'];

function colorFor(name) {
  const str = name || '?';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFor(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

// Port de src/components/Avatar.jsx (web) : photo si `url`, sinon initiales colorées,
// avec un point de statut optionnel (`online`).
export default function Avatar({ url, name, size = 36, online }) {
  const dotSize = Math.max(8, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size }}>
      {url ? (
        <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
          <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" />
        </View>
      ) : (
        <View
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(name), alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: size * 0.4 }}>{initialsFor(name)}</Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: online ? '#10b981' : '#94a3b8',
            borderWidth: 2,
            borderColor: '#fff'
          }}
        />
      )}
    </View>
  );
}
