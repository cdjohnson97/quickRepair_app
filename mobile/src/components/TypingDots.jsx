import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

function Dot({ delay }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateY, { toValue: -4, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay)
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, translateY]);

  return (
    <Animated.View
      style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#94a3b8', transform: [{ translateY }] }}
    />
  );
}

// Port de src/components/TypingDots.jsx (web) : trois points qui rebondissent en cascade,
// animés ici via l'API Animated de React Native (pas de `animate-bounce` CSS disponible).
export default function TypingDots() {
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}
