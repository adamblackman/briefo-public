import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text, Alert, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/context/ThemeContext';
import NewsHeader from '@/components/news/NewsHeader';
import ArticleCard from '@/components/news/ArticleCard';
import { Article } from '@/types/news';
import { Comment as SupabaseComment } from '@/types/comments';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNavigationFocus } from '@/context/NavigationFocusContext';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';

export default function NewsScreen() {
  const { colors } = useTheme();
  const { user, userCategories } = useAuth();
  const router = useRouter();
  const { 
    articleIdToOpen,
    commentIdToHighlight,
    sourceScreen,
    clearNavigationFocus 
  } = useNavigationFocus();
  const isFocused = useIsFocused();

  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategoriesForFilter, setSelectedCategoriesForFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    if (userCategories && userCategories.length > 0) {
      setSelectedCategoriesForFilter(userCategories);
    }
  }, [userCategories]);
  
  const fetchArticles = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true); // Ensure loading is true at the start of a fetch
    try {
      let query = supabase
        .from('news')
        .select('*, comments (*)')
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Don't filter by categories at the database level
      // Let the UI filter articles based on search and categories
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching articles:', error);
        setArticles([]); // Clear articles on error
        setFilteredArticles([]); // Also clear filtered articles
        return;
      }
      
      if (data) {
        const typedArticles = data.map(article => ({
          ...article,
          comments: (article.comments || []) as SupabaseComment[] 
        })) as unknown as Article[];
        setArticles(typedArticles);
        setFilteredArticles(typedArticles); // Initialize filtered articles with all articles
      }
    } catch (err) {
      console.error('Error in article fetch:', err);
      setArticles([]); // Clear articles on error
      setFilteredArticles([]); // Also clear filtered articles
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);
  
  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);
  
  useEffect(() => {
    // First filter all articles by search query
    let filteredResults = articles;
    
    // If we have an active search query, prioritize search over category filters
    if (searchQuery.trim() !== '') {
      const lowercaseQuery = searchQuery.toLowerCase();
      filteredResults = articles.filter(article => 
        article.title?.toLowerCase().includes(lowercaseQuery) || 
        article.summary?.toLowerCase().includes(lowercaseQuery)
      );
    } 
    // Only apply category filtering if no search query and categories are selected
    else if (selectedCategoriesForFilter && selectedCategoriesForFilter.length > 0) {
      filteredResults = filteredResults.filter(article => {
        if (!article.categories || article.categories.length === 0) return false;
        return article.categories.some(category => selectedCategoriesForFilter.includes(category));
      });
    }
    
    setFilteredArticles(filteredResults);
  }, [searchQuery, articles, selectedCategoriesForFilter]);
  
  useEffect(() => {
    if (isFocused && articleIdToOpen && sourceScreen === 'profile') {
      const params: any = { id: articleIdToOpen.toString() };
      if (commentIdToHighlight !== null) {
        params.highlightCommentId = commentIdToHighlight.toString();
      }
      params.showCommentsOnOpen = 'true';
      params.fromScreen = 'profile';
      
      router.push({ pathname: '/article/[id]', params });
      clearNavigationFocus();
    }
  }, [isFocused, articleIdToOpen, commentIdToHighlight, sourceScreen, router, clearNavigationFocus]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchArticles();
  };

  const handleToggleCategory = (category: string) => {
    setSelectedCategoriesForFilter(prev => {
      const isSelected = prev.includes(category);
      if (isSelected) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleShowFavorites = () => {
    setSelectedCategoriesForFilter(userCategories || []);
  };
  
  const handleArticlePress = (article: Article) => {
    router.push({ pathname: '/article/[id]', params: { id: article.id.toString(), fromScreen: 'news' } });
  };
  
  const handleCommentsPress = (article: Article) => {
    router.push({ pathname: '/article/[id]', params: { id: article.id.toString(), showCommentsOnOpen: 'true', fromScreen: 'news' } });
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };
  
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Image 
          source={require('@/assets/images/splash.png')}
          style={styles.splash}
          resizeMode="cover"
        />
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar hidden />
      <NewsHeader 
        userCategories={userCategories || []} 
        selectedCategories={selectedCategoriesForFilter}
        onToggleCategory={handleToggleCategory}
        onShowFavorites={handleShowFavorites}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />
      
      {filteredArticles.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            {searchQuery ? 'No articles found for your search' : 'No articles found for your selected categories'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredArticles}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ArticleCard 
              article={item} 
              onPress={() => handleArticlePress(item)}
              onPressComments={() => handleCommentsPress(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splash: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  }
});