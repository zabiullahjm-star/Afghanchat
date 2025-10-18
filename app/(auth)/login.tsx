import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';

export default function LoginScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('خطا', 'لطفا ایمیل و رمز عبور را وارد کنید');
            return;
        }

        try {
            setLoading(true);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password: password,
            });

            if (error) {
                throw error;
            }

            if (data.user) {
                // به صورت خودکار به صفحه اصلی هدایت می‌شه
                console.log('ورود موفقیت‌آمیز:', data.user);
            }

        } catch (error: any) {
            Alert.alert('خطا', error.message || 'خطایی در ورود رخ داده است');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>ورود به AfghanChat</Text>
                <Text style={styles.subtitle}>به حساب کاربری خود وارد شوید</Text>
            </View>

            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder="ایمیل"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <TextInput
                    style={styles.input}
                    placeholder="رمز عبور"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.buttonText}>ورود</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => router.push('/signup')}
                >
                    <Text style={styles.linkText}>
                        حساب ندارید؟ ثبت‌نام کنید
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 24
    },
    header: {
        alignItems: 'center',
        marginTop: 80,
        marginBottom: 40
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        color: '#666'
    },
    form: {
        flex: 1
    },
    input: {
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 16
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16
    },
    buttonDisabled: {
        opacity: 0.6
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    linkButton: {
        alignItems: 'center',
        padding: 16
    },
    linkText: {
        color: '#007AFF',
        fontSize: 16
    }
});