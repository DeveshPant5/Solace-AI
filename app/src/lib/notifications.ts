import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { AFFIRMATIONS } from '@/content/wellness';

import { api } from './api';
import { dayKey } from './format';
import { storage } from './storage';
import { hasDay, reminderLine, taskHref } from './tasks';
import type { DailyCard, ReminderItem, TasksData } from './types';

const supported = Platform.OS !== 'web';
const CHANNEL_ID = 'reminders';
const ASKED_KEY = 'solace.notificationsAsked';
/** The running task timer's "time's up" notification; a resync leaves it alone. */
const TIMER_ID = 'solace-timer';
/** Task reminders are scheduled day by day this far ahead, and topped up whenever the app opens. */
const TASK_DAYS_AHEAD = 10;
const taskNotificationId = (taskId: string, day: Date) => `task-${taskId}-${dayKey(day)}`;

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
type SyncResult = { scheduled: number; permission: PermissionState };
let syncing: Promise<SyncResult> | null = null;
let syncAgain = false;
let lastSync = 0;

export function syncReminders(): Promise<SyncResult> {
  // One at a time: two overlapping syncs would each clear and refill the schedule.
  if (syncing) {
    syncAgain = true;
    return syncing;
  }
  syncing = runSync().finally(() => {
    syncing = null;
    lastSync = Date.now();
    if (syncAgain) {
      syncAgain = false;
      void syncReminders().catch(() => undefined);
    }
  });
  return syncing;
}

async function clearSchedule() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier !== TIMER_ID).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

async function runSync(): Promise<SyncResult> {
  const permission = await notificationPermission();
  if (permission !== 'granted') return { scheduled: 0, permission };
  await ensureChannel();
  const [{ reminders }, daily, tasks] = await Promise.all([
    api<{ reminders: ReminderItem[] }>('/reminders'),
    api<{ daily: DailyCard }>('/home/daily').catch(() => null),
    api<TasksData>('/tasks').catch(() => null),
  ]);
  await clearSchedule();

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

  // Daily tasks: one reminder per day it's planned for, skipping today's if it's already done.
  const start = new Date();
  for (const task of tasks?.tasks ?? []) {
    if (!task.remind) continue;
    for (let day = 0; day < TASK_DAYS_AHEAD; day++) {
      const at = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day, task.hour, task.minute);
      if (at.getTime() <= Date.now() || !hasDay(task.days, at.getDay())) continue;
      if (day === 0 && task.doneToday) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: taskNotificationId(task.id, at),
        content: { title: task.title, body: reminderLine(task), data: { url: taskHref(task) } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
      });
      scheduled++;
    }
  }
  return { scheduled, permission };
}

/** Once a task is done today, today's reminder for it isn't needed. */
export async function skipTodaysTaskReminders(taskIds: string[]) {
  if (!supported || !taskIds.length) return;
  const today = new Date();
  await Promise.all(taskIds.map((id) => Notifications.cancelScheduledNotificationAsync(taskNotificationId(id, today)).catch(() => undefined)));
}

/** After a practice is finished: skips today's reminder for any task that practice just ticked. */
export async function refreshTodaysTasks() {
  if (!supported) return;
  const data = await api<TasksData>('/tasks').catch(() => null);
  if (data) await skipTodaysTaskReminders(data.tasks.filter((t) => t.doneToday).map((t) => t.id));
}

/** A gentle "time's up" for a task timer, so it still arrives if the phone is locked or the app is in the background. */
export async function scheduleTimerEnd(title: string, minutes: number, at: Date, url: string) {
  if (!supported || (await notificationPermission()) !== 'granted') return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: TIMER_ID,
    content: { title: 'Time’s up, gently', body: `That was ${minutes} minutes of ${title.toLowerCase()}. Nicely done.`, data: { url } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
  });
}

export async function cancelTimerEnd() {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(TIMER_ID).catch(() => undefined);
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

    // Coming back to the app tops up the task reminders (they're scheduled a few days ahead).
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastSync > 30 * 60 * 1000) void syncReminders().catch(() => undefined);
    });

    return () => {
      cancelled = true;
      sub.remove();
      appState.remove();
    };
  }, [active, router]);
}
