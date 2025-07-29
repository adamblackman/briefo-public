import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  // Modal, // Removed Modal
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  // InputAccessoryView // Removed if not used directly
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'; // Added for navigation
import { useTheme } from '@/context/ThemeContext';
import { ExternalLink, Send, ThumbsDown, ThumbsUp, CornerDownRight, ChevronLeft, X } from 'lucide-react-native'; // Removed Share2
import * as WebBrowser from 'expo-web-browser';
import { Article } from '@/types/news';
import { Comment as SupabaseComment } from '@/types/comments';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import CommentThread from '@/components/news/CommentThread'; // Ensure path is correct
import ShareModal from '@/components/news/ShareModal'; // Added import for ShareModal

// Helper function to render summary with clickable links
const renderSummaryWithLinks = (summary: string, links: string[], linkStyle: object) => {
  if (!summary) return null;

  // Regex to find [number] citations
  const citationRegex = /(\[\d+\])/g;
  const parts = summary.split(citationRegex).filter(part => part !== ''); // Split and remove empty strings

  return parts.map((part, index) => {
    const citationMatch = part.match(/\[(\d+)\]/); // Check if the part is a citation like [1]
    if (citationMatch) {
      const citationNumber = parseInt(citationMatch[1], 10);
      const linkIndex = citationNumber - 1; // Links array is 0-indexed

      if (links && linkIndex >= 0 && linkIndex < links.length && links[linkIndex]) {
        const url = links[linkIndex];
        return (
          <Text 
            key={`link-${index}-${citationNumber}`} 
            style={linkStyle} 
            onPress={() => WebBrowser.openBrowserAsync(url)}
          >
            {part}
          </Text>
        );
      } else {
        // If link doesn't exist for the number, render as plain text
        return <Text key={`text-${index}`}>{part}</Text>;
      }
    } else {
      // Regular text part
      return <Text key={`text-${index}`}>{part}</Text>;
    }
  });
};

// type ArticleDetailModalProps = { // Original props, will be adapted
//   article: Article; // This will be fetched
//   visible: boolean; // Not needed for a screen
//   onClose: () => void; // Handled by router.back()
//   showCommentsOnOpen?: boolean;
//   onCommentAdded?: (newComment: SupabaseComment) => void;
//   highlightCommentId?: number | null;
// };

