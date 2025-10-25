import { createClient } from '@supabase/supabase-js'

// ✅ اطلاعات پروژه‌ات (همون که دادی)
const SUPABASE_URL = 'https://xcpzagvohhdnexmlgxjm.supabase.co'
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHphZ3ZvaGhkbmV4bWxneGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTIxMzYsImV4cCI6MjA3NTY2ODEzNn0.Zi6UY_LcA_zqlKz5AXr8MDD2WazvlDMMp8P3tl0R1nk'

// ⚡ حالت Lazy برای جلوگیری از ارور "window is not defined" در OTA Update
let SecureStore: any = null
try {
    SecureStore = require('expo-secure-store')
} catch (e) {
    console.log('🔒 SecureStore not available in this environment (likely OTA build)')
}

// ✅ آداپتر امن برای نگه‌داری session (فقط در گوشی اجرا میشه)
const SecureStorageAdapter = SecureStore
    ? {
        getItem: async (key: string) => {
            try {
                return await SecureStore.getItemAsync(key)
            } catch (e) {
                console.warn('Error reading key', key, e)
                return null
            }
        },
        setItem: async (key: string, value: string) => {
            try {
                await SecureStore.setItemAsync(key, value)
            } catch (e) {
                console.warn('Error writing key', key, e)
            }
        },
        removeItem: async (key: string) => {
            try {
                await SecureStore.deleteItemAsync(key)
            } catch (e) {
                console.warn('Error removing key', key, e)
            }
        },
    }
    : undefined

// ✅ ایجاد کلاینت اصلی Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: SecureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})

// ✅ export کردن برای استفاده در بقیه قسمت‌ها
export const { auth, from, storage } = supabase