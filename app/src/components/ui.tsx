import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HandIcon, HandIconTile, hasHandIcon } from '@/components/HandIcon';
import { haptic } from '@/lib/haptics';
import { radius, shadow, space, type, useTheme, type Palette } from '@/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

// ---------- Text ----------

type Variant = keyof typeof type;

export function T({
  variant = 'body',
  color,
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; center?: boolean }) {
  const c = useTheme();
  return (
    <Text
      {...rest}
      style={[type[variant], { color: color ?? c.ink }, center && { textAlign: 'center' }, style]}
    />
  );
}

// ---------- Layout ----------

export function Screen({
  children,
  scroll = true,
  padded = true,
  bottomInset = true,
  tabBar = false,
  style,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: boolean;
  /** Leaves room for the floating tab bar. */
  tabBar?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: insets.top + space.md,
    paddingBottom: (bottomInset ? insets.bottom : 0) + space.xxxl + (tabBar ? 84 : 0),
    paddingHorizontal: padded ? space.xl : 0,
  };
  return (
    <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>
      <LinearGradient colors={[c.bgTop, c.bg]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

export function Row({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Spacer({ h = space.lg }: { h?: number }) {
  return <View style={{ height: h }} />;
}

/** Back button + title used at the top of pushed screens. */
export function Header({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const c = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: space.lg }}>
      <IconButton
        icon="chevron-left"
        label="Go back"
        onPress={() => {
          if (onBack) return onBack();
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
      {title ? (
        <T variant="subheading" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }} color={c.ink}>
          {title}
        </T>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </Row>
  );
}

// ---------- Pressables ----------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that gently shrinks when pressed. */
export function Tappable({
  children,
  style,
  onPress,
  haptics = true,
  scaleTo = 0.97,
  ...rest
}: Omit<PressableProps, 'style'> & { children: ReactNode; style?: StyleProp<ViewStyle>; haptics?: boolean; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 300 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics) haptic.tap();
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const c = useTheme();
  const colors: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.primary, fg: c.primaryInk },
    secondary: { bg: c.surface, fg: c.ink, border: c.line },
    ghost: { bg: 'transparent', fg: c.primary },
    danger: { bg: c.dangerSoft, fg: c.danger },
  };
  const k = colors[kind];
  const inactive = disabled || loading;
  return (
    <Tappable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        {
          backgroundColor: k.bg,
          borderRadius: radius.pill,
          paddingVertical: small ? 10 : 16,
          paddingHorizontal: small ? 16 : 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: disabled ? 0.5 : 1,
          borderWidth: k.border ? 1 : 0,
          borderColor: k.border,
        },
        kind === 'primary' && shadow(c, 2),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={k.fg} />
      ) : (
        <>
          {icon && <Feather name={icon} size={small ? 16 : 18} color={k.fg} />}
          <T variant="bodyStrong" color={k.fg} style={small ? { fontSize: 14 } : undefined}>
            {title}
          </T>
        </>
      )}
    </Tappable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'surface',
  size = 44,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: 'surface' | 'clear' | 'primary';
  size?: number;
}) {
  const c = useTheme();
  const bg = tone === 'surface' ? c.surface : tone === 'primary' ? c.primary : 'transparent';
  const fg = tone === 'primary' ? c.primaryInk : c.ink;
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        tone === 'surface' && shadow(c, 1),
      ]}
    >
      <Feather name={icon} size={size * 0.45} color={fg} />
    </Tappable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
}) {
  const c = useTheme();
  const active = color ?? c.primary;
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        backgroundColor: selected ? active : c.surface,
        borderWidth: 1,
        borderColor: selected ? active : c.line,
      }}
    >
      {icon && <HandIcon name={icon} size={17} color={selected ? c.primaryInk : c.inkSoft} wash={!selected} />}
      <T variant="small" color={selected ? c.primaryInk : c.ink}>
        {label}
      </T>
    </Tappable>
  );
}

// ---------- Surfaces ----------

export function Card({
  children,
  style,
  onPress,
  tone,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: string;
  padded?: boolean;
}) {
  const c = useTheme();
  const base: ViewStyle = {
    backgroundColor: tone ?? c.surface,
    borderRadius: radius.lg,
    padding: padded ? space.xl : 0,
    overflow: 'hidden',
  };
  if (onPress) {
    return (
      <Tappable onPress={onPress} accessibilityRole="button" style={[base, !tone && shadow(c, 1), style]}>
        {children}
      </Tappable>
    );
  }
  return <View style={[base, !tone && shadow(c, 1), style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const c = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.xxl, marginBottom: space.md }}>
      <T variant="heading">{title}</T>
      {action && (
        <Tappable onPress={onAction} hitSlop={10}>
          <T variant="small" color={c.primary}>
            {action}
          </T>
        </Tappable>
      )}
    </Row>
  );
}

/** An icon on a soft patch of colour: hand-drawn where Solace has its own drawing, Feather otherwise. */
export function IconBadge({ icon, bg, fg, size = 40 }: { icon: IconName; bg: string; fg: string; size?: number }) {
  if (hasHandIcon(icon)) return <HandIconTile name={icon} size={size} bg={bg} fg={fg} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={size * 0.48} color={fg} />
    </View>
  );
}

export function Pill({ text, bg, fg, icon }: { text: string; bg: string; fg: string; icon?: IconName }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
      }}
    >
      {icon && <Feather name={icon} size={12} color={fg} />}
      <T variant="small" color={fg} style={{ fontSize: 12, lineHeight: 15 }}>
        {text}
      </T>
    </View>
  );
}

export function ProgressBar({ value, color, track, height = 8 }: { value: number; color: string; track: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.md }}>
      <IconBadge icon={icon} bg={c.primarySoft} fg={c.primary} size={56} />
      <T variant="subheading" center>
        {title}
      </T>
      {body && (
        <T variant="small" color={c.inkSoft} center style={{ maxWidth: 280 }}>
          {body}
        </T>
      )}
      {children}
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useTheme();
  return (
    <Card tone={c.dangerSoft} style={{ gap: space.sm }}>
      <T variant="small" color={c.danger}>
        {message}
      </T>
      {onRetry && <Button title="Try again" kind="ghost" small onPress={onRetry} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />}
    </Card>
  );
}

export function inputStyle(c: Palette): TextStyle {
  return {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    color: c.ink,
    fontFamily: type.body.fontFamily,
    fontSize: 16,
  };
}
