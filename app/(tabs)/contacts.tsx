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
    username: string;
    full_name: string;
    phone: string;
    avatar_url: string;
    created_at: string;
}

export default function ContactsScreen() {
    const router = useRouter();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

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

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .or(`full_name.ilike.% ${searchQuery} %, username.ilike.% ${searchQuery} %, phone.ilike.% ${searchQuery} %`)
                .neq('id', currentUser?.id)
                .limit(20);

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

            const { data: existingMessages } = await supabase
                .from('messages')
                .select('id')
                .eq('chat_room_id', roomId)
                .limit(1);

            if (!existingMessages || existingMessages.length === 0) {
                await supabase.from('messages').insert([
                    {
                        chat_room_id: roomId,
                        sender_id: 'system',
                        content: ` چت با ${profile.full_name} شروع شد`,
                        message_type: 'system'
                    }
                ]);
            }

            router.push({
                pathname: "/chat/[roomId]",
                params: {
                    roomId,
                    otherUserName: profile.full_name
                }
            } as any);

        } catch (error) {
            Alert.alert('خطا', 'مشکلی در شروع چت پیش آمد');
        }
    };

    const handleSearchSubmit = () => {
        searchUsers();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🔍 جستجوی کاربران</Text>
                <Text style={styles.subtitle}>همه کاربران AfghanChat</Text>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="جستجو براساس نام، نام کاربری یا شماره تلفن..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearchSubmit} returnKeyType="search"
                />
                <TouchableOpacity
                    style={styles.searchButton}
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
                                {item.full_name?.charAt(0) || 'U'}
                            </Text>
                        </View>

                        <View style={styles.contactInfo}>
                            <Text style={styles.contactName}>
                                {item.full_name || 'کاربر بدون نام'}
                            </Text>
                            <Text style={styles.contactUsername}>
                                @{item.username}
                            </Text>
                            {item.phone && (
                                <Text style={styles.contactPhone}>
                                    📞 {item.phone}
                                </Text>
                            )}
                        </View>

                        <Text style={styles.startChatText}>
                            شروع چت
                        </Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {searchQuery ?
                                'کاربری با این مشخصات یافت نشد'
                                : 'برای جستجو، نام یا شماره کاربر را وارد کنید'
                            }
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    header: {
        padding: 16,
        paddingTop: 60,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#1a1a1a'
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        color: '#666',
        marginTop: 4
    },
    searchContainer: {
        padding: 16,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center'
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        marginRight: 8
    },
    searchButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center'
    },
    searchButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold'
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25, backgroundColor: '#007AFF',
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
        fontSize: 12,
        color: '#4CAF50'
    },
    startChatText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '500'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center'
    }
});