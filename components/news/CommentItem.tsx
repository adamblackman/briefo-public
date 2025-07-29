import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react-native';
import { Comment as SupabaseComment } from '@/types/comments';
import { useTheme } from '@/context/ThemeContext'; // Assuming colors will be needed
import { useRouter } from 'expo-router'; // Added useRouter

// Helper function to check if a date is today (can be moved or imported if shared)
const isToday = (someDate: Date) => {
  const today = new Date();
  return someDate.getDate() === today.getDate() &&
    someDate.getMonth() === today.getMonth() &&
    someDate.getFullYear() === today.getFullYear();
};

type CommentItemProps = {
  comment: SupabaseComment;
  onLike: (commentId: number) => void;
  onDislike: (commentId: number) => void;
  onReply: (commentId: number, username: string) => void;
  currentVoteCount: number;
  userVoteStatus: 'liked' | 'disliked' | null;
  depth: number;
  profilePictureUrl?: string;
  // No direct 'colors' prop from useTheme, component will call useTheme itself
};

export default function CommentItem({
  comment,
  onLike,
  onDislike,
  onReply,
  currentVoteCount,
  userVoteStatus,
  depth,
  profilePictureUrl,
}: CommentItemProps) {
  const { colors } = useTheme(); // Get colors from theme context
  const router = useRouter(); // Initialize router

  const commentDate = comment.created_at ? new Date(comment.created_at) : null;
  let displayTime = 'just now';
  if (commentDate) {
    if (isToday(commentDate)) {
      displayTime = commentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      displayTime = commentDate.toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' });
    }
  }

  const username = comment.username || 'User';

  const handleProfilePress = () => {
    if (comment.user_id) {
      router.navigate({
        pathname: "/user/[id]",
        params: { 
          id: comment.user_id,
          fromModal: 'true'
        }
      });
    } else {
      console.log('Cannot navigate to profile: user_id is missing.');
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.commentCard}>
      <View style={styles.mainContentRow}>
        {/* Left side: Profile Picture, User and Text */}
        <TouchableOpacity onPress={handleProfilePress} style={styles.leftContentContainer}>
          {profilePictureUrl && (
            <Image source={{ uri: profilePictureUrl }} style={styles.profilePicture} />
          )}
        <View style={styles.textContentContainer}>
          <Text style={[styles.commentUser, { color: colors.accent }]}>{username}</Text>
          <Text style={[styles.commentText, { color: colors.text }]}>{comment.text}</Text>
        </View>
        </TouchableOpacity>

        {/* Right side: Time ONLY */}
        <View style={styles.timeContainer}>
          <Text style={[styles.commentTime, { color: colors.textSecondary }]}>{displayTime}</Text>
        </View>
      </View>

      {/* Actions Row: Reply and Vote UI */}
      <View style={styles.actionsRow}>
        {/* Reply Button - visible if depth < 4 */}
        {depth < 4 && (
          <TouchableOpacity 
            style={styles.replyButton}
            onPress={() => onReply(comment.id, username)}
          >
            <MessageSquare size={15} color={colors.textSecondary} />
            <Text style={[styles.replyButtonText, { color: colors.textSecondary }]}>Reply</Text>
          </TouchableOpacity>
        )}
        
        {/* Spacer to push vote UI to the right if reply button is present */}
        {depth < 4 && <View style={{ flex: 1 }} />}

        {/* Vote UI (original) */}
        <View style={styles.voteControlsContainer}>
          <TouchableOpacity
            style={[styles.commentVoteButton, { marginRight: 2 }, userVoteStatus === 'liked' && { backgroundColor: colors.accent + '20' } ]}
            onPress={() => onLike(comment.id)}
          >
            <ThumbsUp size={15} color={userVoteStatus === 'liked' ? colors.accent : colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.commentVoteCountText, { color: colors.textSecondary }]} >
            {currentVoteCount}
          </Text>
          <TouchableOpacity
            style={[styles.commentVoteButton, { marginLeft: 0 }, userVoteStatus === 'disliked' && { backgroundColor: colors.error + '20' } ]}
            onPress={() => onDislike(comment.id)}
          >
            <ThumbsDown size={15} color={userVoteStatus === 'disliked' ? colors.error : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// Base styles from ArticleDetailModal, will be refined
const styles = StyleSheet.create({
  commentCard: {
    paddingVertical: 4, // Significantly reduced vertical padding
    paddingHorizontal: 16,
  },
  mainContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4, // Reduced margin
  },
  leftContentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 6,
  },
  profilePicture: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    marginTop: 2,
  },
  textContentContainer: {
    flex: 1,
  },
  commentUser: {
    fontFamily: 'Inter-Medium',
    fontSize: 13, // Slightly smaller font
    marginBottom: 2, // Reduced margin 
  },
  commentText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13, // Slightly smaller font
    lineHeight: 18, // Reduced line height
  },
  timeContainer: {},
  commentTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 11, // Slightly smaller font
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4, // Reduced margin
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2, // Reduced padding
    paddingRight: 6, 
  },
  replyButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12, // Slightly smaller font
    marginLeft: 4, 
  },
  voteControlsContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentVoteButton: {
    paddingVertical: 1, // Reduced padding
    paddingHorizontal: 3, // Reduced padding
    borderRadius: 8,
  },
  commentVoteCountText: {
    fontSize: 12, // Slightly smaller font
    fontFamily: 'Inter-Medium',
    marginHorizontal: 3, 
  },
  // Removed voteContainerBase, commentVoteContainerAligned, voteButtonBase, voteCountBase as their logic is simplified/merged
}); 