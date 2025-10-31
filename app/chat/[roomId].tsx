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
import type { User } from '@supabase/supabase-js';
import { Audio } from 'expo-av'

type Message = {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    read: boolean;
    message_type?: 'text' | 'audio';
    audio_url?: string;
};

export default function ChatScreen() {
    const { roomId, otherUserName } = useLocalSearchParams();
    const roomIdString = Array.isArray(roomId) ? roomId[0] : roomId;
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [otherUserId, setOtherUserId] = useState<string>('');
    // recording states
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);

    const flatListRef = useRef<FlatList<any> | null>(null);
    const intervalRef = useRef<number | null>(null);

    // دریافت user و otherUserId (ترتیب درست)
    const getCurrentUser = async () => {
        try {
            const resp = await supabase.auth.getUser();
            const user = resp?.data?.user ?? null;
            setCurrentUser(user);
            if (user && roomIdString) {
                const parts = roomIdString.replace('room_', '').split('_');
                const other = parts.find(id => id !== user.id) ?? '';
                setOtherUserId(other);
            }
        } catch (err) {
            console.error('getCurrentUser error', err);
            setCurrentUser(null);
        }
    };

    // init: اول کاربر، بعد پیام‌ها
    useEffect(() => {
        let mounted = true;
        const init = async () => {
            await getCurrentUser();
            if (!mounted) return;
            await fetchMessages();
            // start polling
            if (intervalRef.current == null) {
                const id = setInterval(() => {
                    checkForNewMessages();
                }, 3000);
                // @ts-ignore node timer id type
                intervalRef.current = id;
            }
        };
        init();
        return () => {
            mounted = false;
            if (intervalRef.current != null) {
                clearInterval(intervalRef.current as unknown as number);
                intervalRef.current = null;
            }
        };
        // roomIdString در dependency تا وقتی روم تغییر کنه init دوباره اجرا شه
    }, [roomIdString]);

    // fetch اولیه پیامها (کل تاریخچه)
    const fetchMessages = async () => {
        if (!roomIdString) return;
        try {
            setFetching(true);
            const q = supabase
                .from('messages')
                .select('*')
                .eq('chat_room_id', roomIdString)
                .order('created_at', { ascending: true });
            const { data, error } = await q;
            if (error) {
                console.error('fetchMessages error', error);
                return;
            }
            if (data) {
                // جایگزین کامل برای وضعیت اولیه
                setMessages(data as Message[]);
                // scroll to end after a small delay
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            }
        } catch (err) {
            console.error('fetchMessages unexpected', err);
        } finally {
            setFetching(false);
        }
    };

    // check فقط پیامهای جدیدتر از آخرین پیام محلی را می‌گیرد (اجتناب از overwrite)
    const checkForNewMessages = async () => {
        if (!roomIdString) return;
        try {
            const last = messages.length > 0 ? messages[messages.length - 1].created_at : null;
            let query = supabase
                .from('messages')
                .select('*')
                .eq('chat_room_id', roomIdString)
                .order('created_at', { ascending: true });
            if (last) {
                // استفاده از gt با رشته تاریخ (بدون backtick)
                query = (query as any).gt('created_at', last);
            }
            const { data, error } = await query;
            if (error) {
                console.error('checkForNewMessages error', error);
                return;
            }
            if (data && data.length > 0) {
                // فقط پیام‌های جدیدی که id شون در state نیست اضافه می‌کنیم
                setMessages(prev => {
                    const existing = new Set(prev.map(m => m.id));
                    const newMsgs = (data as Message[]).filter(m => !existing.has(m.id));
                    if (newMsgs.length === 0) return prev;
                    const merged = [...prev, ...newMsgs];
                    // اسکرول به پایین
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                    return merged;
                });
            }
        } catch (err) {
            console.error('checkForNewMessages unexpected', err);
        }
    };

    // ارسال پیام: temp message اضافه میشه، سپس با پیام واقعی جایگزین میشه
    const sendMessage = async () => {
        if (!newMessage.trim() || !currentUser) return;
        const tempId = 'temp' + Date.now();
        const temp: Message = {
            id: tempId,
            content: newMessage.trim(),
            sender_id: currentUser.id,
            created_at: new Date().toISOString(),
            read: false
        };

        setMessages(prev => [...prev, temp]);
        setNewMessage('');
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        const payload = {
            content: temp.content,
            sender_id: currentUser.id,
            receiver_id: otherUserId,
            chat_room_id: roomIdString,
            message_type: 'text',
            read: false
        };

        try {
            setLoading(true);
            const { data, error } = await supabase.from('messages').insert([payload]).select();
            if (error) {
                console.error('sendMessage error', error);
                // حذف پیام موقت
                setMessages(prev => prev.filter(m => m.id !== tempId));
                Alert.alert('خطا', 'ارسال پیام موفق نبود');
                return;
            }
            if (data && data[0]) {
                const real = data[0] as Message;
                setMessages(prev => prev.map(m => (m.id === tempId ? real : m)));
            }
        } catch (err) {
            console.error('sendMessage unexpected', err);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            Alert.alert('خطا', 'ارسال پیام خطا داد');
        } finally {
            setLoading(false);
        }
    };
    const startRecording = async () => {
        try {
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                Alert.alert('اجازه میکروفون لازم است');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            setIsRecording(true);
        } catch (err) {
            console.error('startRecording error', err);
            Alert.alert('خطا', 'شروع ضبط ممکن نیست');
        }
    };

    const stopRecording = async () => {
        try {
            if (!recording) return;
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setIsRecording(false);
            setRecording(null);

            if (uri) {
                // آپلود و ارسال ویس
                await uploadVoiceToSupabase(uri);
            }
        } catch (err) {
            console.error('stopRecording error', err);
            Alert.alert('خطا', 'متوقف کردن ضبط با مشکل مواجه شد');
        }
    };
    const uploadVoiceToSupabase = async (localUri: string) => {
        try {
            setLoading(true);
            // نام فایل در باکت
            const fileExt = localUri.split('.').pop() ?? 'm4a';
            const fileName = `voice_${Date.now()
                }.${fileExt}`;

            const response = await fetch(localUri);
            const blob = await response.blob();

            // آپلود به باکت voice-messages (مطابق با نام باکت تو عوض کن)
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('voice-messages')
                .upload(fileName, blob, { contentType: 'audio/m4a' });

            if (uploadError) {
                throw uploadError;
            }

            // گرفتن public url (یا path بسته به نیاز)
            const { data: publicData } = supabase
                .storage
                .from('voice-messages')
                .getPublicUrl(fileName);

            const publicUrl = publicData?.publicUrl ?? uploadData?.path ?? null;
            if (!publicUrl) throw new Error('publicUrl not available');

            // ساخت payload پیام صوتی و ذخیره در جدول messages
            const payload = {
                sender_id: currentUser?.id,
                receiver_id: otherUserId,
                chat_room_id: roomIdString,
                message_type: 'audio',
                audio_url: publicUrl,
                content: '',
                read: false,
            };

            const { data, error } = await supabase.from('messages').insert([payload]).select();
            if (error) throw error;

            if (data && data[0]) {
                // اگر دوست داری پیام جدید را بلافاصله به state اضافه کن
                setMessages(prev => [...prev, data[0] as Message]);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            }
        } catch (err) {
            console.error('uploadVoiceToSupabase error', err);
            Alert.alert('خطا', 'آپلود ویس موفق نبود');
        } finally {
            setLoading(false);
        }
    };
    const sendVoiceMessage = async (uri: string) => {
        if (!currentUser || !otherUserId || !roomIdString) return;

        const tempId = 'temp_audio_' + Date.now();
        const temp: Message = {
            id: tempId,
            content: '',
            sender_id: currentUser.id,
            created_at: new Date().toISOString(),
            read: false,
            message_type: 'audio',
            audio_url: uri
        };

        setMessages(prev => [...prev, temp]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            setLoading(true);
            const fileName = `voice_${Date.now()
                }.mp3`;
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('voice_messages')
                .upload(fileName, await fetch(uri).then(r => r.blob()), { upsert: true });

            if (uploadError) throw uploadError;

            const { data, error } = await supabase.from('messages').insert([{
                sender_id: currentUser.id,
                receiver_id: otherUserId,
                chat_room_id: roomIdString,
                message_type: 'audio',
                audio_url: uploadData.path,
                read: false
            }]).select();

            if (error) throw error;
            if (data && data[0]) setMessages(prev => prev.map(m => m.id === tempId ? data[0] : m));
        } catch (err) {
            console.error('sendVoiceMessage', err);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            Alert.alert('خطا', 'ارسال ویس موفق نبود');
        } finally {
            setLoading(false);
        }
    };
    const playAudio = async (url: string) => {
        try {
            // اگر url مسیر publicUrl باشه همین رو پاس بده
            const { sound } = await Audio.Sound.createAsync({ uri: url });
            await sound.playAsync();

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        } catch (err) {
            console.error('playAudio error', err);
            Alert.alert('خطا', 'پخش ویس ممکن نیست');
        }
    };
    const renderMessage = ({ item }: { item: Message }) => {
        const isMine = item.sender_id === currentUser?.id;
        const isTemp =
            typeof item.id === 'string' && item.id.startsWith('temp');

        return (
            <View
                style={[
                    styles.messageRow,
                    isMine ? styles.myMessageRow : styles.otherMessageRow,
                ]}
            >
                <View
                    style={[
                        styles.messageBubble,
                        item.message_type === 'audio'
                            ? styles.voiceBubble
                            : isMine
                                ? styles.myBubble
                                : styles.otherBubble,
                        isTemp && styles.tempMessage,
                    ]}
                >
                    {item.message_type === 'audio' ? (
                        <TouchableOpacity onPress={() => playAudio(item.audio_url!)}>
                            <Text style={{ color: 'white', fontSize: 16 }}>
                                🔊 پخش صدا
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <Text
                            style={[
                                styles.messageText,
                                isMine ? styles.myMessageText : styles.otherMessageText,
                            ]}
                        >
                            {item.content}
                            {isTemp ? ' ...' : ''}
                        </Text>
                    )}

                    <Text
                        style={[
                            styles.messageTime,
                            isMine ? styles.myMessageTime : styles.otherMessageTime,
                        ]}
                    >
                        {new Date(item.created_at).toLocaleTimeString('fa-IR', {
                            hour: '2-digit',
                            minute: '2-digit',
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
                <Text style={styles.loadingText}>در حال بارگذاری پیام‌ها...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 150 : 80}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>

                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{otherUserName ?? 'چت'}</Text>
                    <Text style={styles.headerSubtitle}>{messages.length > 0 ? messages.length + ' پیام' : 'شروع گفتگو'}</Text>
                </View>

                <View style={styles.headerPlaceholder} />
            </View><FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>🎉 گفتگو رو شروع کن!</Text>
                        <Text style={styles.emptySubText}>اولین پیام رو ارسال کن</Text>
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />

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

                {/* میکروفون: نگه دار برای ضبط، رها کن برای ارسال */}
                <TouchableOpacity
                    style={[styles.micButton, isRecording && { backgroundColor: 'red' }]}
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                >
                    <Text style={styles.micButtonText}>{isRecording ? '■' : '🎤'}</Text>
                </TouchableOpacity>

                {/* دکمه ارسال متن */}
                <TouchableOpacity
                    style={[styles.sendButton, (!newMessage.trim() || loading) && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || loading}
                >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendButtonText}>➤</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

// کامل و سازگار با نامهای استفاده شده در JSX
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 8, color: '#666' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 12,
        borderBottomLeftRadius: 18, borderBottomRightRadius: 18
    },
    backButton: { padding: 6 },
    backButtonText: { color: 'white', fontSize: 20, fontWeight: '700' },
    headerInfo: { flex: 1, alignItems: 'center' },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
    headerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
    headerPlaceholder: { width: 28 },

    messagesList: { flex: 1, backgroundColor: '#f8f9fa' },
    messagesContent: { paddingHorizontal: 14, paddingVertical: 10 },

    messageRow: { flexDirection: 'row', marginVertical: 6 },
    myMessageRow: { justifyContent: 'flex-end' },
    otherMessageRow: { justifyContent: 'flex-start' },

    messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
    myBubble: { backgroundColor: '#007AFF', borderBottomRightRadius: 6 },
    otherBubble: { backgroundColor: '#2b8a66', borderBottomLeftRadius: 6 },

    tempMessage: { opacity: 0.7 },

    messageText: { fontSize: 16, lineHeight: 22 },
    myMessageText: { color: 'white' },
    otherMessageText: { color: 'white' },

    messageTime: { fontSize: 10, marginTop: 6, opacity: 0.85 },
    myMessageTime: { color: 'rgba(255,255,255,0.85)', textAlign: 'right' },
    otherMessageTime: { color: 'rgba(255,255,255,0.85)', textAlign: 'left' },

    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 18, color: '#666', marginBottom: 6 },
    emptySubText: { fontSize: 14, color: '#999' },

    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e6e6e6' },
    textInput: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#f0f0f0', fontSize: 16, maxHeight: 120 },
    sendButton: { marginLeft: 8, backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    sendButtonDisabled: { backgroundColor: '#9aa5b1' },
    sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    micButton: {
        marginLeft: 8,
        backgroundColor: '#3aa55d',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButtonText: {
        color: 'white',
        fontSize: 18,
    },
    voiceBubble: {
        backgroundColor: '#4A90E2',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 18,
        maxWidth: '75%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
});