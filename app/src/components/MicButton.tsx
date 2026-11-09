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

/**
 * English for the person's region (en-IN in India, en-GB in the UK…), so accents
 * are understood better. Falls back to en-US when the region is unknown.
 */
function locale() {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const region = tag.match(/[-_]([A-Za-z]{2})(?:[-_]|$)/)?.[1]?.toUpperCase();
    return region ? `en-${region}` : 'en-US';
  } catch {
    return 'en-US';
  }
}

/**
 * Android phones can default to a weaker recognizer (some ship their own).
 * Prefer Google's speech service when the default isn't Google's.
 */
function androidService(): string | undefined {
  if (Platform.OS !== 'android') return undefined;
  try {
    const current = ExpoSpeechRecognitionModule.getDefaultRecognitionService().packageName;
    if (current.startsWith('com.google.')) return undefined;
    const services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
    return ['com.google.android.tts', 'com.google.android.googlequicksearchbox'].find((p) => services.includes(p));
  } catch {
    return undefined;
  }
}

/** Continuous listening needs Android 13+ (and works on iOS and the web). */
const canListenLong = Platform.OS !== 'android' || Number(Platform.Version) >= 33;

/** How long a pause can be before listening ends by itself (long mode). */
const PAUSE_MS = 3_500;

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
 * Tap to talk instead of type. Calls `onText` with everything heard so far
 * (`final` once listening ends). Hidden where speech recognition isn't
 * available, such as Firefox.
 *
 * `long` (default) is for sentences: it keeps listening through natural pauses,
 * collects every segment the recognizer returns, and stops after a pause of a
 * few seconds or a second tap. `short` is for a single word, such as a name.
 */
export function MicButton({
  onText,
  onListeningChange,
  size = 44,
  mode = 'long',
}: {
  onText: (text: string, final: boolean) => void;
  onListeningChange?: (listening: boolean) => void;
  size?: number;
  mode?: 'long' | 'short';
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
  /** Segments the recognizer has finished with, and the whole text shown so far. */
  const committed = useRef('');
  const shown = useRef('');
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPause = () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
  };
  /** In long mode, a quiet stretch ends listening, as if the person tapped stop. */
  const armPause = () => {
    clearPause();
    if (mode !== 'long') return;
    pauseTimer.current = setTimeout(() => {
      if (activeOwner === owner) ExpoSpeechRecognitionModule.stop();
    }, PAUSE_MS);
  };

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
      clearPause();
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

  useSpeechRecognitionEvent('start', () => {
    if (activeOwner !== owner) return;
    setListening(true);
    armPause();
  });
  useSpeechRecognitionEvent('end', () => {
    if (activeOwner !== owner) return;
    activeOwner = null;
    clearPause();
    setListening(false);
    if (shown.current) onTextRef.current(shown.current, true);
  });
  useSpeechRecognitionEvent('result', (e) => {
    if (activeOwner !== owner) return;
    const piece = (e.results[0]?.transcript ?? '').trim();
    if (!piece) return;
    // Android and the web return long dictation in segments: each final result closes one,
    // and the next results start a new one. iOS keeps one growing transcript and only
    // finalises at the end. Keeping finished segments covers both.
    const text = joinWords(committed.current, piece);
    if (e.isFinal) committed.current = text;
    shown.current = text;
    onTextRef.current(text, false);
    armPause();
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
    committed.current = '';
    shown.current = '';
    const long = mode === 'long' && canListenLong;
    ExpoSpeechRecognitionModule.start({
      lang: locale(),
      interimResults: true,
      maxAlternatives: 1,
      continuous: long,
      // Android only adds punctuation with on-device models; asking anyway makes some recognizers unreliable.
      addsPunctuation: Platform.OS === 'ios',
      iosTaskHint: 'dictation',
      androidRecognitionServicePackage: androidService(),
      androidIntentOptions:
        Platform.OS === 'android'
          ? {
              // Let people pause to think without being cut off.
              EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: mode === 'long' ? PAUSE_MS : 1500,
              EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: mode === 'long' ? PAUSE_MS : 1500,
              EXTRA_MASK_OFFENSIVE_WORDS: false,
            }
          : undefined,
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

/** Adds a new piece of speech after what's already there, with one space between. */
function joinWords(before: string, piece: string) {
  return before ? `${before} ${piece}` : piece;
}
