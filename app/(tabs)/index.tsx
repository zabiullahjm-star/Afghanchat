import React, { useEffect, useState } from 'react';
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
import { ChatRoom } from '../../types/chat';

export default function ChatListScreen() {
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        setCurrentUser(user);
      } catch (error) {
        console.error('خطا در دریافت کاربر:', error);
        setCurrentUser(null);
      }
    };

    getCurrentUser();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => {
      data.subscription.unsubscribe(); // ← حالا درست شد
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setChatRooms([]); // بعد از logout لیست خالی شود
      return;
    }

    const fetchChatRooms = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${currentUser.id}, receiver_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const roomMap = new Map();
          data.forEach(message => {
            if (!roomMap.has(message.chat_room_id)) {
              const roomParts = message.chat_room_id.replace('room_', '').split('_');
              const otherUserId = roomParts.find((id: string) => id !== currentUser.id);
              const otherUserName = otherUserId ? ` کاربر ${otherUserId.substring(0, 8)
                } ` : 'کاربر';
              roomMap.set(message.chat_room_id, {
                id: message.chat_room_id,
                last_message: message.content,
                last_message_at: message.created_at,
                other_user_name: otherUserName
              });
            }
          });
          setChatRooms(Array.from(roomMap.values()));
        }
      } catch (error) {
        console.error('خطا در دریافت چت‌ها:', error);
        setChatRooms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChatRooms();

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id = eq.${currentUser.id}`
      }, payload => {
        fetchChatRooms();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser]);


  // محاسبه زمان نسبی برای نمایش
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'همین الان';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} ساعت پیش`;
    } else {
      return `${Math.floor(diffInHours / 24)} روز پیش`;
    }
  };

  if (loading || !currentUser) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {!currentUser ? 'در حال دریافت اطلاعات کاربر...' : 'در حال بارگذاری مکالمات...'}
        </Text>
      </View>
    );
  }
  // این تابع رو اضافه کن:

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
            onPress={() => router.push({
              pathname: "/chat/[roomId]",
              params: { roomId: item.id }
            } as any)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.other_user_name.charAt(0)}
              </Text>
            </View>

            <View style={styles.chatInfo}>
              <Text style={styles.userName}>{item.other_user_name}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message}
              </Text>
            </View>

            <View style={styles.timeContainer}>
              <Text style={styles.time}>
                {getRelativeTime(item.last_message_at)}
              </Text>
              {/* <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>3</Text>
              </View> */}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>هنوز هیچ مکالمه‌ای ندارید</Text>
            <Text style={styles.emptySubText}>برای شروع یک چت جدید، به صفحه مخاطبین رفته کاربر مورد نظر را جستجو کنید</Text>
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
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
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
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
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
    fontSize: 20,
    fontWeight: 'bold'
  },
  chatInfo: {
    flex: 1
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1a1a1a'
  },
  lastMessage: {
    fontSize: 14,
    color: '#666'
  },
  timeContainer: {
    alignItems: 'flex-end'
  },
  time: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center'
  }
});