import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { IconBadge, Row, T, Tappable } from '@/components/ui';
import { activityHref, activityInfo } from '@/content/activities';
import type { ActivityId } from '@/lib/types';
import { accent, radius, shadow, space, useTheme } from '@/theme';

/** A tappable card that opens one of the app's activities. */
export function ActivityCard({
  activity,
  reason,
  journalPrompt,
  compact,
}: {
  activity: ActivityId;
  reason?: string;
  journalPrompt?: string;
  compact?: boolean;
}) {
  const c = useTheme();
  const info = activityInfo(activity);
  if (!info) return null;
  const a = accent(c, info.accent);
  return (
    <Tappable
      onPress={() => router.push(activityHref(activity, journalPrompt))}
      accessibilityRole="button"
      accessibilityLabel={`${info.title}. ${reason ?? info.subtitle}`}
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.md,
          padding: compact ? space.md : space.lg,
          borderLeftWidth: 4,
          borderLeftColor: a.strong,
        },
        shadow(c, 1),
      ]}
    >
      <Row gap={space.md}>
        <IconBadge icon={info.icon} bg={a.soft} fg={a.strong} size={compact ? 36 : 42} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{info.title}</T>
          <T variant="small" color={c.inkSoft} numberOfLines={2}>
            {reason ?? info.subtitle}
          </T>
        </View>
        <Feather name="chevron-right" size={20} color={c.inkFaint} />
      </Row>
    </Tappable>
  );
}
