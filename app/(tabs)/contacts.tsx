import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
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
    AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import * as Contacts from 'expo-contacts';
import * as SecureStore from 'expo-secure-store';
import ThemedView from '../../components/themed-view';
import ThemedText from '../../components/themed-text';

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
    const { colors } = useTheme();

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [deviceMatches, setDeviceMatches] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchFocused, setSearchFocused] = useState(false);

    const appStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);
    const searchInputRef = useRef<any>(null);
    const CACHE_PREFIX = 'afghanchat:';
    const debounceRef = useRef<number | null>(null);

    useEffect(() => {
        getCurrentUser();
        const sub = AppState.addEventListener('change', _handleAppStateChange);
        return () => {
            try {
                (sub as any).remove?.();
            } catch (e) {
                // noop
            }
        };
    }, []);

    useEffect(() => {
        if (currentUser) {
            loadCachedDeviceMatches(currentUser.id).then(() => {
                checkDeviceContacts(currentUser.id);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    const _handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
            checkDeviceContacts(currentUser?.id);
        }
        appStateRef.current = nextAppState;
    };

    const loadCachedDeviceMatches = async (userId?: string | null) => {
        if (!userId) return;
        try {
            const raw = await SecureStore.getItemAsync(CACHE_PREFIX + 'devicematches:' + userId);
            if (raw) {
                const parsed = JSON.parse(raw) as Profile[];
                if (parsed && parsed.length > 0) {
                    setDeviceMatches(parsed);
                }
            }
        } catch (e) {
            console.warn('loadCachedDeviceMatches error', e);
        }
    };

    const saveCachedDeviceMatches = async (userId: string | undefined | null, matches: Profile[]) => {
        if (!userId) return;
        try {
            await SecureStore.setItemAsync(CACHE_PREFIX + 'devicematches:' + userId, JSON.stringify(matches));
        } catch (e) {
            console.warn('saveCachedDeviceMatches error', e);
        }
    };

    const getCurrentUser = async () => {
        try {
            const { data } = await supabase.auth.getUser();
            const user = data?.user ?? null;
            setCurrentUser(user);
            if (user?.id) {
                await loadCachedDeviceMatches(user.id);
                checkDeviceContacts(user.id);
            }
        } catch (e) {
            console.warn('getCurrentUser error', e);
            setCurrentUser(null);
        }
    };

    const checkDeviceContacts = async (userId?: string | null) => {
        try {
            let permissionGranted = false;

            if (Platform.OS === 'android') {
                if (typeof Contacts.requestPermissionsAsync === 'function') {
                    const { status } = await Contacts.requestPermissionsAsync();
                    permissionGranted = status === 'granted';
                } else {
                    const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
                    permissionGranted = status === PermissionsAndroid.RESULTS.GRANTED;
                }
            } else {
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

            if (!permissionGranted) return;

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
                    if (digits.length > 10) digitsSet.add(digits.slice(-10));
                }
            }

            const uniqueDigits = Array.from(digitsSet);
            if (uniqueDigits.length === 0) {
                setDeviceMatches([]);
                return;
            }

            const query = supabase
                .from('profiles')
                .select('*')
                .in('phone_digits', uniqueDigits)
                .limit(200);

            const { data: found, error } = userId ? await query.neq('id', userId) : await query;

            if (error) {
                console.warn('checkDeviceContacts supabase error', error);
                return;
            }

            setDeviceMatches(found || []);
            if (userId) saveCachedDeviceMatches(userId, found || []).catch(e => console.warn('saveCachedDeviceMatches', e));
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

            const orParts: string[] = [];
            orParts.push(`full_name.ilike.%${query}%`);
            orParts.push(`username.ilike.%${query}%`);
            orParts.push(`phone_digits.ilike.%${query}%`);
            if (queryDigits.length > 0) {
                orParts.push(`phone_digits.ilike.%${queryDigits}%`);
                if (queryDigits.length > 10) orParts.push(`phone_digits.ilike.%${queryDigits.slice(-10)}%`);
                if (queryDigits.length <= 10) orParts.push(`phone_digits.ilike.%${queryDigits}%`);
            }

            const orFilter = orParts.join(',');

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

    useEffect(() => {
        if (!searchQuery) {
            setProfiles([]);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            searchUsers();
        }, 350) as unknown as number;
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const startChat = async (profile: Profile) => {
        if (!currentUser) return;

        try {
            const roomId = `room_${[currentUser.id, profile.id].sort().join('_')}`;

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

    const combinedResults = useMemo(() => {
        if (!deviceMatches || deviceMatches.length === 0) return profiles;
        const ids = new Set(deviceMatches.map(d => d.id));
        return [...deviceMatches, ...profiles.filter(p => !ids.has(p.id))];
    }, [deviceMatches, profiles]);

    return (
        <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
            <ThemedView style={styles.header}>
                <ThemedText style={styles.title}>🔍 جستجوی کاربران</ThemedText>
                <ThemedText style={styles.subtitle}>همه کاربران AfghanChat</ThemedText>
            </ThemedView>

            <ThemedView style={styles.searchContainer}>
                <ThemedView style={[styles.searchInputContainer, searchFocused && styles.searchInputFocused]}>
                    <TextInput
                        ref={searchInputRef}
                        style={styles.searchInput}
                        placeholder="جستجو با نام، نام کاربری یا شماره"
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearchSubmit}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        blurOnSubmit={false}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                            <Text style={styles.clearText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </ThemedView>
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
            </ThemedView>

            {searching && (
                <ThemedView style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.loadingText}>در حال جستجو...</Text>
                </ThemedView>
            )}

            <FlatList
                data={combinedResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.contactItem}
                        onPress={() => startChat(item)}
                    >
                        <ThemedView style={styles.avatar}>
                            <ThemedText style={[styles.avatarText]}>
                                {getInitials(item.full_name)}
                            </ThemedText>
                        </ThemedView>

                        <ThemedView style={styles.contactInfo}>
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
                        </ThemedView>

                        <ThemedView style={styles.chatButton}>
                            <ThemedText style={styles.chatButtonText}>
                                چت
                            </ThemedText>
                        </ThemedView>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <ThemedView style={styles.emptyContainer}>
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
                    </ThemedView>
                }
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={false}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        color: '#666',
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
        paddingHorizontal: 12,
    },
    searchInputFocused: {
        borderColor: '#007AFF',
        backgroundColor: '#fff',
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1a1a1a',
    },
    clearButton: {
        padding: 4,
    },
    clearText: {
        fontSize: 16,
        color: '#999',
        fontWeight: 'bold',
    },
    searchButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchButtonDisabled: {
        opacity: 0.6,
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    loadingText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
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
        marginVertical: 4,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    contactInfo: {
        flex: 1,
    },
    contactName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#1a1a1a',
    },
    contactUsername: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    contactPhone: {
        fontSize: 13,
        color: '#4CAF50',
    },
    chatButton: {
        backgroundColor: '#f0f7ff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 24,
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        lineHeight: 20,
    },
});