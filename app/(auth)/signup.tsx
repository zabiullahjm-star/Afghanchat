import ThemedText from '@/components/themed-text';
import ThemedView from '@/components/themed-view';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabaseClient';

export default function SignUpScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { colors, isDark } = useTheme();
    const placeholderColor = isDark ? '#9aa0a6' : '#9b9b9b';

    // Typed form data for clarity
    interface FormData {
        fullName: string;
        email: string;
        password: string;
        confirmPassword: string;
        phone_digits: string;
    }

    const [formData, setFormData] = useState<FormData>({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone_digits: '',
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

        if (!formData.phone_digits.trim()) {
            Alert.alert('خطا', 'لطفا شماره موبایل خود را وارد کنید');
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

            const normalizedPhoneDigits = formData.phone_digits.replace(/\D/g, ''); // فقط ارقام برای جستجو

            const { data, error } = await supabase.auth.signUp({
                email: formData.email.toLowerCase().trim(),
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName.trim(),
                        phone: formData.phone_digits.trim()
                    }
                }
            });

            if (error) {
                throw error;
            }

            if (data.user) {
                // ایجاد یا بروزرسانی پروفایل در جدول profiles با فیلد phone_digits برای جستجوی راحت
                try {
                    const upsertData = {
                        id: data.user.id,
                        full_name: formData.fullName.trim(),
                        phone_digits: normalizedPhoneDigits,
                        // username می‌تواند بعدا تنظیم شود
                    };
                    const { error: upsertErr } = await supabase.from('profiles').upsert([upsertData]);
                    if (upsertErr) {
                        console.warn('profiles upsert error', upsertErr);
                    }
                } catch (e) {
                    console.warn('upsert profile error', e);
                }

                Alert.alert(
                    'ثبت‌نام موفق',
                    'حساب کاربری شما با موفقیت ایجاد شد. لطفا ایمیل خود را برای تأیید حساب بررسی کنید. در صورت نیاز به ورود، می‌توانید به صفحه ورود بروید.',
                    [
                        {
                            text: 'باشه',
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

    const updateFormData = (field: keyof FormData, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <ThemedView style={styles.header}>
                    <ThemedText style={[styles.title, { color: colors.text }]}>حساب جدید</ThemedText>
                    <ThemedText style={[styles.subtitle, { color: colors.text }]}>ثبت‌نام در AfghanChat</ThemedText>
                </ThemedView>

                <ThemedView style={[styles.form, {
                    backgroundColor: colors.surface,
                    padding: 18,
                    borderRadius: 12,
                }]}>
                    <ThemedView style={styles.inputContainer}>
                        <ThemedText style={[styles.inputLabel, { color: colors.text }]}>نام کامل</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#222' : '#f7f9fc', color: colors.text, textAlign: 'right' }]}
                            placeholder="نام. و. نام خانوادگی"
                            placeholderTextColor={placeholderColor}
                            accessibilityLabel="نام کامل"
                            value={formData.fullName}
                            onChangeText={(text) => updateFormData('fullName', text)}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />
                    </ThemedView>

                    <ThemedView style={styles.inputContainer}>
                        <ThemedText style={[styles.inputLabel, { color: colors.text }]}>ایمیل</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#222' : '#f7f9fc', color: colors.text, textAlign: 'right' }]}
                            placeholder="example@email.com"
                            placeholderTextColor={placeholderColor}
                            accessibilityLabel="ایمیل"
                            value={formData.email}
                            onChangeText={(text) => updateFormData('email', text)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </ThemedView>

                    <ThemedView style={styles.inputContainer}>
                        <ThemedText style={[styles.inputLabel, { color: colors.text }]}>رمز عبور</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#222' : '#f7f9fc', color: colors.text, textAlign: 'right' }]}
                            placeholder="حداقل ۶ کاراکتر"
                            placeholderTextColor={placeholderColor}
                            accessibilityLabel="رمز عبور"
                            value={formData.password}
                            onChangeText={(text) => updateFormData('password', text)}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </ThemedView>
                    <ThemedView style={styles.inputContainer}>
                        <ThemedText style={[styles.inputLabel, { color: colors.text }]}>تکرار رمز عبور</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#222' : '#f7f9fc', color: colors.text, textAlign: 'right' }]}
                            placeholder="رمز عبور را مجدداً وارد کنید"
                            placeholderTextColor={placeholderColor}
                            accessibilityLabel="تکرار رمز عبور"
                            value={formData.confirmPassword}
                            onChangeText={(text) => updateFormData('confirmPassword', text)}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </ThemedView>

                    {/* جدید: شماره موبایل */}
                    <ThemedView style={styles.inputContainer}>
                        <ThemedText style={[styles.inputLabel, { color: colors.text }]}>شماره موبایل</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#222' : '#f7f9fc', color: colors.text, textAlign: 'right' }]}
                            placeholder="+98 912 345 6789 یا 09123456789"
                            placeholderTextColor={placeholderColor}
                            value={formData.phone_digits}
                            onChangeText={(text) => updateFormData('phone_digits', text)}
                            accessibilityLabel="شماره موبایل"
                            keyboardType="phone-pad"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <ThemedText style={[styles.helperText, { color: colors.text }]}>شماره برای جستجو و شناسایی مخاطبین ذخیره می‌شود</ThemedText>
                    </ThemedView>

                    <TouchableOpacity
                        style={[styles.signupButton, loading && styles.buttonDisabled, { backgroundColor: colors.primary }]}
                        onPress={handleSignUp}
                        disabled={loading}
                        accessibilityRole="button"
                        accessible
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <ThemedText style={[styles.signupButtonText, { color: '#fff' }]}>ایجاد حساب کاربری</ThemedText>
                        )}
                    </TouchableOpacity>

                    <ThemedView style={styles.divider}>
                        <ThemedView style={[styles.dividerLine, { backgroundColor: isDark ? '#333' : '#e6eefb' }]} />
                        <ThemedText style={[styles.dividerText, { color: colors.text }]}>حساب دارید؟</ThemedText>
                        <ThemedView style={[styles.dividerLine, { backgroundColor: isDark ? '#333' : '#e6eefb' }]} />
                    </ThemedView>

                    <TouchableOpacity
                        style={[styles.loginButton, { borderColor: colors.primary }]}
                        onPress={() => router.push('/login' as any)}
                        accessibilityRole="button"
                        accessible
                        activeOpacity={0.8}
                    >
                        <ThemedText style={[styles.loginButtonText, { color: colors.primary }]}>
                            ورود به حساب موجود
                        </ThemedText>
                    </TouchableOpacity>
                </ThemedView>

                <ThemedView style={styles.footer}>
                    <ThemedText style={[styles.footerText, { color: colors.text }]}>
                        با ایجاد حساب با شرایط و قوانین AfghanChat موافقت می‌کنید
                    </ThemedText>
                </ThemedView>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,

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

    },
    subtitle: {
        fontSize: 16,

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

    },
    input: {

        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    helperText: {
        fontSize: 12,

        marginTop: 4
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

        textAlign: 'center',
    },
});