// Props for the screen will be primarily from route params
export default function ArticleScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id: articleId, showCommentsOnOpen, highlightCommentId: highlightCommentIdParam, fromScreen } = useLocalSearchParams<{ 
    id: string; 
    showCommentsOnOpen?: string; // Params are strings
    highlightCommentId?: string;
    fromScreen?: string; // Add parameter to track source screen
  }>();

  const [article, setArticle] = useState<Article | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(true);
  
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  const [articleLikeStatus, setArticleLikeStatus] = useState<'liked' | 'disliked' | null>(null);
  const [articleVoteCount, setArticleVoteCount] = useState(0);
  
  const [commentVotes, setCommentVotes] = useState<{ [commentId: number]: number }>({});
  const [userVoteStatusForComments, setUserVoteStatusForComments] = useState<{ [commentId: number]: 'liked' | 'disliked' | null }>({});

  const [replyingTo, setReplyingTo] = useState<{ id: number; username: string } | null>(null);
  
  // Add state for share modal
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  // const commentsRef = useRef<View>(null); // Kept if used for scrolling
  const commentInputRef = useRef<TextInput>(null);

  const parsedHighlightCommentId = highlightCommentIdParam ? parseInt(highlightCommentIdParam, 10) : undefined;

  // Fetch Article Data and User's Like/Dislike Status
  useEffect(() => {
    const fetchArticleAndUserStatus = async () => {
      if (!articleId) {
        console.error("Article ID is missing");
        setLoadingArticle(false);
        return;
      }
      setLoadingArticle(true);
      try {
        // Fetch article details
        const { data: articleData, error: articleError } = await supabase
          .from('news')
          .select('*, comments(*)')
          .eq('id', articleId)
          .single();

        if (articleError) {
          console.error('Error fetching article:', articleError);
          setArticle(null);
          throw articleError; // Propagate error to stop further processing in this block
        }

        if (articleData) {
          const fetchedArticle = {
            ...articleData,
            comments: (articleData.comments || []).sort((a: SupabaseComment, b: SupabaseComment) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
          } as Article;
          setArticle(fetchedArticle);
          setArticleVoteCount(fetchedArticle.votes || 0);

          const initialCommentVotes: { [commentId: number]: number } = {};
          const initialUserVoteStatusForComments: { [commentId: number]: 'liked' | 'disliked' | null } = {};

          (fetchedArticle.comments as SupabaseComment[]).forEach(comment => {
            initialCommentVotes[comment.id] = comment.votes || 0;
            // Default to null, will be overridden by profile data if available
            initialUserVoteStatusForComments[comment.id] = null; 
          });
          setCommentVotes(initialCommentVotes);
          // Set initial empty state, will be populated by profile below

          if (user) {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('liked_articles, disliked_articles, liked_comments, disliked_comments') // Added comment fields
              .eq('user_id', user.id)
              .single();

            if (profileError) {
              setArticleLikeStatus(null);
              setUserVoteStatusForComments(initialUserVoteStatusForComments); // Use default if profile error
            } else if (profile) {
              // Article like status
              if (profile.liked_articles?.includes(fetchedArticle.id)) {
                setArticleLikeStatus('liked');
              } else if (profile.disliked_articles?.includes(fetchedArticle.id)) {
                setArticleLikeStatus('disliked');
              } else {
                setArticleLikeStatus(null);
              }

              // Comment like/dislike status
              (fetchedArticle.comments as SupabaseComment[]).forEach(comment => {
                if (profile.liked_comments?.includes(comment.id)) {
                  initialUserVoteStatusForComments[comment.id] = 'liked';
                } else if (profile.disliked_comments?.includes(comment.id)) {
                  initialUserVoteStatusForComments[comment.id] = 'disliked';
                }
              });
              setUserVoteStatusForComments(initialUserVoteStatusForComments);

            } else {
              setArticleLikeStatus(null); // No profile found
              setUserVoteStatusForComments(initialUserVoteStatusForComments); // No profile, use defaults
            }
          } else {
            setArticleLikeStatus(null); // No user, no like status
            setUserVoteStatusForComments(initialUserVoteStatusForComments); // No user, use defaults
          }
        }
      } catch (e) {
        console.error('Exception fetching article or user status:', e);
        setArticle(null); // Ensure article is null on error
        setArticleLikeStatus(null);
      } finally {
        setLoadingArticle(false);
      }
    };

    fetchArticleAndUserStatus();
  }, [articleId, user]); // Add user to dependency array
  
  // Scroll to comments if showCommentsOnOpen is true (passed as a string param)
  useEffect(() => {
    if (!loadingArticle && article && showCommentsOnOpen === 'true') {
      const timer = setTimeout(() => scrollToComments(), 250);
      return () => clearTimeout(timer);
    }
  }, [loadingArticle, article, showCommentsOnOpen]);
  
  const scrollToComments = () => {
    // Same scroll logic as before
    if (scrollViewRef.current) {
      try {
        scrollViewRef.current.scrollToEnd({ animated: true });
      } catch (e) { 
        console.log('Error scrolling to end of comments:', e);
        try { 
          scrollViewRef.current.scrollTo({ y: 10000, animated: true });
        } catch (scrollError) {
          console.log('Fallback scroll also failed:', scrollError);
        }
      }
    }
  };
  
  const openArticleLink = () => {
    // Use the first link from the links array, with optional chaining
    if (article?.links && article.links.length > 0 && article.links[0]) {
      WebBrowser.openBrowserAsync(article.links[0]);
    } else {
      // Optionally handle cases where no link is available
      console.log("No link available to open for this article.");
    }
  }
  
  const handleReplyPress = (commentId: number, username: string) => {
    setReplyingTo({ id: commentId, username });
    commentInputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleAddComment = async () => {
    if (!article) return;
    if (!commentText.trim()) {
      Alert.alert('Empty Comment', 'Please write something before commenting.');
      return;
    }
    if (!user) {
      Alert.alert('Not Logged In', 'You need to be logged in to comment.');
      return;
    }
    if (isSubmittingComment) return;

    setIsSubmittingComment(true);

    const newCommentPayload: Partial<SupabaseComment> & { news_id: number; user_id: string; username: string; text: string; } = {
      news_id: article.id, // article.id should be a number
      user_id: user.id,
      username: user.user_metadata?.username || user.email?.split('@')[0] || 'Anonymous',
      text: commentText.trim(),
      // votes: 0, // Supabase might default this or use a trigger
    };

    if (replyingTo) {
      newCommentPayload.parent_comment_id = replyingTo.id;
    }

    try {
      const { data: newCommentData, error } = await supabase
        .from('comments')
        .insert(newCommentPayload) 
        .select('*') // Remove the profiles join
        .single(); 

      if (error) {
        console.error('Error posting comment:', error);
        Alert.alert('Error', 'Could not post your comment. Please try again.');
      } else if (newCommentData) {
        setCommentText('');
        setReplyingTo(null); 
        // Add new comment to the local state
        setArticle(prevArticle => {
          if (!prevArticle) return null;
          const updatedComments = [...(prevArticle.comments || []), newCommentData as SupabaseComment];
          return { ...prevArticle, comments: updatedComments };
        });
        // Update comment votes state for the new comment
        setCommentVotes(prev => ({ ...prev, [newCommentData.id]: newCommentData.votes || 0 }));
      }
    } catch (e) {
      console.error('Exception posting comment:', e);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Voting logic (handleArticleLike, handleArticleDislike, handleCommentLike, handleCommentDislike)
  // remains largely the same, ensure it uses 'article.id' and 'commentId' correctly.
  // ... (Keep existing voting functions, ensure they check if 'article' is not null)

  const handleArticleLike = async () => {
    if (!article || !user) return; // Ensure user is available for profile update

    const previousVoteCount = articleVoteCount;
    const previousLikeStatus = articleLikeStatus;

    let newStatus: 'liked' | 'disliked' | null = null;
    let newVoteCount = articleVoteCount;

    if (articleLikeStatus === 'liked') { // Unliking
      newStatus = null;
      newVoteCount -= 1;
    } else { // Liking (or changing from dislike to like)
      newStatus = 'liked';
      newVoteCount += 1;
      if (articleLikeStatus === 'disliked') newVoteCount += 1; 
    }
    
    // Optimistic UI update
    setArticleLikeStatus(newStatus);
    setArticleVoteCount(newVoteCount);

    try {
      // 1. Update votes on 'news' table
      const { error: newsError } = await supabase
        .from('news')
        .update({ votes: newVoteCount })
        .eq('id', article.id);

      if (newsError) throw newsError;

      // 2. Update user's profile
      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('liked_articles, disliked_articles')
        .eq('user_id', user.id)
        .single();

      if (profileFetchError) {
        console.error("Failed to fetch profile for like update:", profileFetchError.message);
        // News vote updated, but profile not. UI reflects new state.
        // Consider if UI should revert here as well for full consistency.
        return; // Or throw to revert everything
      }

      if (profileData) {
        let updatedLikedArticles = [...(profileData.liked_articles || [])];
        let updatedDislikedArticles = [...(profileData.disliked_articles || [])];

        updatedLikedArticles = updatedLikedArticles.filter(id => id !== article.id);
        updatedDislikedArticles = updatedDislikedArticles.filter(id => id !== article.id);

        if (newStatus === 'liked') {
          updatedLikedArticles.push(article.id);
        }
        // If newStatus is null or 'disliked', it's handled by the initial filter or handleArticleDislike

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ 
            liked_articles: updatedLikedArticles, 
            disliked_articles: updatedDislikedArticles 
          })
          .eq('user_id', user.id);

        if (profileUpdateError) {
          console.error("Failed to update profile (likes):", profileUpdateError.message);
          // Again, news vote updated. UI reflects new state.
        }
      }

    } catch (error) {
      console.error("Failed to update article like status:", error);
      // Revert optimistic UI update on any error from news or critical profile operations
      setArticleLikeStatus(previousLikeStatus);
      setArticleVoteCount(previousVoteCount);
      Alert.alert("Error", "Could not update like status. Please try again.");
    }
  };
  
  const handleArticleDislike = async () => {
    if (!article || !user) return; // Ensure user is available

    const previousVoteCount = articleVoteCount;
    const previousLikeStatus = articleLikeStatus;

    let newStatus: 'liked' | 'disliked' | null = null;
    let newVoteCount = articleVoteCount;

    if (articleLikeStatus === 'disliked') { // Undisliking
      newStatus = null;
      newVoteCount += 1;
    } else { // Disliking (or changing from like to dislike)
      newStatus = 'disliked';
      newVoteCount -= 1;
      if (articleLikeStatus === 'liked') newVoteCount -= 1; 
    }
    
    // Optimistic UI update
    setArticleLikeStatus(newStatus);
    setArticleVoteCount(newVoteCount);

    try {
      // 1. Update votes on 'news' table
      const { error: newsError } = await supabase
        .from('news')
        .update({ votes: newVoteCount })
        .eq('id', article.id);

      if (newsError) throw newsError;

      // 2. Update user's profile
      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('liked_articles, disliked_articles')
        .eq('user_id', user.id)
        .single();
      
      if (profileFetchError) {
        console.error("Failed to fetch profile for dislike update:", profileFetchError.message);
        return; // Or throw
      }

      if (profileData) {
        let updatedLikedArticles = [...(profileData.liked_articles || [])];
        let updatedDislikedArticles = [...(profileData.disliked_articles || [])];

        updatedLikedArticles = updatedLikedArticles.filter(id => id !== article.id);
        updatedDislikedArticles = updatedDislikedArticles.filter(id => id !== article.id);

        if (newStatus === 'disliked') {
          updatedDislikedArticles.push(article.id);
        }
        // If newStatus is null or 'liked', it's handled by the initial filter or handleArticleLike

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ 
            liked_articles: updatedLikedArticles, 
            disliked_articles: updatedDislikedArticles 
          })
          .eq('user_id', user.id);
        
        if (profileUpdateError) {
          console.error("Failed to update profile (dislikes):", profileUpdateError.message);
        }
      }

    } catch (error) {
      console.error("Failed to update article dislike status:", error);
      setArticleLikeStatus(previousLikeStatus);
      setArticleVoteCount(previousVoteCount);
      Alert.alert("Error", "Could not update dislike status. Please try again.");
    }
  };

  const handleCommentLike = async (commentId: number) => {
    if (!user) { // Ensure user is logged in to update profile
      Alert.alert("Login Required", "You need to be logged in to vote on comments.");
      return;
    }

    const currentStatus = userVoteStatusForComments[commentId];
    const oldVoteCount = commentVotes[commentId] || 0;
    
    let newVoteCount = oldVoteCount;
    let newStatus: 'liked' | 'disliked' | null = null;

    if (currentStatus === 'liked') { // Unliking
      newVoteCount -= 1;
      newStatus = null;
    } else { // Liking (or changing from dislike)
      newVoteCount += 1;
      if (currentStatus === 'disliked') newVoteCount += 1; // Extra increment if changing from dislike
      newStatus = 'liked';
    }
    
    // Optimistic UI update
    const previousCommentVotes = { ...commentVotes };
    const previousUserVoteStatus = { ...userVoteStatusForComments };

    setCommentVotes(prev => ({ ...prev, [commentId]: newVoteCount }));
    setUserVoteStatusForComments(prev => ({ ...prev, [commentId]: newStatus }));

    try {
      // 1. Update votes on 'comments' table
      const { error: commentVoteError } = await supabase
        .from('comments')
        .update({ votes: newVoteCount })
        .eq('id', commentId);

      if (commentVoteError) throw commentVoteError;

      // 2. Update user's profile
      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('liked_comments, disliked_comments')
        .eq('user_id', user.id)
        .single();

      if (profileFetchError) {
        console.error("Failed to fetch profile for comment like update:", profileFetchError.message);
        // Comment vote updated, but profile not. UI reflects new state.
        // For full consistency, consider reverting comment vote as well or throwing.
        throw profileFetchError; // Throw to revert all optimistic updates
      }

      if (profileData) {
        let updatedLikedComments = [...(profileData.liked_comments || [])];
        let updatedDislikedComments = [...(profileData.disliked_comments || [])];

        // Remove from both lists first
        updatedLikedComments = updatedLikedComments.filter(id => id !== commentId);
        updatedDislikedComments = updatedDislikedComments.filter(id => id !== commentId);

        if (newStatus === 'liked') {
          updatedLikedComments.push(commentId);
        }
        // If newStatus is null or 'disliked', it's handled by the initial filter or handleCommentDislike

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ 
            liked_comments: updatedLikedComments, 
            disliked_comments: updatedDislikedComments 
          })
          .eq('user_id', user.id);

        if (profileUpdateError) {
          console.error("Failed to update profile (comment likes):", profileUpdateError.message);
          throw profileUpdateError; // Throw to revert all optimistic updates
        }
      } else {
        // This case should ideally not be reached if user is confirmed at the start
        console.error("Profile not found during comment like update.");
        throw new Error("Profile not found for comment like update.");
      }

    } catch (error) {
        console.error("Failed to update comment like status:", error);
        // Revert optimistic UI updates
        setCommentVotes(previousCommentVotes);
        setUserVoteStatusForComments(previousUserVoteStatus);
        Alert.alert("Error", "Could not update comment like status. Please try again.");
    }
  };

  const handleCommentDislike = async (commentId: number) => {
    if (!user) { // Ensure user is logged in
      Alert.alert("Login Required", "You need to be logged in to vote on comments.");
      return;
    }

    const currentStatus = userVoteStatusForComments[commentId];
    const oldVoteCount = commentVotes[commentId] || 0;
    
    let newVoteCount = oldVoteCount;
    let newStatus: 'liked' | 'disliked' | null = null;

    if (currentStatus === 'disliked') { // Undisliking
      newVoteCount += 1;
      newStatus = null;
    } else { // Disliking (or changing from like)
      newVoteCount -= 1;
      if (currentStatus === 'liked') newVoteCount -= 1; // Extra decrement if changing from like
      newStatus = 'disliked';
    }

    // Optimistic UI update
    const previousCommentVotes = { ...commentVotes };
    const previousUserVoteStatus = { ...userVoteStatusForComments };

    setCommentVotes(prev => ({ ...prev, [commentId]: newVoteCount }));
    setUserVoteStatusForComments(prev => ({ ...prev, [commentId]: newStatus }));

    try {
      // 1. Update votes on 'comments' table
      const { error: commentVoteError } = await supabase
        .from('comments')
        .update({ votes: newVoteCount })
        .eq('id', commentId);

      if (commentVoteError) throw commentVoteError;

      // 2. Update user's profile
      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('liked_comments, disliked_comments')
        .eq('user_id', user.id)
        .single();
      
      if (profileFetchError) {
        console.error("Failed to fetch profile for comment dislike update:", profileFetchError.message);
        throw profileFetchError;
      }

      if (profileData) {
        let updatedLikedComments = [...(profileData.liked_comments || [])];
        let updatedDislikedComments = [...(profileData.disliked_comments || [])];

        // Remove from both lists first
        updatedLikedComments = updatedLikedComments.filter(id => id !== commentId);
        updatedDislikedComments = updatedDislikedComments.filter(id => id !== commentId);

        if (newStatus === 'disliked') {
          updatedDislikedComments.push(commentId);
        }
        // If newStatus is null or 'liked', it's handled by the initial filter or handleCommentLike

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ 
            liked_comments: updatedLikedComments, 
            disliked_comments: updatedDislikedComments 
          })
          .eq('user_id', user.id);
        
        if (profileUpdateError) {
          console.error("Failed to update profile (comment dislikes):", profileUpdateError.message);
          throw profileUpdateError;
        }
      } else {
        console.error("Profile not found during comment dislike update.");
        throw new Error("Profile not found for comment dislike update.");
      }

    } catch (error) {
        console.error("Failed to update comment dislike status:", error);
        setCommentVotes(previousCommentVotes);
        setUserVoteStatusForComments(previousUserVoteStatus);
        Alert.alert("Error", "Could not update comment dislike status. Please try again.");
    }
  };

  if (loadingArticle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cardBackground, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Loading Article...', headerStyle: { backgroundColor: colors.cardBackground }, headerTintColor: colors.text }} />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Fetching article details...</Text>
      </SafeAreaView>
    );
  }
  
  if (!article) {
     return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cardBackground, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Article Not Found', headerStyle: { backgroundColor: colors.cardBackground }, headerTintColor: colors.text }} />
        <Text style={{ color: colors.text, fontSize: 18 }}>Article not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.accent, fontSize: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const allArticleComments = (article.comments as SupabaseComment[] || []);
  const topLevelComments = allArticleComments.filter(comment => !comment.parent_comment_id);
  
  // Define link style using theme
  const linkStyle = {
    color: colors.accent, // Use accent color for links
    textDecorationLine: 'underline', // Underline links
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#121212" }]}>
      <Stack.Screen 
        options={{ 
          headerStyle: { backgroundColor: "#121212" },
          headerTitleAlign: 'left',
          headerTitle: () => (
            <Text 
              numberOfLines={1} 
              style={{
                color: colors.text, 
                fontFamily: 'Inter-Bold',
                fontSize: 20,
                marginLeft: -15,
                marginRight: 10,
              }}
            >
              {article.title || 'Article'}
            </Text>
          ),
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => {
                if (fromScreen === 'profile') {
                  // Navigate back to profile if that's where we came from
                  router.replace('/(tabs)/profile');
                } else {
                  // Otherwise use standard back navigation
                  router.back();
                }
              }} 
              style={{ marginLeft: 5, paddingRight: 5 }}
            >
              <ChevronLeft size={28} color={colors.text} />
            </TouchableOpacity>
          ),
        }} 
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0} // Adjust if header is part of KAV
      >
        {/* Header section removed, will use Stack.Screen options */}

        <ScrollView 
          ref={scrollViewRef}
          style={[styles.scrollView, { backgroundColor: colors.cardBackground }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Article Image */}
          <View style={styles.articleContent}>
            <TouchableOpacity onPress={openArticleLink} style={styles.imageContainer}>
              <Image 
                source={{ uri: article.cover_image_url }} 
                style={styles.image} 
                resizeMode="cover"
              />
              <View style={[styles.linkOverlay, { backgroundColor: colors.accent + '80' }]}>
                <ExternalLink color="white" size={20} />
              </View>
            </TouchableOpacity>
            
            {/* Article Summary - Use the helper function here */}
            <Text style={[styles.summary, { color: colors.text }]}>
              {renderSummaryWithLinks(article.summary, article.links, linkStyle)}
            </Text>
            
            {/* Interaction Bar */}
            <View style={[styles.interactionContainer, { paddingVertical: 2 }]}>
              <View style={styles.voteContainer}>
                <TouchableOpacity 
                  style={[
                    styles.voteButton,
                    articleLikeStatus === 'liked' && { backgroundColor: colors.accent + '30' }
                  ]}
                  onPress={handleArticleLike}
                >
                  <ThumbsUp 
                    size={18} 
                    color={articleLikeStatus === 'liked' ? colors.accent : colors.textSecondary}
                  />
                </TouchableOpacity>
                <Text style={[styles.voteCount, { color: colors.textSecondary }]}>{articleVoteCount}</Text>
                <TouchableOpacity 
                  style={[
                    styles.voteButton,
                    articleLikeStatus === 'disliked' && { backgroundColor: colors.error + '30' }
                  ]}
                  onPress={handleArticleDislike}
                >
                  <ThumbsDown 
                    size={18} 
                    color={articleLikeStatus === 'disliked' ? colors.error : colors.textSecondary}
                  />
                </TouchableOpacity>
                {/* Share Button */}
                <TouchableOpacity 
                  style={[styles.voteButton, styles.shareButton]}
                  onPress={() => setShareModalVisible(true)}
                >
                  <Send size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          <View style={styles.commentsSectionOuter}>
            <Text style={[styles.commentsHeader, { color: colors.text, borderBottomColor: colors.border }]}>
              Comments ({allArticleComments.length})
            </Text>
            {topLevelComments.length > 0 ? (
              topLevelComments.map((comment, index) => (
                <View 
                  key={comment.id} 
                  style={[
                    styles.topLevelCommentContainer,
                    index < topLevelComments.length - 1 && {
                       borderBottomWidth: StyleSheet.hairlineWidth, 
                       borderBottomColor: colors.border,
                    }
                  ]}
                >
                  <CommentThread
                    comment={comment}
                    allComments={allArticleComments}
                    onLike={handleCommentLike}
                    onDislike={handleCommentDislike}
                    onReply={handleReplyPress} 
                    depth={0} 
                    commentVotes={commentVotes}
                    userVoteStatusForComments={userVoteStatusForComments}
                    highlightCommentId={parsedHighlightCommentId}
                  />
                </View>
              ))
            ) : (
              <Text style={[styles.noCommentsText, {color: colors.textSecondary}]}>
                No comments yet. Be the first to share your thoughts!
              </Text>
            )}
          </View>
          
          <View style={styles.bottomPadding} />
        </ScrollView>
        
        {replyingTo && (
          <View style={[styles.replyingToContainer, { backgroundColor: colors.background, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <CornerDownRight size={16} color={colors.textSecondary} style={{ marginRight: 8 }}/>
            <Text style={[styles.replyingToText, { color: colors.textSecondary }]}>
              Replying to @{replyingTo.username}
            </Text>
            <TouchableOpacity onPress={cancelReply} style={styles.cancelReplyButton}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.commentInputContainer, { backgroundColor: "#121212", borderTopColor: colors.border }]}>
          <TextInput
            ref={commentInputRef}
            style={[styles.commentInput, { 
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              borderColor: colors.border,
            }]}
            placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : "Add a comment..."}
            placeholderTextColor={colors.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            editable={!isSubmittingComment}
            multiline
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              { 
                backgroundColor: (commentText.trim() && !isSubmittingComment) 
                  ? colors.accent 
                  : colors.accent + '40' 
              }
            ]}
            onPress={handleAddComment}
            disabled={!commentText.trim() || isSubmittingComment}
          >
            {isSubmittingComment ? (
              <ActivityIndicator size="small" color={colors.cardBackground} />
            ) : (
              <Send size={18} color={colors.cardBackground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      
      {/* Share Modal */}
      {article && (
        <ShareModal
          isVisible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          article={article}
        />
      )}
    </SafeAreaView>
  );
}

// Styles (adapted from ArticleDetailModal, with potential adjustments)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  // Header styles removed as Stack.Screen options are used.
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24, 
    flexGrow: 1,
  },
  articleContent: {
    paddingHorizontal: 16, 
    paddingTop: 16, // Added padding for content below header
    marginBottom: 16, 
  },
  articleTitleText: { // Added style for title in content
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 220, // Slightly increased height
    borderRadius: 12,
  },
  linkOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  interactionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2, // Reduced from 4
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    padding: 6, // Reduced from 8
    borderRadius: 20, // More rounded
  },
  voteCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginHorizontal: 10, // Increased spacing
  },
  commentsSectionOuter: {
    paddingHorizontal: 16,
    marginTop: 2,
  },
  commentsHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  topLevelCommentContainer: {
    paddingVertical: 8, 
  },
  noCommentsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  bottomPadding: {
    height: 24, 
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10, // Increased padding
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyingToText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
  cancelReplyButton: {
    padding: 6, // Easier to tap
  },
  commentInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12, // Adjusted padding
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10, // More padding for home bar
    borderTopWidth: StyleSheet.hairlineWidth, 
    alignItems: 'center', // Align items center
  },
  commentInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10, 
    borderRadius: 22, // More rounded
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1, // Added border
    marginRight: 8, // Space before send button
  },
  sendButton: {
    width: 44, // Slightly larger
    height: 44, // Slightly larger
    borderRadius: 22, // Fully rounded
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    padding: 6,
    borderRadius: 20,
    marginLeft: 20, // Add left margin to separate from dislike button
  },
}); 