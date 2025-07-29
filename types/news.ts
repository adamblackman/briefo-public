import { Comment as SupabaseComment } from './comments'; // Import SupabaseComment

export interface Comment {
  id: number;
  username: string;
  text: string;
  time: string;
}

export interface Article {
  id: number;
  created_at: string;
  title: string;
  summary: string;
  links: string[];  // Changed from link: string
  categories: string[];  // Array of category names from the categories enum
  votes?: number;  // Optional fields for UI features
  cover_image_url?: string; // Optional: URL for the cover image
  commentCount?: number;
  comments?: SupabaseComment[]; // Changed to use SupabaseComment
}