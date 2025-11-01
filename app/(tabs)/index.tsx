// app/(tabs)/index.tsx  (یا مسیر فایل فعلی شما)
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import * as SecureStore from 'expo-secure-store'; // <-- added

type ChatRoom = {
  id: string;
  last_message: string;
  last_message_at: string;
  last_message_sender_id?: string;
  last_message_type?: string; // 'text' | 'voice' | ...
  other_user_id: string;
  other_user_name: string;
};

export default function ChatListScreen() {
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // cache برای username ها تا هر بار از سرور دوباره گرفته نشه
  const usernameCacheRef = useRef<Record<string, string>>({});

  // کانال ریالتایم نگه داشته میشه تا cleanup درست باشه
  const realtimeChannelRef = useRef<any>(null);

  const CACHE_PREFIX = 'afghanchat:';

  // load cached chatRooms سریعاً برای نمایش قبل از fetch از سرور
  const loadCachedChatRooms = async (userId: string | undefined) => {
    if (!userId) return;
    try {
      const raw = await SecureStore.getItemAsync(CACHE_PREFIX + 'chatrooms:' + userId);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatRoom[];
        if (parsed && parsed.length > 0) {
          setChatRooms(parsed);
          setLoadingInitial(false);
        }
      }
    } catch (e) {
      console.warn('loadCachedChatRooms error', e);
    }
  };

  const saveCachedChatRooms = async (userId: string | undefined, rooms: ChatRoom[]) => {
    if (!userId) return;
    try {
      await SecureStore.setItemAsync(CACHE_PREFIX + 'chatrooms:' + userId, JSON.stringify(rooms));
    } catch (e) {
      console.warn('saveCachedChatRooms error', e);
    }
  };

  // گرفتن کاربر فعلی
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setCurrentUser(data?.user ?? null);
      } catch (e) {
        console.warn('getUser error', e);
        setCurrentUser(null);
      }
    };
    getUser();
  }, []);

  // وقتی currentUser آماده شد ابتدا cache را لود کن سپس fetch نهایی را بزن
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;
    // اول سعی کن از cache سریع نمایش بدی
    loadCachedChatRooms(currentUser.id).then(() => {
      // بعد از نمایش cache، fetch واقعی را انجام بده
      fetchChatRooms();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // تابعی که پیام‌ها را از جدول می‌گیرد و chatRooms را می‌سازد
  const fetchChatRooms = async () => {
    if (!currentUser || !currentUser.id) return;

    try {
      // بهترین حالت: آخرین پیام‌ها را بر اساس created_at نزولی بگیر
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or('sender_id.eq.' + currentUser.id + ',receiver_id.eq.' + currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('fetchChatRooms error', error);
        return;
      }

      // نگهداری جدیدترین پیام برای هر chat_room_id
      const roomMap: Record<string, ChatRoom> = {};

      (data ?? []).forEach((message: any) => {
        const roomId = message.chat_room_id;
        if (!roomId) return;

        const existing = roomMap[roomId];
        // چون داده‌ها نزولی هستن (newest first)، اولین برخورد آخرین پیامه
        if (!existing) {
          const parts = roomId.replace('room_', '').split('_');
          const otherId = parts.find((id: string) => id !== currentUser.id) || '';
          roomMap[roomId] = {
            id: roomId,
            last_message: message.content,
            last_message_at: message.created_at,
            last_message_sender_id: message.sender_id,
            last_message_type: message.message_type ?? 'text',
            other_user_id: otherId,
            other_user_name: 'کاربر' // مقدار موقت، بعدا از profiles خوانده می‌شود
          };
        }
      });

      // جمع کردن همه otherUserIdها برای گرفتن username
      const otherIds = Object.values(roomMap)
        .map(r => r.other_user_id)
        .filter(id => !!id);

      // گرفتن usernameها که در cache نیستند
      const idsToFetch = otherIds.filter(id => !usernameCacheRef.current[id]);

      if (idsToFetch.length > 0) {
        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', idsToFetch);

        if (!profilesErr && profiles) {
          profiles.forEach((p: any) => {
            usernameCacheRef.current[p.id] = p.username ?? ('کاربر ' + p.id.substring(0, 8));
          });
        }
      }

      // حالا مقادیر نهایی را در آرایه قرار بده
      const roomsFinal: ChatRoom[] = Object.values(roomMap).map(r => ({
        ...r,
        other_user_name:
          usernameCacheRef.current[r.other_user_id] ||
          'کاربر ' + (r.other_user_id ? r.other_user_id.substring(0, 8) : '')
      }));

      // مرتب‌سازی بر اساس زمان آخرین پیام (نزولی → جدیدترین بالا)
      roomsFinal.sort((a, b) => (new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));

      setChatRooms(roomsFinal);
      // ذخیره در کش برای دفعات بعد
      saveCachedChatRooms(currentUser.id, roomsFinal);
    } catch (err) {
      console.error('fetchChatRooms general error', err);
    } finally {
      setLoadingInitial(false);
    }
  };// handle پیام جدید — فقط آیتم مربوطه را آپدیت یا اضافه می‌کند (بدون loading کل صفحه)
  const handleNewMessage = async (newMsg: any) => {
    if (!newMsg || !currentUser?.id) return;

    const roomId = newMsg.chat_room_id;
    if (!roomId) return;

    setChatRooms(prev => {
      const existingIndex = prev.findIndex(r => r.id === roomId);
      const otherId =
        roomId.replace('room_', '').split('_').find((id: string) => id !== currentUser.id) || '';
      const otherName = usernameCacheRef.current[otherId] || ('کاربر ' + otherId.substring(0, 8));

      const newRoom: ChatRoom = {
        id: roomId,
        last_message: newMsg.content,
        last_message_at: newMsg.created_at,
        last_message_sender_id: newMsg.sender_id,
        last_message_type: newMsg.message_type ?? 'text',
        other_user_id: otherId,
        other_user_name: otherName
      };

      if (existingIndex === -1) {
        // اضافه کردن به صدر لیست
        return [newRoom, ...prev];
      } else {
        // بروزرسانی مورد و جابجایی به صدر
        const copy = [...prev];
        copy.splice(existingIndex, 1);
        return [newRoom, ...copy];
      }
    });

    // اگر username کش نشده بود، تلاش کن آن را بگیری
    const parts = roomId.replace('room_', '').split('_');
    const otherId = parts.find((id: string) => id !== currentUser.id) || '';
    if (otherId && !usernameCacheRef.current[otherId]) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', otherId)
          .single();

        if (profileData) {
          usernameCacheRef.current[otherId] = profileData.username || ('کاربر ' + otherId.substring(0, 8));
          // نیز نام را در chatRooms به‌روزرسانی کن
          setChatRooms(prev => prev.map(r => r.other_user_id === otherId ? { ...r, other_user_name: usernameCacheRef.current[otherId] } : r));
        }
      } catch (e) {
        // بی‌صدا خطا را لاگ کن
        console.warn('fetch profile for new message error', e);
      }
    }
  };

  // ایجاد subscription ریال‌تایم و پاکسازی ایمن
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    // یکبار fetch اولیه
    fetchChatRooms();

    // ساخت filter به صورت رشته (بدون backtick)
    const filterStr = 'or(sender_id.eq.' + currentUser.id + ',receiver_id.eq.' + currentUser.id + ')';

    // ساخت کانال و گوش دادن به INSERT و UPDATE (تا پیام‌های جدید و ویرایش‌ها را بگیریم)
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: filterStr
      }, (payload: any) => {
        handleNewMessage(payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: filterStr
      }, (payload: any) => {
        handleNewMessage(payload.new);
      })
      .subscribe();

    realtimeChannelRef.current = channel;

    // cleanup امن: از removeChannel استفاده کن
    return () => {
      try {
        if (realtimeChannelRef.current) {
          supabase.removeChannel(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
      } catch (e) {
        console.warn('removeChannel error', e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // نمایشloading اولیه
  if (loadingInitial || !currentUser) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 12 }}>{!currentUser ? 'در حال دریافت اطلاعات کاربر...' : 'در حال بارگذاری مکالمات...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💬 مکالمات من</Text>
        <Text style={styles.subtitle}>{chatRooms.length} مکالمه</Text>
      </View>

      <FlatList
        data={chatRooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() =>
              router.push({
                pathname: '/chat/[roomId]',
                params: { roomId: item.id, otherUserName: item.other_user_name }
              } as any)
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.other_user_name || '').charAt(0)}
              </Text>
            </View>

            <View style={styles.chatInfo}>
              <Text style={styles.userName}>{item.other_user_name}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {/* اگر آخرین پیام از خود کاربر بوده، پیشوند 'شما:' نشان بده */}
                {item.last_message_type === 'voice'
                  ? '🔊 ویس'
                  : (item.last_message_sender_id === currentUser.id ? 'شما: ' : '') + item.last_message}
              </Text>
            </View>

            <View style={styles.timeContainer}>
              <Text style={styles.time}>{timeAgo(item.last_message_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>هنوز هیچ مکالمه‌ای ندارید</Text>
            <Text style={styles.emptySubText}>
              برای شروع یک چت جدید، به صفحه مخاطبین رفته کاربر مورد نظر را جستجو کنید
            </Text>
          </View>
        }
      />
    </View>
  );
}

// زمان نسبی
function timeAgo(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffH = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffH < 1) return 'همین الان';
    if (diffH < 24) return Math.floor(diffH) + ' ساعت پیش';
    return Math.floor(diffH / 24) + ' روز پیش';
  } catch (e) {
    return '';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { padding: 16, paddingTop: 60, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#1a1a1a' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#666', marginTop: 4 },
  chatItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  chatInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#1a1a1a' },
  lastMessage: { fontSize: 14, color: '#666' },
  timeContainer: { alignItems: 'flex-end' },
  time: { fontSize: 12, color: '#999', marginBottom: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },
  emptyText: { fontSize: 18, color: '#666', marginBottom: 8, textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#999', textAlign: 'center' }
});