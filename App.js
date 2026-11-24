import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';

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

  return (
    <View style={s.center}>
      <StatusBar style="dark" />
      <Text style={s.hello}>Signed in as {profile.username}</Text>
      <Text style={s.role}>Role: {profile.role}</Text>
      <TouchableOpacity style={s.logout} onPress={() => supabase.auth.signOut()}>
        <Text style={s.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7ff' },
  hello: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  role: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 20 },
  logout: { backgroundColor: '#ef4444', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  logoutText: { color: '#fff', fontWeight: '700' },
});
