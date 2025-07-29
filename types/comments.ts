export interface Comment {
  id: number;
  created_at: string;
  news_id: number;        // Foreign key to the news article
  user_id: string | null; // Foreign key to the user (UUID), can be null if user is deleted
  username?: string | null; // Denormalized username, or fetch from profiles
  text: string;
  parent_comment_id?: number | null; // For threaded comments, references another comment's id
  votes?: number;  // Optional fields for UI features
  // You might also want to include user profile picture here if denormalizing
  // user_profile_picture_url?: string | null;
  // And potentially replies if you fetch them nested
  // replies?: Comment[]; 
} 