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
    phone?: string;
    englishName?: string;
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
                    name: 'نصرت تریدر',
                    username: 'sara_mohammadi',
                    avatar_url: null,
                    is_online: true,
                    last_seen: new Date().toISOString()
                },
                {
                    id: 'user3',
                    name: 'هجرت',
                    username: 'reza_karimi',
                    avatar_url: null,
                    is_online: false,
                    last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 ساعت پیش
                },
                {
                    id: 'user4',
                    name: 'ستاره',
                    username: 'nazanin_ahmadi',
                    avatar_url: null,
                    is_online: true,
                    last_seen: new Date().toISOString()
                },
                {
                    id: 'user5',
                    name: 'علی رضا',
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

    const filteredPersons = persons.filter(person => {
        const query = searchQuery.toLowerCase().trim();

        if (!query) return false;

        // جستجو در نام کامل (با حذف فاصله‌ها)
        const cleanName = person.name.replace(/\s+/g, '').toLowerCase();
        const cleanQuery = query.replace(/\s+/g, '');

        // جستجو در نام کاربری (حذف @ اگر وجود دارد)
        const cleanUsername = person.username.replace('@', '').toLowerCase();

        // جستجو در شماره تلفن (حذف کاراکترهای غیرعددی)
        const cleanPhone = person.phone?.replace(/[^\d]/g, '') || '';
        const cleanPhoneQuery = query.replace(/[^\d]/g, '');

        return (
            // جستجوی مستقیم در نام
            person.name.toLowerCase().includes(query) ||
            cleanName.includes(cleanQuery) ||

            // جستجو در نام کاربری
            person.username.toLowerCase().includes(query) ||
            cleanUsername.includes(cleanQuery) ||

            // جستجو در شماره تلفن
            (person.phone && (
                person.phone.includes(query) ||
                cleanPhone.includes(cleanPhoneQuery) ||
                // جستجو با فرمت‌های مختلف شماره
                person.phone.replace(/\s+/g, '').includes(cleanPhoneQuery) ||
                person.phone.replace(/[^\d]/g, '').includes(cleanPhoneQuery) ||
                // جستجوی معکوس (اگر کاربر 0 اول رو نزده)
                (cleanPhoneQuery.startsWith('9') && cleanPhone.endsWith(cleanPhoneQuery))
            )) ||

            // جستجوی فازی در نام (برای غلط‌های املایی)
            (query.length > 2 && (
                person.name.toLowerCase().includes(query.substring(0, query.length - 1)) ||
                person.name.toLowerCase().includes(query.substring(1)) ||
                // جستجو در کلمات جداگانه نام
                person.name.toLowerCase().split(' ').some(word =>
                    word.includes(query) || query.includes(word)
                )
            )) ||

            // جستجو در حروف اول نام
            (query.length > 1 &&
                person.name.split(' ')
                    .map(word => word.charAt(0))
                    .join('')
                    .toLowerCase()
                    .includes(query)
            ) ||

            // جستجو در نام به انگلیسی (اگر کاربر فارسی تایپ کرده)
            (person.englishName &&
                person.englishName.toLowerCase().includes(query)
            )
        );
    });

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