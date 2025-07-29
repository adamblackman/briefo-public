export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  name: string;
  bio?: string;
  news_categories: string[];
  favorite_companies: string[];
  created_at: string;
  updated_at: string;
  profile_picture_url?: string;
  liked_articles: number[];
  disliked_articles: number[];
  liked_comments: number[];
  disliked_comments: number[];
}

export interface ProfileDisplayData {
  user_id: string;
  username: string;
  name: string;
  bio?: string;
  avatar?: string;
  profile_picture_url?: string;
  memberSince: string;
  news_categories: string[];
  favorite_companies: string[];
}

export interface StatsData {
  stats: {
    articlesRead: number;
    comments: number;
    portfolioGrowth: number;
  };
}