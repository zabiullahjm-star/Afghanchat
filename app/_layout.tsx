import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { ActivityIndicator, View, Text } from 'react-native';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // بررسی session فعلی
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // گوش دادن به تغییرات auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>در حال بارگذاری...</Text>
      </View>
    );
  }

  return (
    <Stack>
      {!session ? (
        // کاربر لاگین نکرده - صفحات احراز هویت
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      ) : (
        // کاربر لاگین کرده - صفحات اصلی
        <>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[roomId]" options={{ title: 'چت' }} />
        </>
      )}
    </Stack>
  );
}