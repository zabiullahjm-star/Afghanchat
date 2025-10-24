import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { ActivityIndicator, View, Text } from 'react-native';
import UpdateChecker from '../components/UpdateChecker';
import { useRouter, useSegments } from 'expo-router'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // تابع برای بررسی session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session checked:', session ? 'User logged in' : 'No user');
        setSession(session);

        // بعد از دریافت session، هدایت کن
        if (!session) {
          if (segments[0] !== '(auth)') {
            console.log('Redirecting to auth');
            router.replace('/(auth)/login');
          }
        } else {
          if (segments[0] === '(auth)') {
            console.log('Redirecting to tabs');
            router.replace('/(tabs)');
          }
        }

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

      // بعد از تغییر auth state، هدایت کن
      if (!session) {
        if (segments[0] !== '(auth)') {
          router.replace('/(auth)/login');
        }
      } else {
        if (segments[0] === '(auth)') {
          router.replace('/(tabs)');
        }
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [router, segments]);


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
    <View style={{ flex: 1 }}>
      <UpdateChecker />
      <Stack screenOptions={{ headerShown: false }}>
        {!session ? (
          // کاربر لاگین نکرده
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        ) : (
          // کاربر لاگین کرده
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="chat/[roomId]" options={{ headerShown: false }} />
          </>
        )}
      </Stack>
    </View>
  );
}