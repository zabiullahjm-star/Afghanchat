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
    ActivityIndicator
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';

interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    read: boolean;
}

export default function ChatScreen() {
    const { roomId } = useLocalSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        fetchMessages();
        subscribeToMessages();
    }, [roomId]);

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
                setMessages(data as Message[]);
            }

        } catch (error) {
            console.error('خطا:', error);
        } finally {
            setFetching(false);
        }
    };

    // گوش دادن به پیام‌های جدید
    const subscribeToMessages = () => {
        const subscription = supabase
            .channel('room-messages')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_room_id = eq.${roomId}`
                },
                (payload) => {
                    console.log('پیام جدید از دیتابیس:', payload);
                    setMessages(prev => [...prev, payload.new as Message]);
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    };

    // ارسال پیام جدید به دیتابیس
    const sendMessage = async () => {
        if (!newMessage.trim()) return;

        const messageToSend = {
            content: newMessage.trim(),
            sender_id: 'user1', // فعلاً تستی
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
                sender_id: 'user1',
                created_at: new Date().toISOString(),
                read: false
            };

            setMessages(prev => [...prev, tempMessage]);
            setNewMessage('');

            // ارسال به دیتابیس
            const { data, error } = await supabase
                .from('messages')
                .insert([messageToSend])
                .select();

            if (error) {
                console.error('خطا در ارسال پیام:', error);
                // حذف پیام موقت در صورت خطا
                setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
                alert('خطا در ارسال پیام: ' + error.message);
            } else {
                console.log('پیام با موفقیت ارسال شد:', data);
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
            alert('خطا در ارسال پیام');
        } finally {
            setLoading(false);
        }
    };

    // کامپوننت برای نمایش هر پیام
    const renderMessage = ({ item }: { item: Message }) => {
        const isMyMessage = item.sender_id === 'user1';
        const isTempMessage = item.id.startsWith('temp-');

        return (
            <View style={[
                styles.messageContainer, isMyMessage ? styles.myMessage : styles.otherMessage,
                isTempMessage && styles.tempMessage
            ]}>
                <Text style={[
                    styles.messageText,
                    isMyMessage ? styles.myMessageText : styles.otherMessageText
                ]}>
                    {item.content}
                    {isTempMessage && ' ...'}
                </Text>
                <Text style={styles.messageTime}>
                    {new Date(item.created_at).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </Text>
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
        >
            {/* هدر چت */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>💬 چت</Text>
                <Text style={styles.roomId}>اتاق: {roomId}</Text>
            </View>

            {/* لیست پیام‌ها */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>هنوز هیچ پیامی ارسال نشده</Text>
                        <Text style={styles.emptySubText}>اولین پیام رو تو این چت بفرست!</Text>
                    </View>
                }
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
                    onSubmitEditing={sendMessage}
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!newMessage.trim() || loading) && styles.sendButtonDisabled
                    ]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || loading}
                >
                    <Text style={styles.sendButtonText}>
                        {loading ? '...' : '➤'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        backgroundColor: '#007AFF',
        padding: 16,
        paddingTop: 60,
        alignItems: 'center'
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    },
    roomId: {
        color: 'white',
        fontSize: 12,
        marginTop: 4
    },
    messagesList: {
        flex: 1
    },
    messagesContent: {
        padding: 16
    },
    messageContainer: {
        maxWidth: '80%',
        marginVertical: 4,
        padding: 12,
        borderRadius: 16
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#007AFF'
    },
    otherMessage: {
        alignSelf: 'flex-start',
        backgroundColor: 'white'
    },
    tempMessage: {
        opacity: 0.7
    },
    messageText: {
        fontSize: 16
    },
    myMessageText: {
        color: 'white'
    },
    otherMessageText: {
        color: 'black'
    },
    messageTime: {
        fontSize: 10,
        marginTop: 4,
        opacity: 0.7
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'white',
        alignItems: 'flex-end'
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        maxHeight: 100
    },
    sendButton: {
        backgroundColor: '#007AFF',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc'
    },
    sendButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 50
    },
    emptyText: {
        fontSize: 18,
        color: '#666',
        marginBottom: 8
    },
    emptySubText: {
        fontSize: 14,
        color: '#999'
    }
});