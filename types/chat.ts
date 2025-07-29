import { Article } from './news';
import { Stock } from './stocks';

// Database-aligned message type
export interface Message {
  id: string;
  friendship_id: string; 
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  message_type?: 'text' | 'article' | 'stock'; // Optional field for content type
  reference_id?: number; // Changed to number in a previous step
  article_image_url?: string; // Added for shared article images
  stock_price?: number; // Added for storing stock price at time of sharing
  stock_gain?: number; // Added for storing stock percentage gain at time of sharing
  is_streaming?: boolean; // Flag indicating if this message is being streamed
}

export interface MessageWithSenderInfo extends Message {
  sender: {
    id: string;
    user_id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
  };
}

// Rich message content
export interface RichMessage {
  id: string;
  content: string | Article | Stock;
  timestamp: string;
  isMine: boolean;
  type: 'text' | 'stock' | 'article';
  article_image_url?: string; // Added for article messages
  stock_price?: number; // Added for stock messages 
  stock_gain?: number; // Added for stock messages
  is_streaming?: boolean; // Flag indicating if this message is being streamed
}

export interface ChatData {
  friendship_id: string;
  friend: {
    id: string;
    user_id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
  };
  last_message?: MessageWithSenderInfo;
  unread_count?: number;
}

export type SendMessageRequest = {
  friendship_id: string;
  content: string;
  message_type?: 'text' | 'article' | 'stock';
  reference_id?: number; // Changed to number
  article_image_url?: string; // Added for shared article images
}

export type ChatFriend = {
  id: string;
  user_id: string;
  username: string;
  name: string;
  profile_picture_url?: string;
  friendship_id: string;
}

// For UI representation of conversations
export interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string; // For display
  lastMessageCreatedAt?: string; // For sorting (original ISO string)
  unread: boolean;
  unreadCount: number;
  online: boolean;
  sent: boolean;
  delivered: boolean;
  messages?: RichMessage[];
  friendship_id?: string; // To link with the database model
  user_id?: string; // Auth user ID of the conversation partner
}