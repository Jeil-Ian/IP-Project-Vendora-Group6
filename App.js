import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import CashierScreen from './screens/CashierScreen';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) { setProfile(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('username, role').eq('id', session.user.id).single()
      .then(({ data }) => { setProfile(data); setLoading(false); });
  }, [session?.user?.id]);

  if (loading || (session && !profile)) {
    return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;
  }
  if (!session) return <LoginScreen />;

  return <CashierScreen userId={session.user.id} cashierName={profile.username} />;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7ff' },
});
