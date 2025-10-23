import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    read: boolean;
}

export default function ChatScreen() {
    const { roomId, otherUserName } = useLocalSearchParams();
    const roomIdString = Array.isArray(roomId) ? roomId[0] : roomId;
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        getCurrentUser();
        fetchMessages();
        const stopListening = subscribeToMessages();
        return () => {
            stopListening();
        };
    }, [roomId]);

    // دریافت کاربر فعلی
    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
    };

    // دریافت پیام‌ها از دیتابیس
    const fetchMessages = async () => {
        try {
            setFetching(true);

            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_room_id', roomId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('خطا در دریافت پیام‌ها:', error);
                return;
            }

            if (data) {
                // فقط پیام‌های این چت روم رو نشون بده
                setMessages(data as Message[]);
            }

        } catch (error) {
            console.error('خطا:', error);
        } finally {
            setFetching(false);
        }
    };

    // گوش دادن به پیام‌های جدید

    // به جاش این تابع جدید رو اضافه کن:
    const subscribeToMessages = () => {
        console.log('📡 درحال گوش دادن به پیام‌های جدید برای room:', roomId);

        const subscription = supabase
            .channel(`room - ${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_room_id = eq.${roomIdString}`
                },
                (payload) => {
                    console.log('🔔 پیام جدید دریافت شد:', payload.new);

                    // اضافه کردن پیام جدید به لیست
                    setMessages(prev => {
                        const newMessage = payload.new as Message;
                        // جلوگیری از duplicate
                        if (prev.some(msg => msg.id === newMessage.id)) {
                            return prev;
                        }
                        return [...prev, newMessage];
                    });

                    // اسکرول به پایین
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
            )
            .subscribe((status) => {
                console.log('📡 وضعیت subscription:', status);
            });

        return () => {
            console.log('🔴 متوقف کردن subscription');
            subscription.unsubscribe();
        };
    };

    // ارسال پیام جدید به دیتابیس
    const sendMessage = async () => {
        if (!newMessage.trim() || !currentUser) return;

        const messageToSend = {
            content: newMessage.trim(),
            sender_id: currentUser.id,
            chat_room_id: roomId,
            message_type: 'text',
            read: false
        };

        try {
            setLoading(true);

            // پیام موقت برای UX بهتر
            const tempMessage: Message = {
                id: `temp - ${Date.now()
                    }`,
                content: newMessage.trim(),
                sender_id: currentUser.id,
                created_at: new Date().toISOString(),
                read: false
            };

            setMessages(prev => [...prev, tempMessage]);
            setNewMessage('');

            // اسکرول به پایین
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);

            // ارسال به دیتابیس
            const { data, error } = await supabase
                .from('messages')
                .insert([messageToSend])
                .select(); if (error) {
                    console.error('خطا در ارسال پیام:', error);
                    // حذف پیام موقت در صورت خطا
                    setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
                    Alert.alert('خطا', 'خطا در ارسال پیام');
                } else {
                // جایگزینی پیام موقت با پیام واقعی از دیتابیس
                if (data && data[0]) {
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === tempMessage.id ? data[0] : msg
                        )
                    );
                }
            }

        } catch (error) {
            console.error('خطا:', error);
            Alert.alert('خطا', 'خطا در ارسال پیام');
        } finally {
            setLoading(false);
        }
    };

    // کامپوننت برای نمایش هر پیام
    const renderMessage = ({ item }: { item: Message }) => {
        const isMyMessage = item.sender_id === currentUser?.id;
        const isTempMessage = item.id.startsWith('temp-');

        return (
            <View style={[
                styles.messageContainer,
                isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
            ]}>
                <View style={[
                    styles.messageBubble,
                    isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
                    isTempMessage && styles.tempMessage
                ]}>
                    <Text style={[
                        styles.messageText,
                        isMyMessage ? styles.myMessageText : styles.otherMessageText
                    ]}>
                        {item.content}
                        {isTempMessage && ' ...'}
                    </Text>
                    <Text style={[
                        styles.messageTime,
                        isMyMessage ? styles.myMessageTime : styles.otherMessageTime
                    ]}>
                        {new Date(item.created_at).toLocaleTimeString('fa-IR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </Text>
                </View>
            </View>
        );
    };

    if (fetching) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text>در حال بارگذاری پیام‌ها...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 150 : 50}
        >
            {/* هدر چت - زیباتر و کوچک‌تر */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{otherUserName || 'چت'}</Text>
                    <Text style={styles.headerSubtitle}>
                        {messages.length > 0 ? `${messages.length} پیام` : 'شروع گفتگو'}
                    </Text>
                </View>
                <View style={styles.headerPlaceholder} />
            </View>

            {/* لیست پیام‌ها */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>🎉 گفتگو رو شروع کن!</Text>
                        <Text style={styles.emptySubText}>اولین پیام رو ارسال کن</Text>
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />

            {/* اینپوت ارسال پیام */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="پیام خود را بنویسید..."
                    placeholderTextColor="#999"
                    multiline
                    maxLength={500}
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!newMessage.trim() || loading) && styles.sendButtonDisabled
                    ]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text style={styles.sendButtonText}>➤</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: 60,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8
    },
    backButton: {
        padding: 8
    },
    backButtonText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold'
    },
    headerInfo: {
        flex: 1,
        alignItems: 'center'
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 2
    },
    headerPlaceholder: {
        width: 40
    },
    messagesList: {
        flex: 1
    },
    messagesContent: {
        paddingHorizontal: 16,
        paddingVertical: 8
    },
    messageContainer: {
        flexDirection: 'row',
        marginVertical: 4
    },
    myMessageContainer: {
        justifyContent: 'flex-end'
    },
    otherMessageContainer: {
        justifyContent: 'flex-start'
    },
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        marginVertical: 2
    },
    myMessageBubble: {
        backgroundColor: '#007AFF',
        borderBottomRightRadius: 6
    },
    otherMessageBubble: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 6,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    tempMessage: {
        opacity: 0.7
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22
    },
    myMessageText: {
        color: 'white'
    }, otherMessageText: {
        color: '#1a1a1a'
    },
    messageTime: {
        fontSize: 10,
        marginTop: 4,
        opacity: 0.7
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'right'
    },
    otherMessageTime: {
        color: 'rgba(0,0,0,0.5)',
        textAlign: 'left'
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        paddingBottom: Platform.OS === 'ios' ? 40 : 30
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: 12,
        marginRight: 12,
        maxHeight: 100,
        backgroundColor: '#f8f9fa',
        fontSize: 16,
        textAlign: 'right'
    },
    sendButton: {
        backgroundColor: '#007AFF',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc'
    },
    sendButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 2
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100
    },
    emptyText: {
        fontSize: 20,
        color: '#666',
        marginBottom: 8,
        fontWeight: 'bold'
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center'
    }
});