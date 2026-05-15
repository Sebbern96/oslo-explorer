import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

export interface Progress {
  visitedKeys: string[];
  discoveredPOIIds: number[];
  visitedPOIIds: number[];
  unlockedAchievementIds: string[];
  xp: number;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('pending_username').then(u => { if (u) setUsername(u); });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const { data: progress } = await supabase
          .from('user_progress')
          .select('username')
          .eq('user_id', data.session.user.id)
          .single();
        if (progress?.username) setUsername(progress.username);
      }
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
        unlocked_achievement_ids: [],
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
      .select('visited_keys, discovered_poi_ids, visited_poi_ids, unlocked_achievement_ids, xp, username')
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
      unlockedAchievementIds: data.unlocked_achievement_ids ?? [],
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
      unlocked_achievement_ids: progress.unlockedAchievementIds,
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

  async function addFriend(friendUsername: string): Promise<{ error: string | null }> {
    if (!session) return { error: 'Ikke logget inn' };
    const { data: target, error: lookupErr } = await supabase
      .from('user_progress')
      .select('user_id, username')
      .eq('username', friendUsername)
      .single();
    if (lookupErr || !target) return { error: 'Fant ikke brukeren' };
    if (target.user_id === session.user.id) return { error: 'Du kan ikke legge til deg selv' };
    const { error } = await supabase.from('friendships').insert({ user_id: session.user.id, friend_id: target.user_id });
    if (error) {
      if (error.code === '23505') return { error: 'Allerede venner' };
      return { error: 'Noe gikk galt' };
    }
    return { error: null };
  }

  async function removeFriend(friendUserId: string): Promise<void> {
    if (!session) return;
    await supabase.from('friendships').delete().eq('user_id', session.user.id).eq('friend_id', friendUserId);
  }

  async function fetchFriendsLeaderboard(): Promise<{ username: string; xp: number; userId: string }[]> {
    if (!session) return [];
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', session.user.id);
    const friendIds = (friendships ?? []).map((f: any) => f.friend_id);
    const allIds = [session.user.id, ...friendIds];
    const { data } = await supabase
      .from('user_progress')
      .select('user_id, username, xp')
      .in('user_id', allIds)
      .order('xp', { ascending: false });
    return (data ?? []).map((d: any) => ({ username: d.username, xp: d.xp, userId: d.user_id }));
  }

  async function fetchComments(poiId: number): Promise<{ id: string; username: string; text: string; created_at: string }[]> {
    const { data } = await supabase
      .from('poi_comments')
      .select('id, username, text, created_at')
      .eq('poi_id', poiId)
      .order('created_at', { ascending: true });
    return data ?? [];
  }

  async function postComment(poiId: number, text: string): Promise<void> {
    if (!session) return;
    const { error } = await supabase.from('poi_comments').insert({
      user_id: session.user.id,
      poi_id: poiId,
      username: username ?? 'Anonym',
      text: text.trim(),
    });
    if (error) throw error;
  }

  return { session, loading, username, signIn, signUp, signOut, fetchCloudProgress, uploadProgress, fetchLeaderboard, addFriend, removeFriend, fetchFriendsLeaderboard, fetchComments, postComment };
}
