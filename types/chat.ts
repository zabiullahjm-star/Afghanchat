export interface Message {
    id: string;
    chat_room_id: string;
    sender_id: string;
    content: string;
    message_type: 'text' | 'image';
    created_at: string;
    read: boolean;
}

export interface ChatRoom {
    id: string;
    created_at: string;
    last_message: string | null;
    last_message_at: string;
    other_user_name: string; // اسم کاربر مقابل
}