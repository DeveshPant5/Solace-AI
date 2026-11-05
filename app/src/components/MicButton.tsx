import { Feather } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useId, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Tappable } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { stopSpeaking } from '@/lib/voice';
import { useTheme } from '@/theme';

/** Only one mic listens at a time; events are global, so each button checks it owns the session. */
let activeOwner: string | null = null;

function locale() {
  try {
    const l = Intl.DateTimeFormat().resolvedOptions().locale;
    return l && l.toLowerCase().startsWith('en') ? l : 'en-US';
  } catch {
    return 'en-US';
  }
}

let available: boolean | null = null;
function recognitionAvailable() {
  if (available === null) {
    try {
      available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      available = false;
    }
  }
  return available;
}

/**
 * Tap to talk instead of type. Calls `onText` with the words heard so far
 * (`final` once the person stops). Hidden where speech recognition isn't
 * available, such as Firefox.
 */
export function MicButton({
  onText,
  onListeningChange,
  size = 44,
}: {
  onText: (text: string, final: boolean) => void;
  onListeningChange?: (listening: boolean) => void;
  size?: number;
}) {
  const c = useTheme();
  const owner = useId();
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const onListeningRef = useRef(onListeningChange);
  onListeningRef.current = onListeningChange;
  const pulse = useSharedValue(1);

  // Only when listening actually flips: the callback itself changes every render.
  useEffect(() => {
    onListeningRef.current?.(listening);
    if (listening) pulse.value = withRepeat(withTiming(1.35, { duration: 700 }), -1, true);
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [listening, pulse]);

  useEffect(
    () => () => {
      if (activeOwner === owner) {
        activeOwner = null;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          // Not running.
        }
      }
    },
    [owner],
  );

  useSpeechRecognitionEvent('start', () => activeOwner === owner && setListening(true));
  useSpeechRecognitionEvent('end', () => {
    if (activeOwner !== owner) return;
    activeOwner = null;
    setListening(false);
  });
  useSpeechRecognitionEvent('result', (e) => {
    if (activeOwner !== owner) return;
    const text = e.results[0]?.transcript ?? '';
    if (text) onTextRef.current(text, e.isFinal);
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (activeOwner !== owner) return;
    if (e.error === 'not-allowed') setDenied(true);
  });

  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2 - pulse.value - 0.4 }));

  if (!recognitionAvailable()) return null;

  const toggle = async () => {
    haptic.soft();
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    stopSpeaking();
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setDenied(true);
      return;
    }
    setDenied(false);
    activeOwner = owner;
    ExpoSpeechRecognitionModule.start({
      lang: locale(),
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      androidIntentOptions: Platform.OS === 'android' ? { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1600 } : undefined,
    });
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {listening && (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: c.peachSoft }, ring]}
        />
      )}
      <Tappable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : denied ? 'Microphone is blocked. Allow it in settings to talk.' : 'Talk instead of typing'}
        hitSlop={6}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: listening ? c.peach : c.surface,
          borderWidth: 1,
          borderColor: listening ? c.peach : c.line,
        }}
      >
        <Feather name={denied ? 'mic-off' : 'mic'} size={size * 0.44} color={listening ? '#FFFFFF' : denied ? c.inkFaint : c.primary} />
      </Tappable>
    </View>
  );
}
