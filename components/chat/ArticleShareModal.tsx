import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Platform,
  Image
} from 'react-native';
import { X, Search } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { Article } from '@/types/news';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
// import ArticleCard from '@/components/news/ArticleCard'; // We might need a simpler card for this view

type ArticleShareModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onSelectArticle: (article: Article) => void;
};

const { height } = Dimensions.get('window');

export default function ArticleShareModal({
  isVisible,
  onClose,
  onSelectArticle,
}: ArticleShareModalProps) {
  const { colors } = useTheme();
  const { user, userCategories: authUserCategories } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<number | null>(null); // Corrected type for setTimeout id

  // Fetch articles
  const fetchArticles = useCallback(async () => {
    if (!user) {
      setArticles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('news')
        .select('id, created_at, title, summary, links, categories, cover_image_url')
        .order('created_at', { ascending: false })
        .limit(20); // Keep limit reasonable for a modal view

      if (searchTerm.trim()) {
        // Using or filter for title and summary. For more complex search, consider textSearch with tsvector.
        query = query.or(`title.ilike.%${searchTerm.trim()}%,summary.ilike.%${searchTerm.trim()}%`);
      } else if (authUserCategories && authUserCategories.length > 0) {
        // Filter by categories if no search term and categories are available
        query = query.overlaps('categories', authUserCategories); // Use overlaps for array containment
      }
      // If no search term and no user categories, it fetches latest articles (as per initial logic)

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (data) {
        setArticles(data as Article[]);
      } else {
        setArticles([]);
      }
    } catch (err: any) {
      console.error('Error fetching articles for share modal:', err);
      setError('Failed to load articles. Please try again.');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [user, searchTerm, authUserCategories]); // Add searchTerm and authUserCategories to dependencies

  useEffect(() => {
    if (isVisible) {
      fetchArticles(); // Initial fetch when modal becomes visible
    }
  }, [isVisible, authUserCategories, user]); // fetchArticles itself depends on searchTerm, so no need to list it here if fetchArticles is stable

  // Debounced search
  useEffect(() => {
    if (!isVisible) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchArticles();
    }, 500); // Debounce time: 500ms

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, fetchArticles, isVisible]);

  // TODO: Implement article selection in renderItem

  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      {/* Fading Overlay */}
      <Animated.View
        style={styles.fadingOverlay}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Sliding Content Area */}
      <Animated.View
        style={styles.slidingContentWrapper}
        entering={SlideInDown.duration(300)}
        exiting={SlideOutDown.duration(300)}
      >
        <SafeAreaView style={[styles.modalContentContainer, { backgroundColor: colors.cardBackground }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerText, { color: colors.text }]}>Share an Article</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, backgroundColor: colors.background }]}
              placeholder="Search articles..."
              placeholderTextColor={colors.textSecondary}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm.trim() !== '' && (
              <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Articles List */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
          ) : error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : articles.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No articles found. Try adjusting your search or categories.
            </Text>
          ) : (
            <FlatList
              data={articles}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.articleItem, { borderBottomColor: colors.border}]}
                  onPress={() => onSelectArticle(item)}
                >
                  {item.cover_image_url && (
                    <Image source={{ uri: item.cover_image_url }} style={styles.articleImage} />
                  )}
                  <View style={styles.articleTextContainer}>
                    <Text style={[styles.articleTitle, { color: colors.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.summary && (
                       <Text style={[styles.articleSummary, { color: colors.textSecondary }]} numberOfLines={1}>
                         {item.summary}
                       </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContentContainer}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  slidingContentWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  modalContentContainer: {
    height: height * 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 25,
  },
  searchIcon: {
    marginRight: 8,
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  clearButton: {
    padding: 6,
    marginLeft: 4,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  articleItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  articleTextContainer: {
    flex: 1,
  },
  articleTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    marginBottom: 2,
  },
  articleSummary: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
}); 