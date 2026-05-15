import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

export interface Progress {
  visitedKeys: string[];
  discoveredPOIIds: number[];
  visitedPOIIds: number[];
  xp: number;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('pending_username').then(u => { if (u) setUsername(u); });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    setUsername(name);
    await AsyncStorage.setItem('pending_username', name);
    if (data.user) {
      await supabase.from('user_progress').upsert({
        user_id: data.user.id,
        username: name,
        visited_keys: [],
        discovered_poi_ids: [],
        visited_poi_ids: [],
        xp: 0,
        updated_at: new Date().toISOString(),
      });
    }
  }

  async function signOut() {
    setUsername(null);
    await AsyncStorage.removeItem('pending_username');
    await supabase.auth.signOut();
  }

  async function fetchCloudProgress(): Promise<Progress | null> {
    if (!session) return null;
    const { data, error } = await supabase
      .from('user_progress')
      .select('visited_keys, discovered_poi_ids, visited_poi_ids, xp, username')
      .eq('user_id', session.user.id)
      .single();
    if (error || !data) return null;
    if (data.username) {
      setUsername(data.username);
      await AsyncStorage.removeItem('pending_username');
    }
    return {
      visitedKeys: data.visited_keys ?? [],
      discoveredPOIIds: data.discovered_poi_ids ?? [],
      visitedPOIIds: data.visited_poi_ids ?? [],
      xp: data.xp ?? 0,
    };
  }

  async function uploadProgress(progress: Progress) {
    if (!session) return;
    await supabase.from('user_progress').upsert({
      user_id: session.user.id,
      ...(username ? { username } : {}),
      visited_keys: progress.visitedKeys,
      discovered_poi_ids: progress.discoveredPOIIds,
      visited_poi_ids: progress.visitedPOIIds,
      xp: progress.xp,
      updated_at: new Date().toISOString(),
    });
  }

  async function fetchLeaderboard() {
    const { data } = await supabase
      .from('user_progress')
      .select('username, xp')
      .order('xp', { ascending: false })
      .limit(20);
    return data ?? [];
  }

  return { session, loading, username, signIn, signUp, signOut, fetchCloudProgress, uploadProgress, fetchLeaderboard };
}
