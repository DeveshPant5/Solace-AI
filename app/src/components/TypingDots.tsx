import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0, { duration: 350 })), -1));
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.65, transform: [{ translateY: -3 * v.value }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}

export function TypingDots({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 6 }} accessibilityLabel="Luma is typing">
      <Dot delay={0} color={color} />
      <Dot delay={150} color={color} />
      <Dot delay={300} color={color} />
    </View>
  );
}
