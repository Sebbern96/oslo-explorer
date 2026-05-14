import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

export interface Progress {
  visitedKeys: string[];
  discoveredPOIIds: number[];
  xp: number;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function fetchCloudProgress(): Promise<Progress | null> {
    if (!session) return null;
    const { data, error } = await supabase
      .from('user_progress')
      .select('visited_keys, discovered_poi_ids, xp')
      .eq('user_id', session.user.id)
      .single();
    if (error || !data) return null;
    return {
      visitedKeys: data.visited_keys ?? [],
      discoveredPOIIds: data.discovered_poi_ids ?? [],
      xp: data.xp ?? 0,
    };
  }

  async function uploadProgress(progress: Progress) {
    if (!session) return;
    await supabase.from('user_progress').upsert({
      user_id: session.user.id,
      visited_keys: progress.visitedKeys,
      discovered_poi_ids: progress.discoveredPOIIds,
      xp: progress.xp,
      updated_at: new Date().toISOString(),
    });
  }

  return { session, loading, signIn, signUp, signOut, fetchCloudProgress, uploadProgress };
}
