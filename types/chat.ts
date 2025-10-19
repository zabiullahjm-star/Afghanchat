export interface Message {
    id: string;
    chat_room_id: string;
    sender_id: string;
    content: string;
    message_type: 'text' | 'image' | 'system';
    created_at: string;
    read: boolean;
}

export interface ChatRoom {
    id: string;
    created_at: string;
    last_message: string | null;
    last_message_at: string;
    other_user_name: string;
}

// اضافه کردن تایپ پروفایل
export interface Profile {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    created_at: string;
    updated_at: string;
}

//export interface User {
// id: string;
// email: string;
// user_metadata: {
//     full_name?: string;
//};
//}