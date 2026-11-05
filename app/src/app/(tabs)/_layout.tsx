import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sol } from '@/components/Sol';
import { T, type IconName } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { radius, shadow, useTheme } from '@/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  practices: { label: 'Practices', icon: 'feather' },
  sol: { label: 'Sol', icon: 'message-circle' },
  journey: { label: 'Journey', icon: 'trending-up' },
  you: { label: 'You', icon: 'user' },
};

function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={[styles.bar, { borderColor: c.line, backgroundColor: Platform.OS === 'ios' ? 'transparent' : c.surface }, shadow(c, 3)]}>
        {Platform.OS === 'ios' && <BlurView intensity={60} tint={c.scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.tap();
              navigateToTab(route.key);
            }
          };
          if (route.name === 'sol') {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel="Talk to Sol"
                style={styles.item}
              >
                <View style={[styles.solButton, { backgroundColor: focused ? c.primary : c.primarySoft }]}>
                  <Sol size={46} mood={focused ? 'happy' : 'calm'} animated={false} />
                </View>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.item}
            >
              <View style={[styles.iconPill, focused && { backgroundColor: c.primarySoft }]}>
                <Feather name={tab.icon} size={21} color={focused ? c.primary : c.inkFaint} />
              </View>
              <T variant="small" color={focused ? c.primary : c.inkFaint} style={{ fontSize: 11, lineHeight: 14 }}>
                {tab.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="practices" />
      <Tabs.Screen name="sol" />
      <Tabs.Screen name="journey" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.pill },
  solButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
});
