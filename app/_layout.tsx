import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { ActivityIndicator, View, Text } from 'react-native';
import UpdateChecker from '../components/UpdateChecker';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // تابع برای بررسی session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session checked:', session ? 'User logged in' : 'No user');
        setSession(session);
      } catch (error) {
        console.error('Error checking session:', error);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // گوش دادن به تغییرات auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'User logged in' : 'No user');
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 12 }}>در حال بارگذاری...</Text>
      </View>
    );
  }

  console.log('Rendering layout - Session:', session ? 'Exists' : 'None');

  return (
    <View style={{flex: 1}}>
    <UpdateChecker/>
    <Stack screenOptions={{ headerShown: false }}>
      {!session ? (
        // کاربر لاگین نکرده
        <Stack.Screen name="(auth)" />
      ) : (
        // کاربر لاگین کرده
        <>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[roomId]" options={{ headerShown: true, title: 'چت' }} />
        </>
      )}
    </Stack>
    </View>
  );
}