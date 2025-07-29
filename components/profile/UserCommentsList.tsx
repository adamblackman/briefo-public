import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'expo-router';
import { Comment } from '@/types/comments';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react-native'; // Assuming you have these icons
import { useNavigationFocus } from '@/context/NavigationFocusContext';

interface UserComment extends Comment {
  news_title?: string; // We'll try to fetch this for context
}

export default function UserCommentsList() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { setNavigationFocus } = useNavigationFocus();
  const [comments, setComments] = useState<UserComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserComments();
    }
  }, [user]);

  const fetchUserComments = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch user comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*') // Select all comment fields, including news_id
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;

      if (commentsData && commentsData.length > 0) {
        // Step 2: Collect unique news_ids
        const newsIds = [...new Set(commentsData.map(comment => comment.news_id))];

        // Step 3: Fetch news article titles for these news_ids
        const { data: articlesData, error: articlesError } = await supabase
          .from('news')
          .select('id, title')
          .in('id', newsIds);

        if (articlesError) throw articlesError;

        // Step 4: Create a map of news_id to title
        const articleTitleMap = new Map<number, string>();
        articlesData?.forEach(article => {
          articleTitleMap.set(article.id, article.title);
        });

        // Step 5: Format comments with news_title
        const formattedComments = commentsData.map(comment => ({
          ...comment,
          news_title: articleTitleMap.get(comment.news_id) || 'Unknown Article',
        }));
        setComments(formattedComments);
      } else {
        setComments([]); // No comments found
      }
    } catch (e: any) {
      console.error('Error fetching user comments:', e);
      setError(e.message || 'Failed to fetch comments.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommentPress = (newsId: number, commentId: number) => {
    setNavigationFocus(newsId, commentId, 'profile');
    router.push('/');
  };

  if (loading) {
    return (
      <View style={styles.centeredMessageContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Loading comments...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity onPress={fetchUserComments} style={[styles.retryButton, {backgroundColor: colors.accent}]}>
            <Text style={[styles.retryButtonText, {color: '#FFFFFF'}]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (comments.length === 0) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={[styles.noCommentsText, { color: colors.textSecondary }]}>
          No comments yet. Start a conversation!
        </Text>
      </View>
    );
  }

  const renderCommentItem = ({ item }: { item: UserComment }) => (
    <TouchableOpacity 
      style={[styles.commentItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
      onPress={() => handleCommentPress(item.news_id, item.id)}
    >
      {item.news_title && (
        <Text style={[styles.articleTitle, { color: colors.textSecondary }]}>
          {item.news_title}
        </Text>
      )}
      <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>
      <View style={styles.commentFooter}>
        <View style={styles.votesContainer}>
            <ThumbsUp size={14} color={colors.accent} />
            <Text style={[styles.voteCount, { color: colors.accent, marginLeft: 4 }]}>{item.votes || 0}</Text>
        </View>
        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>Comments</Text>
        <FlatList
            data={comments}
            renderItem={renderCommentItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContentContainer}
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  listContentContainer: {
    paddingBottom: 10,
  },
  centeredMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    minHeight: 150, // Ensure it takes some space
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  noCommentsText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  commentItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  articleTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginBottom: 6,
  },
  commentText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  votesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteCount: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
}); 