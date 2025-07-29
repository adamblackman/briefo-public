import { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ExternalLink, MessageSquare, ThumbsDown, ThumbsUp, Send } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { Article } from '@/types/news';
import { supabase } from '@/lib/supabase';
import ShareModal from './ShareModal';
import { useAuth } from '@/context/AuthContext';

type ArticleCardProps = {
  article: Article;
  onPress: () => void;
  onPressComments: () => void;
};

export default function ArticleCard({ article, onPress, onPressComments }: ArticleCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [votes, setVotes] = useState(article.votes);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  
  useEffect(() => {
    setVotes(article.votes);
    if (user && article) {
      const fetchUserVoteStatus = async () => {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('liked_articles, disliked_articles')
            .eq('user_id', user.id)
            .single();

          if (error) {
            setUserVote(null);
            return;
          }

          if (profile) {
            if (profile.liked_articles?.includes(article.id)) {
              setUserVote('up');
            } else if (profile.disliked_articles?.includes(article.id)) {
              setUserVote('down');
            } else {
              setUserVote(null);
            }
          } else {
            setUserVote(null);
          }
        } catch (err: any) {
          setUserVote(null);
        }
      };
      fetchUserVoteStatus();
    } else {
      setUserVote(null);
    }
  }, [article, user]);
  
  const handleVote = async (voteType: 'up' | 'down', event?: any) => {
    event?.stopPropagation?.();
    if (!article) return;

    const currentVotes = votes ?? 0;
    const currentUserVote = userVote;

    let newVoteCount;
    let newUserVoteState: 'up' | 'down' | null;

    if (userVote === voteType) {
      newVoteCount = currentVotes - (voteType === 'up' ? 1 : -1);
      newUserVoteState = null;
    } else {
      const voteChange = userVote 
        ? (voteType === 'up' ? 2 : -2)
        : (voteType === 'up' ? 1 : -1);
      newVoteCount = currentVotes + voteChange;
      newUserVoteState = voteType;
    }

    setVotes(newVoteCount);
    setUserVote(newUserVoteState);

    try {
      const { error: newsError } = await supabase
        .from('news')
        .update({ votes: newVoteCount })
        .eq('id', article.id);

      if (newsError) {
        console.error('Error updating votes in Supabase (news):', newsError.message);
        throw newsError;
      }

      if (user) {
        const { data: profileData, error: profileFetchError } = await supabase
          .from('profiles')
          .select('liked_articles, disliked_articles')
          .eq('user_id', user.id)
          .single();

        if (profileFetchError) {
          console.error('Error fetching profile for vote update:', profileFetchError.message);
        } else if (profileData) {
          let updatedLikedArticles = [...(profileData.liked_articles || [])];
          let updatedDislikedArticles = [...(profileData.disliked_articles || [])];

          updatedLikedArticles = updatedLikedArticles.filter(id => id !== article.id);
          updatedDislikedArticles = updatedDislikedArticles.filter(id => id !== article.id);

          if (newUserVoteState === 'up') {
            updatedLikedArticles.push(article.id);
          } else if (newUserVoteState === 'down') {
            updatedDislikedArticles.push(article.id);
          }

          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ 
              liked_articles: updatedLikedArticles, 
              disliked_articles: updatedDislikedArticles 
            })
            .eq('user_id', user.id);

          if (profileUpdateError) {
            console.error('Error updating profile (likes/dislikes):', profileUpdateError.message);
          }
        }
      }
    } catch (err: any) {
      console.error('Vote update failed, reverting UI:', err.message);
      setVotes(currentVotes); 
      setUserVote(currentUserVote);
    }
  };
  
  const openArticleLink = (event?: any) => {
    event?.stopPropagation?.();
    
    if (article.links && article.links.length > 0 && article.links[0]) {
      WebBrowser.openBrowserAsync(article.links[0]);
    } else {
      // Intentionally leaving no console warning for missing link in production clean-up
    }
  };
  
  const handleCommentPress = (event?: any) => {
    event?.stopPropagation?.();
    onPressComments();
  };

  const handleSharePress = (event?: any) => {
    event?.stopPropagation?.(); 
    setIsShareModalVisible(true);
  };
  
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Pressable onPress={onPress} style={({ pressed }) => [
        styles.card, 
        { backgroundColor: colors.cardBackground },
        pressed && { opacity: 0.9 }
      ]}>
        <View style={styles.contentContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {article.title}
          </Text>
          
          {article.cover_image_url && (
            <View style={styles.imageWrapper}>
              <Image 
                source={{ uri: article.cover_image_url }} 
                style={styles.image} 
              />
              <TouchableOpacity 
                onPress={(e) => openArticleLink(e)} 
                style={[styles.linkIconContainer, { backgroundColor: colors.accent + '80' }]} 
              >
                <ExternalLink color="white" size={20} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        <View style={styles.footer}>
          <View style={styles.voteContainer}>
            <TouchableOpacity 
              onPress={(e) => handleVote('up', e)}
              style={[
                styles.voteButton, 
                userVote === 'up' && { backgroundColor: colors.accent + '30' }
              ]}
            >
              <ThumbsUp 
                size={16} 
                color={userVote === 'up' ? colors.accent : colors.textSecondary} 
              />
            </TouchableOpacity>
            
            <Text style={[
              styles.voteCount, 
              { 
                color: colors.textSecondary
              }
            ]}>
              {votes ?? 0}
            </Text>
            
            <TouchableOpacity 
              onPress={(e) => handleVote('down', e)}
              style={[
                styles.voteButton, 
                userVote === 'down' && { backgroundColor: colors.negative + '30' }
              ]}
            >
              <ThumbsDown 
                size={16} 
                color={userVote === 'down' ? colors.negative : colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.voteButton, { marginLeft: 12 }]}
              onPress={handleSharePress}
            >
              <Send size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.commentContainer}
            onPress={handleCommentPress}
          >
            <MessageSquare size={16} color={colors.textSecondary} />
            <Text style={[styles.commentCount, { color: colors.textSecondary }]}>
              {article.comments?.length ?? 0}
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
      <ShareModal 
        isVisible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        article={article}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  time: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  contentContainer: {
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 12,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 180,
  },
  linkIconContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    padding: 8,
    borderRadius: 16,
  },
  voteCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginHorizontal: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginLeft: 4,
  },
});