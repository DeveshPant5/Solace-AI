import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AFFIRMATIONS } from '@/content/wellness';

import { api } from './api';
import { storage } from './storage';
import type { DailyCard, ReminderItem } from './types';

const supported = Platform.OS !== 'web';
const CHANNEL_ID = 'reminders';
const ASKED_KEY = 'solace.notificationsAsked';

const DEEP_LINKS: Record<ReminderItem['kind'], string> = {
  mood: '/checkin',
  affirmation: '/',
  breathing: '/breathe/calm',
  selfcare: '/practices',
  custom: '/sol',
};

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Gentle reminders',
    description: 'Check-ins, affirmations and the reminders you set',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#4F7D5F',
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function notificationPermission(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  if (!current.canAskAgain) return 'denied';
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

export async function cancelAllReminders() {
  if (!supported) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
}

/**
 * Mirrors the person's reminders (stored on the server) into scheduled local
 * notifications on this device. Local notifications fire even when the app
 * is closed. Safe to call often: it replaces the whole schedule.
 */
export async function syncReminders(): Promise<{ scheduled: number; permission: PermissionState }> {
  const permission = await notificationPermission();
  if (permission !== 'granted') return { scheduled: 0, permission };
  await ensureChannel();
  const [{ reminders }, daily] = await Promise.all([
    api<{ reminders: ReminderItem[] }>('/reminders'),
    api<{ daily: DailyCard }>('/home/daily').catch(() => null),
  ]);
  await Notifications.cancelAllScheduledNotificationsAsync();

  let scheduled = 0;
  for (const r of reminders) {
    if (!r.enabled) continue;
    const data = { url: DEEP_LINKS[r.kind] ?? '/' };
    if (r.kind === 'affirmation') {
      // A different affirmation each day for the next week; refreshed whenever the app opens.
      const start = new Date();
      for (let day = 0; day < 7; day++) {
        const at = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day, r.hour, r.minute);
        if (at.getTime() <= Date.now()) continue;
        const text = day === 0 && daily?.daily ? daily.daily.affirmation : AFFIRMATIONS[(at.getDate() + day) % AFFIRMATIONS.length]!;
        await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: text, data },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
        });
        scheduled++;
      }
      continue;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body ?? undefined, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: CHANNEL_ID },
    });
    scheduled++;
  }
  return { scheduled, permission };
}

/** Sends a test notification a few seconds from now. */
export async function sendTestNotification() {
  if (!supported) return false;
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Hi from Sol', body: 'This is how your gentle reminders will look.', data: { url: '/checkin' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
  return true;
}

/**
 * While signed in: opens the right screen when a notification is tapped
 * (including the tap that launched the app), asks for permission once, and
 * keeps the local schedule in sync with the server.
 */
export function useNotificationRouting(active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!supported || !active) return;
    let cancelled = false;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && !cancelled) {
        // Let the navigator mount before pushing.
        setTimeout(() => router.push(url as Href), 50);
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);

    (async () => {
      const asked = await storage.get(ASKED_KEY);
      if (!asked) {
        await storage.set(ASKED_KEY, '1');
        await requestNotificationPermission();
      }
      await syncReminders().catch(() => undefined);
    })();

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [active, router]);
}
