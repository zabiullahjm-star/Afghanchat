import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// مقادیر با fallback واضح - حل مشکل TypeScript
const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xcpzagvohhdnexmlgxjm.supabase.co';
const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHphZ3ZvaGhkbmV4bWxneGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTIxMzYsImV4cCI6MjA3NTY2ODEzNn0.Zi6UY_LcA_zqlKz5AXr8MDD2WazvlDMMp8P3tl0R1nk';

// اعتبارسنجی مقادیر
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        '❌ Supabase environment variables are not properly set. ' +
        'Please check your .env file or environment configuration.'
    );
}

// تشخیص محیط با TypeScript ایمن
const isServerEnvironment = (): boolean => {
    return (
        typeof window === 'undefined' ||
        typeof document === 'undefined' ||
        !!(process.env.CI && process.env.CI !== 'false') ||
        process.env.NODE_ENV === 'test'
    );
};

// Storage adapter با تایپ‌های دقیق
const getSafeStorage = (): {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
} => {
    if (isServerEnvironment()) {
        // محیط سرور/CI - از storage ساده استفاده کن
        console.log('🔧 Using safe storage for server/CI environment');
        return {
            getItem: async (key: string): Promise<string | null> => null,
            setItem: async (key: string, value: string): Promise<void> => {
                // هیچ کاری نکن - برای محیط CI
            },
            removeItem: async (key: string): Promise<void> => {
                // هیچ کاری نکن - برای محیط CI
            }
        };
    }

    // محیط کلاینت - از AsyncStorage استفاده کن
    try {
        console.log('📱 Using AsyncStorage for client environment');
        return AsyncStorage;
    } catch (error) {
        console.warn('⚠️ AsyncStorage not available, falling back to safe storage');
        return {
            getItem: async (key: string): Promise<string | null> => null,
            setItem: async (key: string, value: string): Promise<void> => { },
            removeItem: async (key: string): Promise<void> => { }
        };
    }
};

// ایجاد کلاینت Supabase با تایپ‌های دقیق
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: getSafeStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce' as const
    },
    global: {
        headers: {
            'x-application-name': 'afghanchat'
        }
    }
});

// Export مستقیم برای راحتی
export const { auth, storage, from } = supabase;

// تست اتصال
export const testSupabaseConnection = async (): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);

        if (error) {
            console.error('❌ Supabase connection error:', error.message);
            return false;
        }

        console.log('✅ Supabase connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Supabase connection failed:', error);
        return false;
    }
};