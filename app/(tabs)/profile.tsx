import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';

export default function ProfileScreen() {
    const router = useRouter();

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
                        // به صورت خودکار به صفحه لاگین هدایت می‌شه
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>👤 پروفایل من</Text>
            </View>

            <View style={styles.profileCard}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>U</Text>
                </View>
                <Text style={styles.userName}>کاربر AfghanChat</Text>
                <Text style={styles.userEmail}>user@example.com</Text>
            </View>

            <View style={styles.menu}>
                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>✏️ ویرایش پروفایل</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>👥 مدیریت مخاطبین</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>🔔 تنظیمات نوتیفیکیشن</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>🌙 حالت تاریک</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>🚪 خروج از حساب</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16
    },
    header: {
        alignItems: 'center',
        paddingTop: 60,
        marginBottom: 30
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
        marginBottom: 20
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
        color: '#666'
    },
    menu: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        marginBottom: 20
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
        alignItems: 'center'
    },
    logoutText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    }
});