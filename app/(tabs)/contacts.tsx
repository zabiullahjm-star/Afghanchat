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

interface Person {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
    is_online: boolean;
    last_seen: string;
}

export default function ContactsScreen() {
    const router = useRouter();
    const [persons, setPersons] = useState<Person[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPersons();
    }, []);

    const fetchPersons = async () => {
        try {
            setLoading(true);

            // فعلاً از داده‌های تستی استفاده می‌کنیم
            const testData: Person[] = [
                {
                    id: 'user2',
                    name: 'سارا محمدی',
                    username: 'sara_mohammadi',
                    avatar_url: null,
                    is_online: true,
                    last_seen: new Date().toISOString()
                },
                {
                    id: 'user3',
                    name: 'رضا کریمی',
                    username: 'reza_karimi',
                    avatar_url: null,
                    is_online: false,
                    last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 ساعت پیش
                },
                {
                    id: 'user4',
                    name: 'نازنین احمدی',
                    username: 'nazanin_ahmadi',
                    avatar_url: null,
                    is_online: true,
                    last_seen: new Date().toISOString()
                },
                {
                    id: 'user5',
                    name: 'امیر حسینی',
                    username: 'amir_hosseini',
                    avatar_url: null,
                    is_online: true,
                    last_seen: new Date().toISOString()
                }
            ];

            setPersons(testData);

        } catch (error) {
            console.error('خطا:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPersons = persons.filter(person =>
        person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startChat = async (person: Person) => {
        try {
            // ساخت یک roomId منحصر به فرد
            const roomId = `room_${['user1', person.id].sort().join('_')
                }`;

            // بررسی آیا اتاق چت از قبل وجود داره
            const { data: existingMessages } = await supabase
                .from('messages')
                .select('id')
                .eq('chat_room_id', roomId)
                .limit(1);

            // اگر اتاق وجود نداره، یک پیام خوش‌آمدگویی ایجاد کن
            if (!existingMessages || existingMessages.length === 0) {
                await supabase.from('messages').insert([
                    {
                        chat_room_id: roomId,
                        sender_id: 'system',
                        content: ` چت با ${person.name} شروع شد`,
                        message_type: 'system'
                    }
                ]);
            }

            // برو به صفحه چت
            router.push({
                pathname: "/chat/[roomId]",
                params: {
                    roomId,
                    otherUserName: person.name
                }
            } as any);

        } catch (error) {
            Alert.alert('خطا', '.مشکلی در شروع چت پیش آمد');
        }
    };

    const getStatusText = (person: Person) => {
        if (person.is_online) return 'آنلاین';

        const lastSeen = new Date(person.last_seen);
        const now = new Date();
        const diffHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

        if (diffHours < 1) return `${Math.floor(diffHours * 60)} دقیقه پیش`;
        if (diffHours < 24) return `${Math.floor(diffHours)} ساعت پیش`;
        return `${Math.floor(diffHours / 24)} روز پیش`;
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text>در حال بارگذاری مخاطبین...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>👥 مخاطبین</Text>
                <Text style={styles.subtitle}>{persons.length} مخاطب</Text>
            </View>{/* نوار جستجو */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="جستجو در مخاطبین..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={filteredPersons}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.contactItem}
                        onPress={() => startChat(item)}
                    >
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {item.name.charAt(0)}
                                </Text>
                            </View>
                            {item.is_online && <View style={styles.onlineIndicator} />}
                        </View>

                        <View style={styles.contactInfo}>
                            <Text style={styles.contactName}>{item.name}</Text>
                            <Text style={styles.contactUsername}>@{item.username}</Text>
                        </View>

                        <View style={styles.statusContainer}>
                            <Text style={[
                                styles.statusText,
                                item.is_online ? styles.onlineText : styles.offlineText
                            ]}>
                                {getStatusText(item)}
                            </Text>
                            <Text style={styles.startChatText}>شروع چت</Text>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'مخاطبی یافت نشد' : 'هنوز مخاطبی ندارید'}
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
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
        backgroundColor: '#fff'
    },
    searchInput: {
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        fontSize: 16
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
        borderColor: 'white'
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
        color: '#666'
    },
    statusContainer: {
        alignItems: 'flex-end'
    },
    statusText: {
        fontSize: 12,
        marginBottom: 4
    },
    onlineText: {
        color: '#4CAF50'
    },
    offlineText: {
        color: '#999'
    },
    startChatText: {
        fontSize: 12,
        color: '#007AFF'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 50
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center'
    }
});