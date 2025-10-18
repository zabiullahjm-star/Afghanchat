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

export default function SignUpScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');

    const handleSignUp = async () => {
        if (!email || !password! || fullName) {
            Alert.alert('خطا', 'لطفا تمام فیلدها را پر کنید');
            return;
        }

        if (password.length < 6) {
            Alert.alert('خطا', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
            return;
        }

        try {
            setLoading(true);

            const { data, error } = await supabase.auth.signUp({
                email: email.toLowerCase().trim(),
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                    }
                }
            });

            if (error) {
                throw error;
            }

            if (data.user) {
                Alert.alert(
                    'موفقیت‌آمیز',
                    'ایمیل تأیید ارسال شد. لطفا ایمیل خود را بررسی کنید.',
                    [{ text: 'باشه', onPress: () => router.push('/login' as any) }]
                );
            }

        } catch (error: any) {
            Alert.alert('خطا', error.message || 'خطایی در ثبت‌نام رخ داده است');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>ثبت‌نام در AfghanChat</Text>
                <Text style={styles.subtitle}>حساب کاربری جدید ایجاد کنید</Text>
            </View>

            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder="نام کامل"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                />

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
                    placeholder="رمز عبور (حداقل ۶ کاراکتر)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSignUp}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.buttonText}>ثبت‌نام</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => router.push('/login' as any)}
                >
                    <Text style={styles.linkText}>
                        قبلاً حساب دارید؟ وارد شوید
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