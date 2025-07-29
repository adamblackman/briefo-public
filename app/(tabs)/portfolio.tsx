import { useState, useMemo, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import PortfolioHeader from '@/components/portfolio/PortfolioHeader';
import StockCard from '@/components/portfolio/StockCard';
import { Stock } from '@/types/stocks';
import { COMPANIES } from '../../app/companies';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

// Removed mocked user favorite companies
// const userFavoriteCompanies = ['AAPL', 'GOOGL', 'MSFT']; 

export default function PortfolioScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, userCompanies, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const [stockApiData, setStockApiData] = useState<{ [symbol: string]: number | string }>({});
  const [isApiDataLoading, setIsApiDataLoading] = useState(false);
  const initialDataFetchedRef = useRef(false);

  // New state for search results' API data
  const [searchStockApiData, setSearchStockApiData] = useState<{ [symbol: string]: number | string }>({});
  const [isSearchApiDataLoading, setIsSearchApiDataLoading] = useState(false);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  useEffect(() => {
    const fetchPortfolioRealtimeData = async () => {
      if (userCompanies && userCompanies.length > 0 && !initialDataFetchedRef.current) {
        initialDataFetchedRef.current = true;
        setIsApiDataLoading(true);
        try {
          const { data: functionResponse, error } = await supabase.functions.invoke(
            'portfolio-tab-data',
            { body: { symbols: userCompanies } }
          );

          if (error) throw error;

          if (functionResponse && functionResponse.data) {
            setStockApiData(functionResponse.data);
          } else {
            console.warn("No data from portfolio-tab-data function:", functionResponse);
            const errorData: { [key: string]: string } = {};
            userCompanies.forEach(s => errorData[s] = "N/A");
            setStockApiData(errorData);
          }
        } catch (e) {
          console.error('Error invoking portfolio-tab-data function:', e);
          const errorData: { [key: string]: string } = {};
          userCompanies.forEach(s => errorData[s] = "N/A");
          setStockApiData(errorData);
        } finally {
          setIsApiDataLoading(false);
        }
      }
    };
    if (!searchQuery && !authLoading && user && userCompanies) {
       fetchPortfolioRealtimeData();
    }
  }, [userCompanies, authLoading, searchQuery, user]);

  // New effect for debounced fetching of search results data
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchStockApiData({}); // Clear search API data when query is empty
      setIsSearchApiDataLoading(false);
      return;
    }

    const handler = setTimeout(async () => {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const symbolsToFetch = Object.entries(COMPANIES)
        .filter(([ticker, name]) =>
          ticker.toLowerCase().includes(lowerCaseQuery) ||
          name.toLowerCase().includes(lowerCaseQuery)
        )
        .map(([ticker]) => ticker)
        .slice(0, 50); // Limit to avoid overly large API requests, adjust as needed

      if (symbolsToFetch.length > 0) {
        setIsSearchApiDataLoading(true);
        try {
          const { data: functionResponse, error } = await supabase.functions.invoke(
            'portfolio-tab-data',
            { body: { symbols: symbolsToFetch } }
          );

          if (error) throw error;

          if (functionResponse && functionResponse.data) {
            // Update searchStockApiData with new results, keeping old ones if symbols overlap (though unlikely with new search)
            setSearchStockApiData(functionResponse.data);
          } else {
            console.warn("No data from portfolio-tab-data function for search:", functionResponse);
            const errorData: { [key: string]: string } = {};
            symbolsToFetch.forEach(s => errorData[s] = "N/A");
            setSearchStockApiData(errorData);
          }
        } catch (e) {
          console.error('Error invoking portfolio-tab-data function for search:', e);
          const errorData: { [key: string]: string } = {};
          symbolsToFetch.forEach(s => errorData[s] = "N/A");
          setSearchStockApiData(errorData);
        } finally {
          setIsSearchApiDataLoading(false);
        }
      } else {
        setSearchStockApiData({}); // No symbols matched the search
      }
    }, 1000); // 1-second debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]); // Re-run when searchQuery changes

  const displayedStocks: Stock[] = useMemo(() => {
    if (searchQuery.trim() !== '') {
      const lowerCaseQuery = searchQuery.toLowerCase();
      return Object.entries(COMPANIES)
        .filter(([ticker, name]) => 
          ticker.toLowerCase().includes(lowerCaseQuery) || 
          name.toLowerCase().includes(lowerCaseQuery)
        )
        .map(([ticker, name]) => ({
          symbol: ticker,
          name: name,
          price: 0, 
          change: typeof searchStockApiData[ticker] === 'number' // Use searchStockApiData for search
                    ? searchStockApiData[ticker] as number 
                    : 0,
          marketCap: 0,
          volume: 0,
          sector: 'N/A',
        }));
    } else {
      if (!userCompanies) {
        return [];
      }
      return userCompanies.map(ticker => ({
        symbol: ticker,
        name: COMPANIES[ticker as keyof typeof COMPANIES] || 'N/A',
        price: 0,
        change: typeof stockApiData[ticker] === 'number' // Use stockApiData for watchlist
                  ? stockApiData[ticker] as number 
                  : 0,
        marketCap: 0,
        volume: 0,
        sector: 'N/A',
      }));
    }
  }, [searchQuery, userCompanies, stockApiData, searchStockApiData]); // Added searchStockApiData
  
  const showInitialLoading = authLoading || (isApiDataLoading && !searchQuery && Object.keys(stockApiData).length === 0);

  if (showInitialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.text, marginTop: 10 }}>{authLoading ? 'Loading user data...' : 'Fetching market data...'}</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PortfolioHeader searchQuery={searchQuery} onSearchChange={handleSearchChange} />
      
      {displayedStocks.length === 0 && !isApiDataLoading && !isSearchApiDataLoading && (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, {color: colors.text}]}>
            {searchQuery ? `No companies found for "${searchQuery}".` : "Your watchlist is empty. Add some companies!"}
          </Text>
        </View>
      )}

      { (isSearchApiDataLoading && displayedStocks.length === 0) && (
        <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.text, marginTop: 10 }}>Fetching market data for "{searchQuery}"...</Text>
        </View>
      )}
      
      <FlatList
        data={displayedStocks}
        keyExtractor={(item) => item.symbol}
        renderItem={({ item }) => (
          <StockCard 
            stock={item} 
            onPress={() => router.push({ 
              pathname: '../stockDetail',
              params: { stockData: JSON.stringify(item) } 
            })}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  }
});