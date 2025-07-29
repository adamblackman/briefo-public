export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface Friend {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface FriendRequest {
  id: string;
  user: {
    id: string;
    user_id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
  };
  created_at: string;
  status: FriendshipStatus;
}

export interface FriendDisplayData {
  id: string;
  user_id: string;
  username: string;
  name: string;
  profile_picture_url?: string;
  friendship_id: string;
  created_at: string;
} 