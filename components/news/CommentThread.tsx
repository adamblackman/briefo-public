import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import CommentItem from './CommentItem';
import { Comment as SupabaseComment } from '@/types/comments';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type CommentThreadProps = {
  comment: SupabaseComment;
  allComments: SupabaseComment[];
  onLike: (commentId: number) => void;
  onDislike: (commentId: number) => void;
  onReply: (commentId: number, username: string) => void;
  depth: number;
  commentVotes: { [commentId: number]: number };
  userVoteStatusForComments: { [commentId: number]: 'liked' | 'disliked' | null };
  highlightCommentId?: number | null;
};

export default function CommentThread({
  comment,
  allComments,
  onLike,
  onDislike,
  onReply,
  depth,
  commentVotes,
  userVoteStatusForComments,
  highlightCommentId,
}: CommentThreadProps) {
  const { colors } = useTheme();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (comment.user_id) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('profile_picture_url')
            .eq('user_id', comment.user_id)
            .single();

          if (error) {
            console.warn('Error fetching profile picture:', error.message);
            setProfilePictureUrl(undefined);
          } else if (data) {
            setProfilePictureUrl(data.profile_picture_url || undefined);
          }
        } catch (e) {
          console.warn('Exception fetching profile picture:', e);
          setProfilePictureUrl(undefined);
        }
      } else {
        setProfilePictureUrl(undefined);
      }
    };

    fetchProfilePicture();
  }, [comment.user_id]);

  // Find replies to the current comment from allComments
  const replies = allComments.filter(
    (reply) => reply.parent_comment_id === comment.id
  );

  const currentCommentVote = commentVotes[comment.id] || comment.votes || 0;
  const userVoteOnThisComment = userVoteStatusForComments[comment.id] || null;
  
  const isHighlighted = comment.id === highlightCommentId;

  return (
    <View 
      style={[
        styles.threadContainer, 
        depth > 0 && styles.replyIndent,
        isHighlighted && {
          backgroundColor: colors.accent + '30',
          borderColor: colors.accent,
          borderWidth: 1,
          borderRadius: 6,
          padding: 2,
          margin: -2,
        }
      ]}
    >
      <CommentItem
        comment={comment}
        onLike={onLike}
        onDislike={onDislike}
        onReply={onReply}
        currentVoteCount={currentCommentVote}
        userVoteStatus={userVoteOnThisComment}
        depth={depth}
        profilePictureUrl={profilePictureUrl}
      />
      {replies.length > 0 && (
        <View style={[styles.repliesContainer, { borderColor: colors.border }]}>
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              allComments={allComments}
              onLike={onLike}
              onDislike={onDislike}
              onReply={onReply}
              depth={depth + 1}
              commentVotes={commentVotes}
              userVoteStatusForComments={userVoteStatusForComments}
              highlightCommentId={highlightCommentId}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  threadContainer: {
    // Minimal to no margin here
  },
  replyIndent: {
    marginLeft: 10,
    paddingLeft: 5,
    marginTop: 0,
  },
  repliesContainer: {
    borderLeftWidth: 2.5,
    marginTop: 0,
    paddingTop: 0,
    marginLeft: 20,
  },
}); 