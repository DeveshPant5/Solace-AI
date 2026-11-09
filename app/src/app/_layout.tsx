// One import per weight: importing the package root would bundle every weight and style into the app.
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { Newsreader_500Medium_Italic } from '@expo-google-fonts/newsreader/500Medium_Italic';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashIntro } from '@/components/SplashIntro';
import { AuthProvider, useAuth } from '@/lib/auth';
import { loadSolLook } from '@/lib/solLook';
import { useNotificationRouting } from '@/lib/notifications';
import { ThemeModeProvider, useTheme, useThemeMode } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const c = useTheme();
  const { status, user } = useAuth();
  const { loaded: themeLoaded } = useThemeMode();
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_500Medium,
    Newsreader_500Medium_Italic,
    Newsreader_600SemiBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const ready = (fontsLoaded || !!fontError) && status !== 'loading' && themeLoaded;
  useNotificationRouting(ready && status === 'signedIn');
  // The person's own Luma, if they've found the wardrobe.
  useEffect(() => {
    void loadSolLook(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined);
  }, [c.bg]);

  if (!ready) return null;

  const navTheme = c.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const signedIn = status === 'signedIn';
  return (
    <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: c.bg, card: c.bg, text: c.ink, primary: c.primary } }}>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={signedIn} redirectTo="/welcome">
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="breathe/[pattern]" options={{ animation: 'fade' }} />
          <Stack.Screen name="grounding" options={{ animation: 'fade' }} />
          <Stack.Screen name="assessment/[kind]" />
          <Stack.Screen name="guide/[id]" />
          <Stack.Screen name="journal/index" />
          <Stack.Screen name="journal/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="reminders" />
          <Stack.Screen name="tasks/index" />
          <Stack.Screen name="tasks/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="tasks/[id]" options={{ animation: 'fade' }} />
          <Stack.Screen name="memory" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="sol-studio" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          <Stack.Screen name="personalize" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Screen name="help" />
      </Stack>
      <SplashIntro />
    </ThemeProvider>
  );
}

/** On the web, show the app at phone width so it looks the way it does on a device. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: c.frame }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 440, overflow: 'hidden', backgroundColor: c.bg }}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeModeProvider>
        <PhoneFrame>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </PhoneFrame>
      </ThemeModeProvider>
    </GestureHandlerRootView>
  );
}
