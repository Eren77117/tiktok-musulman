import { useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const QUEUE_KEY = 'nour_analytics_queue';
const FLUSH_INTERVAL = 5000;
const MAX_QUEUE = 200;

interface AnalyticsEvent {
  post_id: string;
  watch_time: number;
  watch_percent: number;
  rewatch_count: number;
  was_skipped: boolean;
  liked: boolean;
  commented: boolean;
  shared: boolean;
  saved: boolean;
  session_id?: string;
}

async function flushQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const events: AnalyticsEvent[] = JSON.parse(raw);
    if (events.length === 0) return;
    await AsyncStorage.removeItem(QUEUE_KEY);
    await api.post('/analytics/batch', { events });
  } catch {
    // keep in queue for next flush
  }
}

async function enqueue(event: AnalyticsEvent) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: AnalyticsEvent[] = raw ? JSON.parse(raw) : [];
    queue.push(event);
    const capped = queue.slice(-MAX_QUEUE);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(capped));
  } catch {}
}

export function useAnalyticsTracker() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(flushQueue, FLUSH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      flushQueue();
    };
  }, []);

  const track = useCallback((event: AnalyticsEvent) => {
    enqueue(event);
  }, []);

  return { track };
}
