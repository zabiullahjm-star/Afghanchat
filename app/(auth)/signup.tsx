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

export default function SignUpScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const handleSignUp = async () => {
        // اعتبارسنجی
        if (!formData.fullName.trim()) {
            Alert.alert('خطا', 'لطفا نام کامل خود را وارد کنید');
            return;
        }

        if (!formData.email.trim()) {
            Alert.alert('خطا', 'لطفا ایمیل خود را وارد کنید');
            return;
        }

        if (!formData.password) {
            Alert.alert('خطا', 'لطفا رمز عبور خود را وارد کنید');
            return;
        }

        if (formData.password.length < 6) {
            Alert.alert('خطا', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            Alert.alert('خطا', 'رمز عبور و تکرار آن مطابقت ندارند');
            return;
        }

        try {
            setLoading(true);

            const { data, error } = await supabase.auth.signUp({
                email: formData.email.toLowerCase().trim(),
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName.trim(),
                    }
                }
            });

            if (error) {
                throw error;
            }

            if (data.user) {
                Alert.alert(
                    'ثبت‌نام موفق',
                    'حساب کاربری شما با موفقیت ایجاد شد. لطفا ایمیل خود را برای تأیید حساب بررسی کنید.',
                    [
                        {
                            text: 'ورود به حساب',
                            onPress: () => router.push('/login' as any)
                        }
                    ]
                );
            }

        } catch (error: any) {
            Alert.alert('خطا در ثبت‌نام', error.message || 'خطایی در ایجاد حساب کاربری رخ داده است');
        } finally {
            setLoading(false);
        }
    };

    const updateFormData = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>حساب جدید</Text>
                    <Text style={styles.subtitle}>ثبت‌نام در AfghanChat</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>نام کامل</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="نام و نام خانوادگی"
                            value={formData.fullName}
                            onChangeText={(text) => updateFormData('fullName', text)}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>ایمیل</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="example@email.com"
                            value={formData.email}
                            onChangeText={(text) => updateFormData('email', text)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>رمز عبور</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="حداقل ۶ کاراکتر"
                            value={formData.password}
                            onChangeText={(text) => updateFormData('password', text)}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View><View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>تکرار رمز عبور</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="رمز عبور را مجدداً وارد کنید"
                            value={formData.confirmPassword}
                            onChangeText={(text) => updateFormData('confirmPassword', text)}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.signupButton, loading && styles.buttonDisabled]}
                        onPress={handleSignUp}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.signupButtonText}>ایجاد حساب کاربری</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>حساب دارید؟</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={() => router.push('/login' as any)}
                    >
                        <Text style={styles.loginButtonText}>
                            ورود به حساب موجود
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        با ایجاد حساب با شرایط و قوانین AfghanChat موافقت می‌کنید
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
    signupButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    signupButtonText: {
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
    loginButton: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    loginButtonText: {
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