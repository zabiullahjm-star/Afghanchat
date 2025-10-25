// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = 'https://xcpzagvohhdnexmlgxjm.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHphZ3ZvaGhkbmV4bWxneGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTIxMzYsImV4cCI6MjA3NTY2ODEzNn0.Zi6UY_LcA_zqlKz5AXr8MDD2WazvlDMMp8P3tl0R1nk';

// Storage adapter امن با SecureStore برای نگه داشتن نشست
const SecureStorageAdapter = {
    getItem: async (key: string) => {
        try {
            return await SecureStore.getItemAsync(key);
        } catch (e) {
            console.warn('Error reading key', key, e);
            return null;
        }
    },
    setItem: async (key: string, value: string) => {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (e) {
            console.warn('Error writing key', key, e);
        }
    },
    removeItem: async (key: string) => {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (e) {
            console.warn('Error removing key', key, e);
        }
    },
};

// ایجاد client اصلی Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: SecureStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
});