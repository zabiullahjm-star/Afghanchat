import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { Profile } from '../../types/chat';
import { User } from '@supabase/supabase-js'; // import از سوپابیس

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            setLoading(true);

            // گرفتن اطلاعات کاربر لاگین کرده
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUser(user);

                // گرفتن پروفایل کاربر از جدول profiles
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') { // PGRST116 یعنی رکورد پیدا نشد
                    console.error('خطا در دریافت پروفایل:', error);
                }

                // اگر پروفایل وجود نداشت، ایجادش کن
                if (!profile) {
                    await createProfile(user);
                } else {
                    setProfile(profile);
                }
            }

        } catch (error) {
            console.error('خطا در دریافت اطلاعات کاربر:', error);
        } finally {
            setLoading(false);
        }
    };

    const createProfile = async (user: User) => {
        try {
            const newProfile = {
                id: user.id,
                username: user.email?.split('@')[0] || 'user',
                full_name: user.user_metadata?.full_name || 'کاربر جدید',
                avatar_url: null,
                phone: null
            };

            const { data, error } = await supabase
                .from('profiles')
                .insert([newProfile])
                .select()
                .single();

            if (error) throw error;

            setProfile(data);

        } catch (error) {
            console.error('خطا در ایجاد پروفایل:', error);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'خروج',
            'آیا مطمئن هستید می‌خواهید خارج شوید؟',
            [
                { text: 'لغو', style: 'cancel' },
                {
                    text: 'خروج',
                    style: 'destructive',
                    onPress: async () => {
                        await supabase.auth.signOut();
                    }
                }
            ]
        );
    };

    const updateProfile = async (updates: Partial<Profile>) => {
        if (!user) return;

        try {
            setSaving(true);

            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw error;

            setProfile(data);
            Alert.alert('موفق', 'پروفایل با موفقیت به‌روزرسانی شد');

        } catch (error: any) {
            Alert.alert('خطا', error.message || 'خطا در به‌روزرسانی پروفایل');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text>در حال بارگذاری پروفایل...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>👤 پروفایل من</Text>
            </View>

            {/* کارت پروفایل */}
            <View style={styles.profileCard}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </Text>
                </View>

                <Text style={styles.userName}>
                    {profile?.full_name || 'کاربر جدید'}
                </Text>

                <Text style={styles.userEmail}>
                    {user?.email || 'ایمیل نامشخص'}
                </Text>

                <Text style={styles.userId}>
                    شناسه: {user?.id?.substring(0, 8)}...
                </Text>
            </View>{/* اطلاعات حساب */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 اطلاعات حساب</Text>

                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>نام کاربری:</Text>
                    <Text style={styles.infoValue}>
                        {profile?.username || 'تعیین نشده'}
                    </Text>
                </View>

                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>ایمیل:</Text>
                    <Text style={styles.infoValue}>{user?.email}</Text>
                </View>

                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>شماره تلفن:</Text>
                    <Text style={styles.infoValue}>
                        {profile?.phone || 'تعیین نشده'}
                    </Text>
                </View>

                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>تاریخ عضویت:</Text>
                    <Text style={styles.infoValue}>
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fa-IR') : 'نامشخص'}
                    </Text>
                </View>
            </View>

            {/* منو */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚙️ تنظیمات</Text>

                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>✏️ ویرایش پروفایل</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>🔐 تغییر رمز عبور</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>🔔 تنظیمات نوتیفیکیشن</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>🌙 حالت تاریک</Text>
                </TouchableOpacity>
            </View>

            {/* دکمه خروج */}
            <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text style={styles.logoutText}>🚪 خروج از حساب</Text>
                )}
            </TouchableOpacity>

            {/* نسخه برنامه */}
            <View style={styles.versionContainer}>
                <Text style={styles.versionText}>AfghanChat v1.0.0</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#f8f9fa'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold'
    },
    profileCard: {
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20,
        borderRadius: 12,
        margin: 16,
        marginTop: 0
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    avatarText: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold'
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4
    },
    userEmail: {
        fontSize: 16,
        color: '#666',
        marginBottom: 4
    },
    userId: {
        fontSize: 12,
        color: '#999',
        fontFamily: 'monospace'
    },
    section: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        margin: 16,
        marginTop: 0,
        padding: 16
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#333'
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef'
    },
    infoLabel: {
        fontSize: 14,
        color: '#666'
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333'
    },
    menuItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef'
    },
    menuText: {
        fontSize: 16
    },
    logoutButton: {
        backgroundColor: '#dc3545',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        margin: 16,
        marginTop: 8
    },
    logoutText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    versionContainer: {
        alignItems: 'center',
        padding: 16
    },
    versionText: {
        fontSize: 12,
        color: '#999'
    }
});