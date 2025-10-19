import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';

export default function LoginScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        if (!email.trim()) {
            Alert.alert('خطا', 'لطفا ایمیل خود را وارد کنید');
            return;
        }

        if (!password) {
            Alert.alert('خطا', 'لطفا رمز عبور خود را وارد کنید');
            return;
        }

        if (password.length < 6) {
            Alert.alert('خطا', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
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
                Alert.alert('موفق', 'ورود موفقیت‌آمیز بود!');
                // به صورت خودکار به صفحه اصلی هدایت می‌شه
            }

        } catch (error: any) {
            Alert.alert('خطا', error.message || 'خطایی در ورود رخ داده است');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        Alert.alert('بازیابی رمز عبور', 'این قابلیت به زودی اضافه خواهد شد');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>خوش آمدید</Text>
                    <Text style={styles.subtitle}>به AfghanChat وارد شوید</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>ایمیل</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="example@email.com"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>رمز عبور</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="رمز عبور خود را وارد کنید"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.forgotPasswordButton}
                        onPress={handleForgotPassword}
                    >
                        <Text style={styles.forgotPasswordText}>
                            رمز عبور خود را فراموش کرده‌اید؟
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.loginButton, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.loginButtonText}>ورود به حساب</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>یا</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                        style={styles.signupButton}
                        onPress={() => router.push('/signup' as any)}
                    >
                        <Text style={styles.signupButtonText}>
                            ساخت حساب کاربری جدید
                        </Text>
                    </TouchableOpacity>
                </View><View style={styles.footer}>
                    <Text style={styles.footerText}>
                        با ورود به AfghanChat با شرایط و قوانین موافقت می‌کنید
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#1a1a1a',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
    },
    input: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    forgotPasswordButton: {
        alignSelf: 'flex-start',
        marginBottom: 24,
    },
    forgotPasswordText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '500',
    },
    loginButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    loginButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e9ecef',
    },
    dividerText: {
        paddingHorizontal: 16,
        color: '#666',
        fontSize: 14,
    },
    signupButton: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    signupButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 32,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
    },
});