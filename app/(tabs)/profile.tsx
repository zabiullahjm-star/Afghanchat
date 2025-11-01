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
import { User } from '@supabase/supabase-js';

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUser(user);

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                setProfile(profile);
            }

        } catch (error) {
            console.error('.خطا در دریافت اطلاعات کاربر:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'خروج',
            'آیا مطمئن هستید می‌خواهید خارج شوید؟',
            [
                { text: 'لغو', style: 'cancel' },
                {
                    text: '.خروج',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        await supabase.auth.signOut();
                        setLoading(false);
                        router.replace('/(auth)/login');
                    }
                }
            ]
        );
    };

    const handleLogin = () => {
        router.push('/login' as any);
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text>در حال بارگذاری...</Text>
            </View>
        );
    }

    // اگر کاربر لاگین نکرده
    if (!user) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>👤 پروفایل</Text>
                </View>

                <View style={styles.notLoggedInContainer}>
                    <Text style={styles.notLoggedInTitle}>وارد حساب خود شوید</Text>
                    <Text style={styles.notLoggedInText}>
                        برای مشاهده پروفایل و استفاده از امکانات AfghanChat باید وارد حساب کاربری خود شوید.
                    </Text>

                    <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                        <Text style={styles.loginButtonText}>ورود به حساب</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.signupButton} onPress={() => router.push('/signup' as any)}>
                        <Text style={styles.signupButtonText}>ثبت‌نام در AfghanChat</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // اگر کاربر لاگین کرده
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
                    {profile?.full_name || 'کاربر AfghanChat'}
                </Text>

                <Text style={styles.userEmail}>
                    {user?.email || 'ایمیل نامشخص'}
                </Text>
            </View>

            {/* اطلاعات حساب */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 اطلاعات حساب</Text>

                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>نام کاربری:</Text>
                    <Text style={styles.infoValue}>
                        {profile?.username || 'we will know'}
                    </Text>
                </View>

                {/* در بخش اطلاعات حساب، شماره تلفن رو نشون بده */}
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>شماره تلفن:</Text>
                    <Text style={styles.infoValue}>
                        {profile?.phone || 'ثبت نشده'}
                    </Text>
                </View>

                <View style={styles.infoItem}><Text style={styles.infoLabel}>ایمیل:</Text>
                    <Text style={styles.infoValue}>{user?.email}</Text>
                </View>

                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>تاریخ عضویت:</Text>
                    <Text style={styles.infoValue}>
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fa-IR') : 'نامشخص'}
                    </Text>
                </View>
            </View>

            {/* دکمه خروج */}
            <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
            >
                <Text style={styles.logoutText}>🚪 خروج از حساب</Text>
            </TouchableOpacity>
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
    // استایل‌های جدید برای حالت لاگین نکرده
    notLoggedInContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    notLoggedInTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1a1a1a',
        textAlign: 'center'
    },
    notLoggedInText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24
    },
    loginButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
        width: '100%'
    },
    loginButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    signupButton: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#007AFF',
        width: '100%'
    },
    signupButtonText: {
        color: '#007AFF',
        fontSize: 16,
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