import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://xcpzagvohhdnexmlgxjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHphZ3ZvaGhkbmV4bWxneGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTIxMzYsImV4cCI6MjA3NTY2ODEzNn0.Zi6UY_LcA_zqlKz5AXr8MDD2WazvlDMMp8P3tl0R1nk';
// Storage adapter برای محیط‌های مختلف
const getStorageAdapter = () => {
    // اگر در محیط Node.js (CI) هستیم
    if (typeof window === 'undefined') {
        return {
            getItem: async (key: string) => null,
            setItem: async (key: string, value: string) => { },
            removeItem: async (key: string) => { },
        };
    }

    // اگر در محیط React Native هستیم
    return AsyncStorage;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: getStorageAdapter(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

