import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    Alert,
    AppState,
    Platform,
    PermissionsAndroid,
    AppStateStatus, // <-- added
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import * as Contacts from 'expo-contacts';

interface Profile {
    id: string;
    username: string | null;
    full_name: string | null;
    phone: string | null;
    phone_digits?: string | null;
    avatar_url: string | null;
    created_at: string;
}

export default function ContactsScreen() {
    const router = useRouter();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [deviceMatches, setDeviceMatches] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchFocused, setSearchFocused] = useState(false);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);

    useEffect(() => {
        getCurrentUser();
        const sub = AppState.addEventListener('change', _handleAppStateChange);
        return () => {
            // برخی نسخه‌ها remove() دارند، برخی removeEventListener — سازگارانه حذف می‌کنیم:
            try {
                (sub as any).remove?.();
            } catch (e) {
                // fallback: nothing
            }
        };
    }, []);

    // هر بار user تغییر کرد مخاطبین دستگاه را بررسی کن (برای جلوگیری از race)
    useEffect(() => {
        if (currentUser) {
            checkDeviceContacts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    const _handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
            // اپ در foreground برگشته -> چک مخاطبین دوباره
            checkDeviceContacts();
        }
        appStateRef.current = nextAppState;
    };

    const getCurrentUser = async () => {
        const { data } = await supabase.auth.getUser();
        setCurrentUser(data?.user ?? null);
    };

    // بررسی مخاطبین دستگاه و یافتن اکانت‌های ثبت‌شده
    const checkDeviceContacts = async () => {
        try {
            // بررسی و درخواست مجوز با fallback برای حالت‌های مختلف API
            let permissionGranted = false;

            if (Platform.OS === 'android') {
                // اگر expo-contacts متد requestPermissionsAsync دارد از آن استفاده کن، در غیر اینصورت از PermissionsAndroid
                if (typeof Contacts.requestPermissionsAsync === 'function') {
                    const { status } = await Contacts.requestPermissionsAsync();
                    permissionGranted = status === 'granted';
                } else {
                    const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
                    permissionGranted = status === PermissionsAndroid.RESULTS.GRANTED;
                }
            } else {
                // iOS: ابتدا تلاش کن getPermissionsAsync سپس در صورت نیاز requestPermissionsAsync
                if (typeof Contacts.getPermissionsAsync === 'function') {
                    const perm = await Contacts.getPermissionsAsync();
                    if (perm.status === 'granted') permissionGranted = true;
                    else if (typeof Contacts.requestPermissionsAsync === 'function') {
                        const req = await Contacts.requestPermissionsAsync();
                        permissionGranted = req.status === 'granted';
                    }
                } else if (typeof Contacts.requestPermissionsAsync === 'function') {
                    const req = await Contacts.requestPermissionsAsync();
                    permissionGranted = req.status === 'granted';
                }
            }

            if (!permissionGranted) {
                // کاربر مجوز را نپذیرفته — خاموش کن یا اطلاع بده
                return;
            }

            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
            });

            if (!data || data.length === 0) return;

            const digitsSet = new Set<string>();
            for (const c of data) {
                if (!c.phoneNumbers) continue;
                for (const pn of c.phoneNumbers) {
                    const raw = pn.number || '';
                    const digits = raw.replace(/\D/g, '');
                    if (!digits) continue;
                    digitsSet.add(digits);
                    // اگر طول بیشتر از 10 است، ورژن آخر 10 رقم را هم اضافه کن (برای شماره‌های محلی)
                    if (digits.length > 10) {
                        digitsSet.add(digits.slice(-10));
                    }
                }
            }

            const uniqueDigits = Array.from(digitsSet);
            if (uniqueDigits.length === 0) {
                setDeviceMatches([]);
                return;
            }

            // گرفتن پروفایل‌هایی که phone_digits یکی از مقادیر ماست
            const { data: found, error } = await supabase
                .from('profiles')
                .select('*')
                .in('phone_digits', uniqueDigits)
                .neq('id', currentUser?.id)
                .limit(200);

            if (error) {
                console.warn('checkDeviceContacts supabase error', error);
                return;
            }

            setDeviceMatches(found || []);
        } catch (e) {
            console.warn('checkDeviceContacts error', e);
        }
    };

    const searchUsers = async () => {
        if (!searchQuery.trim()) {
            setProfiles([]);
            return;
        }

        try {
            setSearching(true);

            const query = searchQuery.trim();
            const queryDigits = query.replace(/\D/g, '');
            const searchPattern = `%${query}%`;

            // جستجو در full_name، username، phone و phone_digits (برای پشتیبانی از فرمت‌های مختلف شماره)
            const orFilter = `full_name.ilike.%${query}%,username.ilike.%${query}%,phone.ilike.%${query}%,phone_digits.ilike.%${queryDigits}%`;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .or(orFilter)
                .neq('id', currentUser?.id)
                .order('full_name', { ascending: true })
                .limit(50);

            if (error) {
                console.error('خطا در جستجو:', error);
                Alert.alert('خطا', 'مشکلی در جستجو پیش آمد');
                return;
            }

            setProfiles(data || []);

        } catch (error) {
            console.error('خطا:', error);
            Alert.alert('خطا', 'مشکلی در جستجو پیش آمد');
        } finally {
            setSearching(false);
        }
    };

    const startChat = async (profile: Profile) => {
        if (!currentUser) return;

        try {
            const roomId = `room_${[currentUser.id, profile.id].sort().join('_')
                }`;

            const { data: existingMessages, error: checkError } = await supabase
                .from('messages')
                .select('id')
                .eq('chat_room_id', roomId)
                .limit(1);

            if (checkError) {
                console.error('خطا در بررسی چت:', checkError);
            }

            if (!existingMessages || existingMessages.length === 0) {
                const { error: insertError } = await supabase.from('messages').insert([
                    {
                        chat_room_id: roomId,
                        sender_id: 'system',
                        receiver_id: profile.id,
                        content: `چت با ${profile.full_name || 'کاربر'} شروع شد`,
                        message_type: 'system'
                    }
                ]);

                if (insertError) {
                    console.error('خطا در ایجاد چت:', insertError);
                }
            }

            router.push({
                pathname: "/chat/[roomId]",
                params: {
                    roomId,
                    otherUserName: profile.full_name || 'کاربر'
                }
            } as any);

        } catch (error) {
            console.error('خطا در شروع چت:', error);
            Alert.alert('خطا', 'مشکلی در شروع چت پیش آمد');
        }
    };

    const handleSearchSubmit = () => {
        searchUsers();
    };

    const clearSearch = () => {
        setSearchQuery('');
        setProfiles([]);
    };

    const getInitials = (name: string | null) => {
        if (!name) return 'U';
        return name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().substring(0, 2);
    };

    // ترکیب نتایج: ابتدا مخاطبین دستگاه (ثابت) سپس نتایج جستجو بدون تکرار
    const combinedResults = [
        ...deviceMatches,
        ...profiles.filter(p => !deviceMatches.find(dm => dm.id === p.id))
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🔍 جستجوی کاربران</Text>
                <Text style={styles.subtitle}>همه کاربران AfghanChat</Text>
            </View>

            <View style={styles.searchContainer}>
                <View style={[styles.searchInputContainer, searchFocused && styles.searchInputFocused]}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="جستجو با نام، نام کاربری یا شماره"
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearchSubmit}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                            <Text style={styles.clearText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={[styles.searchButton, searching && styles.searchButtonDisabled]}
                    onPress={handleSearchSubmit}
                    disabled={searching}
                >
                    {searching ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text style={styles.searchButtonText}>جستجو</Text>
                    )}
                </TouchableOpacity>
            </View>

            {searching && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.loadingText}>در حال جستجو...</Text>
                </View>
            )}

            <FlatList
                data={combinedResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.contactItem}
                        onPress={() => startChat(item)}
                    >
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {getInitials(item.full_name)}
                            </Text>
                        </View>

                        <View style={styles.contactInfo}>
                            <Text style={styles.contactName}>
                                {item.full_name || 'کاربر بدون نام'}
                            </Text>
                            <Text style={styles.contactUsername}>
                                @{item.username || 'بدون نام کاربری'}
                            </Text>
                            {item.phone && (
                                <Text style={styles.contactPhone}>
                                    📞 {item.phone}
                                </Text>
                            )}
                        </View>

                        <View style={styles.chatButton}>
                            <Text style={styles.chatButtonText}>
                                چت
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {searchQuery && !searching ?
                                'کاربری با این مشخصات یافت نشد'
                                : 'برای شروع جستجو، نام یا نام کاربری یا شماره را وارد کنید'
                            }
                        </Text>
                        {!searchQuery && (
                            <Text style={styles.emptySubText}>
                                می‌توانید با نام، نام کاربری یا شماره تلفن جستجو کنید. مخاطبین دستگاه نیز بالاتر نمایش داده می‌شوند.
                            </Text>
                        )}
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#331f1fff'
    },
    header: {
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#1a1a1a',
        marginBottom: 4
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        color: '#666'
    },
    searchContainer: {
        padding: 16,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#f8f9fa',
        paddingHorizontal: 12
    },
    searchInputFocused: {
        borderColor: '#007AFF',
        backgroundColor: '#fff'
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1a1a1a'
    },
    clearButton: {
        padding: 4
    },
    clearText: {
        fontSize: 16,
        color: '#999',
        fontWeight: 'bold'
    },
    searchButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchButtonDisabled: {
        opacity: 0.6
    },
    searchButtonText: {
        color: '#127e1bff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    loadingText: {
        fontSize: 14,
        color: '#666'
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 12,
        marginVertical: 4
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    avatarText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    },
    contactInfo: {
        flex: 1
    },
    contactName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#1a1a1a'
    },
    contactUsername: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2
    },
    contactPhone: {
        fontSize: 13,
        color: '#4CAF50'
    },
    chatButton: {
        backgroundColor: '#f0f7ff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF'
    },
    chatButtonText: {
        color: '#007AFF',
        fontSize: 14, fontWeight: 'bold'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100,
        paddingHorizontal: 40
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 24
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        lineHeight: 20
    }
});