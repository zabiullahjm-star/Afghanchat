import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface Profile {
    id: string;
    username: string | null;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    created_at: string;
}

export default function ContactsScreen() {
    const router = useRouter();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchFocused, setSearchFocused] = useState(false);

    useEffect(() => {
        getCurrentUser();
    }, []);

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
    };

    const searchUsers = async () => {
        if (!searchQuery.trim()) {
            setProfiles([]);
            return;
        }

        try {
            setSearching(true);

            const query = searchQuery.trim().toLowerCase();
            const searchPattern = `%${query}%`;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .or(`full_name.ilike.% ${query} %, username.ilike.${searchPattern},username.ilike.${searchPattern}`)
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
                        content: ` چت با ${profile.full_name || 'کاربر'} شروع شد`,
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
    }; return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🔍 جستجوی کاربران</Text>
                <Text style={styles.subtitle}>همه کاربران AfghanChat</Text>
            </View>

            <View style={styles.searchContainer}>
                <View style={[styles.searchInputContainer, searchFocused && styles.searchInputFocused]}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="جستجو با نام، نام کاربری "
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
                data={profiles}
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
                                : 'برای شروع جستجو، نام یا نام کاربری را وارد کنید'
                            }
                        </Text>
                        {!searchQuery && (
                            <Text style={styles.emptySubText}>
                                می‌توانید با نام، نام کاربری یا شماره تلفن جستجو کنید
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
        gap: 12
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
        gap: 8
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