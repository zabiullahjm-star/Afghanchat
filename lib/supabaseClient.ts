import { createClient } from '@supabase/supabase-js';

// مستقیماً مقادیر را قرار دهید - بدون environment variables
const SUPABASE_URL = 'https://xcpzagvohhdnexmlgxjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHphZ3ZvaGhkbmV4bWxneGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTIxMzYsImV4cCI6MjA3NTY2ODEzNn0.Zi6UY_LcA_zqlKz5AXr8MDD2WazvlDMMp8P3tl0R1nk';

// همیشه از storage ساده استفاده کنید
const safeStorage = {
    getItem: async (key: string): Promise<string | null> => null,
    setItem: async (key: string, value: string): Promise<void> => { },
    removeItem: async (key: string): Promise<void> => { }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: safeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});

export const { auth, storage, from } = supabase;