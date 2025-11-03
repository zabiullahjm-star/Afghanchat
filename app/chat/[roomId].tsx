import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
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
    Alert,
    StatusBar
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';

// انواع TypeScript
interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    read: boolean;
    message_type: 'text' | 'voice';
    audio_url?: string;
}

interface Profile {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
}

// تنظیمات ثابت
const BUCKET_NAME = 'voice_messages';
const VOICE_MAX_DURATION = 90000; // 60 ثانیه

export default function ChatRoom() {
    const { roomId, otherUserName } = useLocalSearchParams();
    const router = useRouter();
    const { chatBackground, setChatBackground, colors } = useTheme();

    // تعیین رنگ متن: پیش‌فرض سیاه، ولی اگر کاربر رنگ خاص '#050000ff' را انتخاب کرد سفید شود
    const isSpecialDark = chatBackground.type === 'color' && chatBackground.value === '#050000ff';
    const dynamicTextColor = isSpecialDark ? '#ffffff' : '#000000';

    // Normalize params: useLocalSearchParams can return string | string[]
    const roomIdStr: string | null = Array.isArray(roomId) ? (roomId[0] ?? null) : (roomId ?? null);
    const otherUserNameStr: string | null = Array.isArray(otherUserName) ? (otherUserName[0] ?? null) : (otherUserName ?? null);

    // حالت‌ها
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [playingAudio, setPlayingAudio] = useState<string | null>(null);
    const [isCanceling, setIsCanceling] = useState(false);
    const changeChatBackground = (color: string) => {
        setChatBackground({ type: 'color', value: color });
    };

    // ref ها
    const flatListRef = useRef<FlatList>(null);
    const recordingTimerRef = useRef<number | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const channelRef = useRef<any>(null);
    const recordingRef = useRef<Audio.Recording | null>(null);
    // refs for tap-toggle recording + drag-to-cancel
    const touchStartXRef = useRef<number | null>(null);
    // keep recordingRef in sync with state
    useEffect(() => { recordingRef.current = recording; }, [recording]);

    const CACHE_PREFIX = 'afghanchat:';

    // load cached messages for this room
    const loadCachedMessages = async (roomIdLocal?: string | null) => {
        if (!roomIdLocal) return false;
        try {
            const raw = await SecureStore.getItemAsync(CACHE_PREFIX + 'room:' + roomIdLocal);
            if (raw) {
                const parsed = JSON.parse(raw) as Message[];
                if (parsed && parsed.length > 0) {
                    setMessages(parsed);
                    return true;
                }
            }
        } catch (e) {
            console.warn('loadCachedMessages error', e);
        }
        return false;
    };

    const saveCachedMessages = async (roomIdLocal: string | undefined | null, msgs: Message[]) => {
        if (!roomIdLocal) return;
        try {
            await SecureStore.setItemAsync(CACHE_PREFIX + 'room:' + roomIdLocal, JSON.stringify(msgs));
        } catch (e) {
            console.warn('saveCachedMessages error', e);
        }
    };

    // مقداردهی اولیه چت
    useEffect(() => {
        initializeChat();
        return () => {
            // async cleanup (fire-and-forget)
            (async () => {
                try {
                    if (recordingTimerRef.current) {
                        clearInterval(recordingTimerRef.current);
                        recordingTimerRef.current = null;
                    }
                    // if a recording is active, stop & unload it and do NOT upload (cancel)
                    if (recordingRef.current) {
                        try {
                            await recordingRef.current.stopAndUnloadAsync();
                        } catch (e) { /* ignore */ }
                        recordingRef.current = null;
                    }
                    // stop and unload playing audio if any
                    if (soundRef.current) {
                        try {
                            await soundRef.current.stopAsync();
                            await soundRef.current.unloadAsync();
                        } catch (e) { /* ignore */ }
                        soundRef.current = null;
                    }
                } catch (e) {
                    console.warn('cleanup error', e);
                } finally {
                    // cleanup realtime channel
                    try {
                        if (channelRef.current) {
                            supabase.removeChannel(channelRef.current);
                            channelRef.current = null;
                        }
                    } catch (e) {
                        console.warn('removeChannel error', e);
                    }
                }
            })();
            // پاکسازی
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
            // cleanup channel امن
            try {
                if (channelRef.current) {
                    supabase.removeChannel(channelRef.current);
                    channelRef.current = null;
                }
            } catch (e) {
                console.warn('removeChannel error', e);
            }
        };
        // keep dependency on original param so effect reruns when route changes
    }, [roomId]);

    const initializeChat = async () => {
        try {
            // دریافت کاربر فعلی
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);

            if (!user) {
                router.replace('/(auth)/login');
                return;
            }

            if (!roomIdStr) {
                console.warn('No roomId provided');
                return;
            }

            // اول کش محلی رو سریعاً بارگزاری کن تا UI سریع باشه
            const hadCache = await loadCachedMessages(roomIdStr);

            // فقط در صورتی که کش خالی است، صفحه لودینگ نشان بده
            if (!hadCache) setLoading(true);

            // دریافت پیام‌های قبلی از سرور و بروزرسانی cache (در پس‌زمینه)
            await fetchMessages();

            // گوش دادن به پیام‌های جدید
            subscribeToMessages();

        } catch (error) {
            console.error('خطا در راه‌اندازی چت:', error);
            Alert.alert('خطا', 'مشکلی در راه‌اندازی چت پیش آمد');
        } finally {
            setLoading(false);
        }
    };

    // دریافت پیام‌ها از دیتابیس
    const fetchMessages = async () => {
        try {
            if (!roomIdStr) return;
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_room_id', roomIdStr)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (data) {
                setMessages(data as Message[]);
                // ذخیره روی cache
                await saveCachedMessages(roomIdStr, data as Message[]);
            }

        } catch (error) {
            console.error('خطا در دریافت پیام‌ها:', error);
            Alert.alert('خطا', 'مشکلی در دریافت پیام‌ها پیش آمد');
        }
    };

    // گوش دادن به پیام‌های جدید
    const subscribeToMessages = () => {
        if (!roomIdStr) return;
        // ساخت کانال مشابه index.tsx و فیلتر سازگار
        const filterStr = 'chat_room_id.eq.' + roomIdStr;
        const channel = supabase
            .channel('public:messages:' + roomIdStr)
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: filterStr
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    setMessages(prev => {
                        if (prev.some(msg => msg.id === newMessage.id)) {
                            return prev;
                        }
                        const next = [...prev, newMessage];
                        // ذخیره کش بعد از دریافت پیام جدید
                        saveCachedMessages(roomIdStr, next).catch(e => console.warn('saveCachedMessages', e));
                        return next;
                    });
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
            )
            .subscribe();

        channelRef.current = channel;
        // return cleanup function if needed
        return () => {
            try {
                if (channelRef.current) {
                    supabase.removeChannel(channelRef.current);
                    channelRef.current = null;
                }
            } catch (e) {
                console.warn('removeChannel error', e);
            }
        };
    };

    // ارسال پیام متنی
    const sendMessage = async () => {
        if (!newMessage.trim() || !currentUser) return;

        const tempId = `temp - ${Date.now()
            }`;
        const tempMessage: Message = {
            id: tempId,
            content: newMessage.trim(),
            sender_id: currentUser.id,
            created_at: new Date().toISOString(),
            read: false,
            message_type: 'text'
        };

        // اضافه کردن پیام موقت
        setMessages(prev => [...prev, tempMessage]);
        setNewMessage('');
        scrollToBottom();

        try {
            // ارسال به دیتابیس
            const { data, error } = await supabase
                .from('messages')
                .insert([{
                    content: newMessage.trim(),
                    sender_id: currentUser.id,
                    chat_room_id: roomIdStr,
                    message_type: 'text',
                    read: false
                }])
                .select();

            if (error) throw error;

            // جایگزینی پیام موقت
            if (data && data[0]) {
                setMessages(prev =>
                    prev.map(msg => msg.id === tempId ? data[0] : msg)
                );
            }

        } catch (error) {
            console.error('خطا در ارسال پیام:', error);
            // حذف پیام موقت
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
            Alert.alert('خطا', 'ارسال پیام موفقیت‌آمیز نبود');
        }
    };

    // شروع ضبط صدا
    const startRecording = async () => {
        try {
            // درخواست مجوزها
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('مجوز لازم', 'برای ضبط صدا نیاز به دسترسی میکروفون دارید');
                return;
            }

            // تنظیم حالت صدا
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // شروع ضبط
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingDuration(0);

            // تایمر برای نمایش مدت ضبط
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => {
                    if (prev >= VOICE_MAX_DURATION / 1000) {
                        stopRecording();
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000) as unknown as number;

        } catch (error) {
            console.error('خطا در شروع ضبط:', error);
            Alert.alert('خطا', 'شروع ضبط ممکن نیست');
        }
    };

    // توقف ضبط صدا
    // تابع stopRecording رو به این صورت تغییر بده:
    const stopRecording = async (cancel: boolean = false) => {
        try {
            const rec = recordingRef.current;
            if (!rec) return;

            // پاکسازی تایمر
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }

            // توقف ضبط
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            // ensure we don't hold stale ref
            recordingRef.current = null;
            // در تابع stopRecording بعد از getURI اینو اضافه کن:
            console.log('فایل ضبط شده:', uri);
            if (!uri) {
                Alert.alert('خطا', 'فایل ضبط شده یافت نشد');
                // clear local states
                setIsRecording(false);
                setRecording(null);
                setRecordingDuration(0);
                setIsCanceling(false);
                return;
            }

            setIsRecording(false);
            setRecording(null);
            setRecordingDuration(0);
            setIsCanceling(false);

            // اگر لغو نشده و ضبط موفق بود، آپلود کن
            if (!cancel && uri && recordingDuration >= 1) {
                await uploadVoiceMessage(uri);
            } else if (!cancel && uri) {
                Alert.alert('ضبط کوتاه', 'پیام صوتی باید حداقل 1 ثانیه باشد');
            } else if (cancel) {
                Alert.alert('ضبط لغو شد', 'پیام صوتی ارسال نشد');
            }

        } catch (error) {
            console.error('خطا در توقف ضبط:', error);
            Alert.alert('خطا', 'توقف ضبط با مشکل مواجه شد');
        }
    };

    // آپلود پیام صوتی: استفاده از fetch -> arrayBuffer -> Uint8Array -> upload
    const uploadVoiceMessage = async (localUri: string) => {
        try {
            setLoading(true);
            // ساخت نام فایل
            const fileExt = 'm4a';
            const fileName = 'voice_' + Date.now() + '.' + fileExt;

            // دریافت arrayBuffer از uri و تبدیل به Uint8Array (سازگار با سرور)
            const response = await fetch(localUri);
            if (!response.ok) throw new Error('Failed to fetch file for upload');
            const arrayBuffer = await response.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from(BUCKET_NAME)
                .upload(fileName, uint8, {
                    contentType: 'audio/m4a',
                    upsert: false
                });

            if (uploadError) {
                console.error('خطای آپلود:', uploadError);
                throw uploadError;
            }

            // دریافت لینک عمومی
            const { data: publicData } = supabase
                .storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName);

            const publicUrl = publicData.publicUrl;

            // ذخیره در دیتابیس — نوع پیام 'voice' تا با index.tsx سازگار باشد
            const { data, error } = await supabase
                .from('messages')
                .insert([{
                    sender_id: currentUser?.id,
                    chat_room_id: roomIdStr,
                    message_type: 'voice',
                    audio_url: publicUrl,
                    content: 'پیام صوتی',
                    read: false
                }])
                .select();

            if (error) {
                console.error('خطای دیتابیس:', error);
                throw error;
            }

            if (data && data[0]) {
                setMessages(prev => {
                    const next = [...prev, data[0] as Message];
                    saveCachedMessages(roomIdStr, next).catch(e => console.warn('saveCachedMessages', e));
                    return next;
                });
                scrollToBottom();
            }

        } catch (error) {
            console.error('خطای آپلود کامل:', error);
            Alert.alert('خطا', 'آپلود پیام صوتی موفق نبود');
        } finally {
            setLoading(false);
        }
    };

    // پخش پیام صوتی
    const playAudio = async (audioUrl: string) => {
        try {
            // توقف پخش قبلی
            if (soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }

            setPlayingAudio(audioUrl);

            // ایجاد و پخش صدا
            const { sound } = await Audio.Sound.createAsync(
                { uri: audioUrl },
                { shouldPlay: true }
            );

            soundRef.current = sound;

            // گوش دادن به وضعیت پخش
            sound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingAudio(null);
                    sound.unloadAsync();
                    soundRef.current = null;
                }
            });

            await sound.playAsync();

        } catch (error) {
            console.error('خطا در پخش صدا:', error);
            Alert.alert('خطا', 'پخش پیام صوتی ممکن نیست');
            setPlayingAudio(null);
        }
    };// توقف پخش صدا
    const stopAudio = async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
            setPlayingAudio(null);
        }
    };

    // اسکرول به پایین
    const scrollToBottom = () => {
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    // فرمت زمان ضبط
    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    // این کد رو دقیقاً قبل از تابع renderMessage اضافه کن:

    const ColorPicker = () => (
        <View style={styles.colorPicker}>
            {['#ff6b6b', '#48dbfb', '#1dd1a1', '#c5e241ff', '#f368e0', '#050000ff'].map(color => (
                <TouchableOpacity
                    key={color}
                    style={[styles.colorOption, { backgroundColor: color }]}
                    onPress={() => changeChatBackground(color)}
                />
            ))}
        </View>
    );

    // رندر هر پیام
    const renderMessage = ({ item }: { item: Message }) => {
        const isMyMessage = item.sender_id === currentUser?.id;
        const isAudio = item.message_type === 'voice';
        const isPlaying = playingAudio === item.audio_url;

        return (

            <View style={[
                styles.messageContainer,

                isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
            ]}>
                <View style={[
                    styles.messageBubble,
                    isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
                    isAudio && styles.audioMessageBubble,
                    { backgroundColor: chatBackground.type === 'color' ? chatBackground.value : 'رنگ پیش‌فرض' },

                ]}>
                    {isAudio ? (
                        // WhatsApp-like audio bubble (visual only)
                        <TouchableOpacity
                            style={[styles.audioRow, isMyMessage ? styles.audioRowMy : styles.audioRowOther]}
                            onPress={() => isPlaying ? stopAudio() : playAudio(item.audio_url!)}
                            disabled={!item.audio_url}
                        >
                            <View style={styles.playButtonCircle}>
                                <Text style={[styles.playIcon, { color: dynamicTextColor }]}>{isPlaying ? '⏸' : '▶'}</Text>
                            </View>

                            <View style={styles.audioWaveContainer}>
                                {/* simple waveform bars as visual */}
                                <View style={styles.waveBars}>
                                    <View style={[styles.waveBar, styles.waveBarSmall]} />
                                    <View style={[styles.waveBar, styles.waveBarMedium]} />
                                    <View style={[styles.waveBar, styles.waveBarLarge]} />
                                    <View style={[styles.waveBar, styles.waveBarMedium]} />
                                    <View style={[styles.waveBar, styles.waveBarSmall]} />
                                </View>
                            </View>

                            <Text style={[
                                isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
                                { color: dynamicTextColor }
                            ]}>
                                {/* we don't have duration field; show hint */}
                                {isPlaying ? 'در حال پخش' : 'صدا'}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={[
                            styles.messageText,
                            isMyMessage ? styles.myMessageText : styles.otherMessageText,
                            { color: dynamicTextColor }
                        ]}>
                            {item.content}
                        </Text>
                    )}

                    <Text style={[
                        styles.messageTime,
                        isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
                        { color: dynamicTextColor }
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

    if (loading && messages.length === 0) {
        return (
            <View style={styles.center}>
                <StatusBar barStyle="dark-content" />
                <ActivityIndicator size="large" color="#2468bbff" />
                <Text style={styles.loadingText}>در حال بارگذاری چت...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: chatBackground.type === 'color' ? chatBackground.value : colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 145 : 70}
        >
            <StatusBar barStyle="light-content" />
            {/* هدر */}
            <ColorPicker />
            <View style={[
                styles.header,
                {
                    backgroundColor: chatBackground.type === 'color' ? chatBackground.value : colors.surface
                }
            ]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Text style={[styles.backButtonText, { color: dynamicTextColor }]}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: dynamicTextColor }]}>
                        {otherUserNameStr || 'چت'}
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: dynamicTextColor }]}>
                        {messages.length} پیام
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
                onContentSizeChange={scrollToBottom}
                onLayout={scrollToBottom}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: dynamicTextColor }]}>🎉 گفتگو را شروع کنید!</Text>
                        <Text style={[styles.emptySubText, { color: dynamicTextColor }]}>
                            اولین پیام خود را ارسال کنید
                        </Text>
                    </View>
                }
            />

            {/* حالت ضبط صدا */}
            {isRecording && (
                <View style={styles.recordingBanner}>
                    <Text style={styles.recordingText}>🔴 در حال ضبط... {formatRecordingTime(recordingDuration)}</Text>
                    <Text style={styles.recordingHint}>برای ارسال رها کنید، برای لغو بکشید</Text>
                </View>
            )}

            {/* نوار ورود پیام */}
            <View style={[
                styles.inputContainer,
                {
                    backgroundColor: chatBackground.type === 'color' ? chatBackground.value : colors.surface
                }
            ]}>
                <TextInput
                    style={styles.textInput}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="پیام خود را بنویسید..."
                    placeholderTextColor="#999"
                    multiline
                    maxLength={1000}
                    textAlignVertical="center"
                />

                {/* Record button: tap to toggle start/stop, while recording drag left to cancel */}
                <View
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) => {
                        touchStartXRef.current = e.nativeEvent.pageX;
                    }}
                    onResponderMove={(e) => {
                        // while pressing, if recording active check horizontal move to cancel
                        const moveX = e.nativeEvent.pageX;
                        if (isRecording && touchStartXRef.current != null) {
                            const dx = moveX - touchStartXRef.current;
                            if (dx < -50) {
                                if (!isCanceling) setIsCanceling(true);
                            } else {
                                if (isCanceling) setIsCanceling(false);
                            }
                        }
                    }}
                    onResponderRelease={() => {
                        // toggle behavior: if currently recording -> stop (or cancel), else start
                        if (isRecording) {
                            stopRecording(isCanceling);
                        } else {
                            startRecording();
                        }
                        // reset cancel state and touch start
                        setIsCanceling(false);
                        touchStartXRef.current = null;
                    }}
                    style={[
                        styles.recordButton,
                        isRecording && styles.recordButtonActive,
                        isCanceling && styles.recordButtonCanceling
                    ]}
                    accessible
                    accessibilityLabel="Record voice message. Tap to start/stop, slide left while recording to cancel."
                >
                    <Text style={[styles.recordButtonText, { color: dynamicTextColor }]}>
                        {isCanceling ? 'لغو' : (isRecording ? '⏹️' : '🎤')}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!newMessage.trim() || loading) && styles.sendButtonDisabled
                    ]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" />
                    ) : (
                        <Text style={[styles.sendButtonText, { color: dynamicTextColor }]}>➤</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',

        paddingHorizontal: 15,
        paddingVertical: 1,
        paddingTop: Platform.OS === 'ios' ? 6 : 1,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    backButton: {
        padding: 1,
    },
    backButtonText: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
    },
    headerInfo: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        color: 'rgba(46, 16, 16, 0.9)',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: 'rgba(46, 16, 16, 0.9)',
        fontSize: 15,
        marginTop: 0,
    },
    headerPlaceholder: {
        width: 20,
    },
    messagesList: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    messageContainer: {
        flexDirection: 'row',
        marginVertical: 4,
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
    },
    otherMessageContainer: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        marginVertical: 2,
        borderColor: '#7314e0ff',
    },
    myMessageBubble: {
        backgroundColor: '#007AFF',
        borderBottomRightRadius: 6,
        borderColor: '#7314e0ff',
        borderWidth: 3,
    },
    otherMessageBubble: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 20,
        borderColor: '#7314e0ff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 3,
    },
    audioMessageBubble: {
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    myMessageText: {
        color: '#a3149cff',
    },
    otherMessageText: {
        color: '#a3149cff',
    },
    messageTime: {
        fontSize: 10,
        marginTop: 6,
        opacity: 0.8,
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'right',
    },
    otherMessageTime: {
        color: 'rgba(0,0,0,0.5)',
        textAlign: 'left',
    },
    audioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 120,
    },
    audioIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    audioInfo: {
        flex: 1,
    },
    audioText: {
        fontSize: 14,
        color: 'white',
        fontWeight: '500',
    },
    audioDuration: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100,
    },
    emptyText: {
        fontSize: 20,
        color: '#666',
        marginBottom: 8,
        fontWeight: 'bold',
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        paddingBottom: Platform.OS === 'ios' ? 50 : 16,
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#838da3ff',
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: 12,
        marginRight: 12,
        maxHeight: 100,
        backgroundColor: '#f8f9fa',
        fontSize: 16,
        textAlign: 'right',
    },
    recordButton: {
        backgroundColor: '#28a745',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    recordButtonActive: {
        backgroundColor: '#dc3545',
    },
    recordButtonCanceling: {
        backgroundColor: '#ff6b35',
        transform: [{ scale: 1.1 }]
    },
    recordButtonText: {
        fontSize: 18,
        color: 'white',
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
        shadowRadius: 2,
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
    },
    sendButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    recordingOverlay: {
        // removed fullscreen overlay to avoid blocking touches
        display: 'none'
    },
    // audio row
    audioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 0,
        paddingHorizontal: 76,
    },
    audioRowMy: {
        backgroundColor: '#25D366',
        borderRadius: 16,
        // ensure white text
    },
    audioRowOther: {
        backgroundColor: '#920d9eff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e6e6e6'
    },
    playButtonCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(32, 11, 11, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10
    },
    playIcon: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700'
    },
    audioWaveContainer: {
        flex: 1,
        justifyContent: 'center'
    },
    waveBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4 // RN may ignore; visual helper
    },
    waveBar: {
        width: 3,
        backgroundColor: 'rgba(255,255,255,0.9)',
        marginHorizontal: 2,
        borderRadius: 2,
        height: 8
    },
    waveBarSmall: { height: 8, opacity: 0.8 },
    waveBarMedium: { height: 12, opacity: 0.9 },
    waveBarLarge: { height: 16, opacity: 1.0 },
    // در انتهای فایل، به بخش styles اضافه کن:

    colorPicker: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
        backgroundColor: 'rgba(126, 12, 12, 0.9)',
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 20,
    },
    colorOption: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginHorizontal: 8,
        borderWidth: 2,
        borderColor: '#7314e0ff',
    },
    recordingBanner: {
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 10,
        borderRadius: 12,
        backgroundColor: '#fff0f0',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ffcccc'
    },
    recordingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#b00020',
        marginBottom: 4,
    },
    recordingHint: {
        fontSize: 12,
        color: '#555',
    },
});