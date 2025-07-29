export enum NotificationType {
  SUGGESTED_NEWS = 'suggested_news',
  MESSAGE = 'message',
  FRIEND_REQUEST = 'friend_request',
  ACCEPTED_REQUEST = 'accepted_request',
  TAGGED_COMMENT = 'tagged_comment',
}

export interface Notification {
  id: string; // UUID
  user_id: string; // UUID, foreign key to auth.users.id
  notification_type: NotificationType;
  related_item_id?: string | null; // ID of the news, chat, user, or comment entity
  related_item_source?: 'news' | 'chats' | 'users' | 'comments' | 'friend_requests' | null; // Describes the table/entity related_item_id refers to
  is_read: boolean;
  created_at: string; // ISO date string, e.g., from Supabase timestamp
  message_preview?: string | null; // Optional short message or preview for the notification
} 