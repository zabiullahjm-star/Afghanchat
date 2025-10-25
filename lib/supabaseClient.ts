import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = 'https://xcpzagvohhdnexmlgxjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHphZ3ZvaGhkbmV4bWxneGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTIxMzYsImV4cCI6MjA3NTY2ODEzNn0.Zi6UY_LcA_zqlKz5AXr8MDD2WazvlDMMp8P3tl0R1nk';

const safeStorage ={
    getItem:async (key: string) => null,
    setItem: async (key: string, value: string) => {},
removeItem:async (key: string) => {},
};
// کاملاً پاک - بدون هیچ import اضافی
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: safeStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    }
});

// export مستقیم
export const { auth, storage, from } = supabase;