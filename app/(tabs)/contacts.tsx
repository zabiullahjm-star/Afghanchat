import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
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
    Image,
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

const CACHE_PREFIX = 'afghanchat:';
const CHUNK_BATCH = 100; // safe batch size for .in queries
const MAX_RESULTS = 200;

export default function ContactsScreen() {
    const router = useRouter();
    const { colors } = useTheme();

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [deviceMatches, setDeviceMatches] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchFocused, setSearchFocused] = useState(false);
    const [loadingContacts, setLoadingContacts] = useState(false);

    const appStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);
    const searchInputRef = useRef<any>(null);
    const debounceRef = useRef<number | null>(null);
    const isFocused = useIsFocused();
    const checkedRef = useRef<boolean>(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        getCurrentUser();
        const sub = AppState.addEventListener('change', _handleAppStateChange);
        return () => {
            mountedRef.current = false;
            try {
                (sub as any).remove?.();
            } catch {
                // noop
            }
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Run cached load + device check once per focus session
    useEffect(() => {
        if (isFocused && currentUser && !checkedRef.current) {
            checkedRef.current = true;
            (async () => {
                try {
                    await loadCachedDeviceMatches(currentUser.id);
                    await checkDeviceContacts(currentUser.id);
                } catch (e) {
                    console.warn('contacts focus check error', e);
                    if (mountedRef.current) setDeviceMatches([]);
                }
            })();
        }
        if (!isFocused) {
            checkedRef.current = false;
        }
    }, [isFocused, currentUser]);

    const _handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
            if (isFocused && currentUser && !checkedRef.current) {
                checkedRef.current = true;
                checkDeviceContacts(currentUser.id).catch(e => console.warn('checkDeviceContacts', e));
            }
        }
        appStateRef.current = nextAppState;
    };

    const loadCachedDeviceMatches = async (userId?: string | null) => {
        if (!userId) return;
        try {
            const raw = await SecureStore.getItemAsync(CACHE_PREFIX + 'devicematches:' + userId);
            if (raw) {
                const parsed = JSON.parse(raw) as Profile[];
                if (parsed && parsed.length > 0 && mountedRef.current) {
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
            if (!mountedRef.current) return;
            setCurrentUser(user);
            if (user?.id) {
                await loadCachedDeviceMatches(user.id);
            }
        } catch (e) {
            console.warn('getCurrentUser error', e);
            if (mountedRef.current) setCurrentUser(null);
        }
    };

    // chunked fetch helper to avoid long query strings
    const fetchProfilesByPhoneDigits = async (digits: string[], userId?: string | null, maxResults = MAX_RESULTS) => {
        if (!digits || digits.length === 0) return [];
        const batchSize = CHUNK_BATCH;
        const resultsMap = new Map<string, any>();

        for (let i = 0; i < digits.length; i += batchSize) {
            const batch = digits.slice(i, i + batchSize);
            try {
                let q: any = supabase.from('profiles').select('*').in('phone_digits', batch).limit(maxResults);
                if (userId) q = q.neq('id', userId);
                const { data, error } = await q;
                if (error) {
                    console.warn('profiles fetch batch error', error);
                    continue;
                }
                if (data && Array.isArray(data)) {
                    data.forEach((p: any) => {
                        if (p && p.id && !resultsMap.has(p.id)) resultsMap.set(p.id, p);
                    });
                }
                if (resultsMap.size >= maxResults) break;
            } catch (e) {
                console.warn('profiles fetch batch exception', e);
                continue;
            }
        }
        return Array.from(resultsMap.values()).slice(0, maxResults);
    };

    const checkDeviceContacts = async (userId?: string | null) => {
        if (!mountedRef.current) return;
        setLoadingContacts(true);
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

            if (!permissionGranted) {
                setDeviceMatches([]);
                setLoadingContacts(false);
                return;
            }

            const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
            if (!data || data.length === 0) {
                setDeviceMatches([]);
                setLoadingContacts(false);
                return;
            }

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
                setLoadingContacts(false);
                return;
            }

            const found = await fetchProfilesByPhoneDigits(uniqueDigits, userId, MAX_RESULTS);
            if (!found || !Array.isArray(found) || found.length === 0) {
                setDeviceMatches([]);
            } else {
                if (mountedRef.current) setDeviceMatches(found);
                if (userId) saveCachedDeviceMatches(userId, found).catch(e => console.warn('saveCachedDeviceMatches', e));
            }
        } catch (e) {
            console.warn('checkDeviceContacts error', e);
            if (mountedRef.current) setDeviceMatches([]);
        } finally {
            if (mountedRef.current) setLoadingContacts(false);
        }
    };

    // Debounced search for profiles (safe for RN)
    const onSearch = useCallback((query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setProfiles([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            debounceRef.current = null;
            try {
                // flexible search: match username or full_name or phone
                const q = query.trim();
                const orFilter = `username.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`;
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .or(orFilter)
                    .neq('id', currentUser?.id)
                    .order('full_name', { ascending: true })
                    .limit(50);

                if (error) {
                    console.warn('search profiles error', error);
                    if (mountedRef.current) setProfiles([]);
                } else {
                    if (mountedRef.current) setProfiles(data || []);
                }
            } catch (e) {
                console.warn('search profiles exception', e);
                if (mountedRef.current) setProfiles([]);
            } finally {
                if (mountedRef.current) setSearching(false);
            }
        }, 350) as unknown as number;
    }, [currentUser]);

    const clearSearchLocal = () => {
        setSearchQuery('');
        setProfiles([]);
        setSearching(false);
        if (searchInputRef.current) searchInputRef.current.blur?.();
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
    };

    const startChat = async (profile: Profile) => {
        if (!currentUser) return;
        try {
            const roomId = `room_${[currentUser.id, profile.id].sort().join('_')}`;
            // ensure room exists by inserting a system message if none
            const { data: existingMessages, error: checkError } = await supabase
                .from('messages')
                .select('id')
                .eq('chat_room_id', roomId)
                .limit(1);

            if (checkError) console.warn('check room error', checkError);

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
                if (insertError) console.warn('create room error', insertError);
            }

            router.push({ pathname: '/chat/[roomId]', params: { roomId, otherUserName: profile.full_name || 'کاربر' } } as any);
        } catch (e) {
            console.warn('startChat error', e);
            Alert.alert('خطا', 'مشکلی در شروع چت پیش آمد');
        }
    };

    const renderProfileItem = ({ item }: { item: Profile }) => (
        <TouchableOpacity onPress={() => startChat(item)} style={[styles.profileItem, { borderColor: colors.border }]}>
            <View style={styles.avatarContainer}>
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarPlaceholderText}>{(item.username || item.full_name || 'U').charAt(0).toUpperCase()}</Text>
                    </View>
                )}
            </View>
            <View style={styles.infoContainer}>
                <Text style={[styles.username, { color: colors.text }]}>{item.full_name || item.username}</Text>
                {item.username && <Text style={[styles.fullName, { color: colors.textSecondary }]}>@{item.username}</Text>}
                {item.phone && <Text style={[styles.fullName, { color: colors.text }]}>{item.phone}</Text>}
            </View>
            <View style={styles.chatButton}>
                <ThemedText style={{ color: colors.primary }}>چت</ThemedText>
            </View>
        </TouchableOpacity>
    );

    const listData = useMemo(() => (searchQuery.trim() ? profiles : deviceMatches), [searchQuery, profiles, deviceMatches]);

    return (
        <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <ThemedText style={styles.title}>🔍 جستجوی کاربران</ThemedText>
                <TouchableOpacity onPress={() => { if (currentUser?.id) { checkedRef.current = false; checkDeviceContacts(currentUser.id); } }}>
                    <ThemedText style={[styles.refreshText, { color: colors.primary }]}>بروزرسانی</ThemedText>
                </TouchableOpacity>
            </View>

            <View style={[styles.searchContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <TextInput
                    ref={searchInputRef}
                    style={[styles.searchInput, { borderColor: colors.border, color: colors.Themedtext }]}
                    placeholder="جستجو با نام، نام کاربری یا شماره"
                    placeholderTextColor={colors.placeholder}
                    value={searchQuery}
                    onChangeText={onSearch}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={clearSearchLocal} style={styles.clearSearch}>
                        <ThemedText style={[styles.clearSearchText, { color: colors.primary }]}>✕</ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            {loadingContacts && (
                <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <ThemedText style={{ marginLeft: 8, color: colors }}>در حال بررسی مخاطبین...</ThemedText>
                </View>
            )}

            <FlatList
                data={listData}
                keyExtractor={(item) => item.id}
                renderItem={renderProfileItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <ThemedText style={[styles.emptyText, { color: colors }]}>
                            {searching ? 'در حال جستجو...' : (searchQuery ? 'نتیجه‌ای یافت نشد' : 'مخاطبی در دستگاه یافت نشد')}
                        </ThemedText>
                    </View>
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
    title: { fontSize: 20, fontWeight: 'bold' },
    refreshText: { fontSize: 14 },
    searchContainer: { padding: 12, borderBottomWidth: 1 },
    searchInput: { height: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, fontSize: 16 },
    clearSearch: { position: 'absolute', right: 24, top: 22 },
    clearSearchText: { fontSize: 16 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    listContent: { padding: 12 },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 16 },
    profileItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    avatarContainer: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', marginRight: 12 },
    avatar: { width: '100%', height: '100%', resizeMode: 'cover' },
    avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' },
    avatarPlaceholderText: { fontSize: 18, fontWeight: '700', color: '#007AFF' },
    infoContainer: { flex: 1 },
    username: { fontSize: 16, fontWeight: 'bold' },
    fullName: { fontSize: 13,},
    chatButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#007AFF' },
});