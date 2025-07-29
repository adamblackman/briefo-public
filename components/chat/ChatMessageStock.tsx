import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Stock } from '@/types/stocks';
import { supabase } from '@/lib/supabase';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface ChatMessageStockProps {
  stock: Stock; // Expects initial stock with at least symbol and name
  stock_price?: number; // Optional saved price at time of sending
  stock_gain?: number; // Optional saved percentage gain at time of sending
}

interface StockDetailData {
  currentPrice: number | null;
  percentageChanges: {
    '1D': number | null;
  };
  // Add other fields if needed from your edge function response
}

const ChatMessageStock: React.FC<ChatMessageStockProps> = ({ stock, stock_price, stock_gain }) => {
  const { colors } = useTheme();
  const router = useRouter();
  const [stockDetails, setStockDetails] = useState<StockDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we have the stored price and gain, use those instead of making an API call
    if (stock_price !== undefined && stock_gain !== undefined) {
      setStockDetails({
        currentPrice: stock_price / 100, // Convert price from integer (cents) back to dollars
        percentageChanges: {
          // Convert stock_gain from basis points (integer) back to percentage (decimal)
          '1D': stock_gain / 100
        }
      });
      setIsLoading(false);
      return;
    }

    // Otherwise, fetch from API as usual
    const fetchStockDetails = async () => {
      if (!stock.symbol) {
        setError('Stock symbol is missing.');
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: RpcError } = await supabase.functions.invoke('stock-detail', {
          body: { symbol: stock.symbol },
        });

        if (RpcError) {
          console.error('Supabase function error:', RpcError);
          throw new Error(RpcError.message || 'Failed to fetch stock details from function.');
        }
        
        // The data from the function might be nested, e.g., data.data
        const details = data?.data || data;

        if (!details || typeof details.currentPrice === 'undefined') {
          console.error('Malformed data from stock-detail function:', details);
          throw new Error('Failed to get complete stock details.');
        }
        setStockDetails(details);
      } catch (err: any) {
        console.error('Error fetching stock details:', err);
        setError(err.message || 'Could not load stock data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStockDetails();
  }, [stock.symbol, stock_price, stock_gain]);

  const handlePress = () => {
    if (stock && stock.symbol) {
      const stockDataString = JSON.stringify(stock);
      router.push(`/stockDetail?stockData=${encodeURIComponent(stockDataString)}`);
    }
  };

  if (isLoading) {
    return (
      <TouchableOpacity onPress={handlePress} style={[styles.container, { backgroundColor: 'transparent' }]} activeOpacity={0.7}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      </TouchableOpacity>
    );
  }

  if (error || !stockDetails) {
    return (
      <TouchableOpacity onPress={handlePress} style={[styles.container, { backgroundColor: 'transparent' }]} activeOpacity={0.7}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          Error: {error || 'Could not load stock details for'} ${stock.symbol} (Tap to retry/view)
        </Text>
      </TouchableOpacity>
    );
  }

  const dailyChange = stockDetails.percentageChanges?.['1D'];
  const currentPrice = stockDetails.currentPrice;
  const isPositive = dailyChange !== null && dailyChange >= 0;

  // Calculate absolute change if currentPrice and dailyChange (percentage) are available
  let absoluteChange: number | null = null;
  if (currentPrice !== null && dailyChange !== null) {
    // priceBeforeChange = currentPrice / (1 + dailyChange/100)
    // absoluteChange = currentPrice - priceBeforeChange
    const priceBeforeChange = currentPrice / (1 + dailyChange / 100);
    absoluteChange = currentPrice - priceBeforeChange;
  }

  return (
    <TouchableOpacity onPress={handlePress} style={[styles.container, { backgroundColor: 'transparent' }]} activeOpacity={0.7}>
      <View style={styles.leftContent}>
        <View style={[
          styles.symbolContainer, 
          { backgroundColor: isPositive ? colors.positive + '20' : colors.negative + '20' }
        ]}>
          <Text style={[
            styles.symbol, 
            { color: isPositive ? colors.positive : colors.negative }
          ]}>
            {stock.symbol}
          </Text>
        </View>
        <View style={styles.nameContainer}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {stock.name}
          </Text>
          {currentPrice !== null && (
            <Text style={[styles.price, { color: colors.textSecondary }]}>
              ${currentPrice.toFixed(2)}
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.rightContent}>
        {dailyChange !== null && (
          <>
            {isPositive ? (
              <TrendingUp size={14} color={colors.positive} style={styles.icon} />
            ) : (
              <TrendingDown size={14} color={colors.negative} style={styles.icon} />
            )}
            <View>
              <Text style={[styles.changeText, { color: isPositive ? colors.positive : colors.negative }]}>
                {isPositive ? '+' : ''}{dailyChange.toFixed(2)}%
              </Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Remove shadow
    minHeight: 60,
    width: '100%',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1, // Allow shrinking if name is too long
    marginRight: 8,
  },
  symbolContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  symbol: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
  },
  nameContainer: {
    flexShrink: 1, // Allow text to shrink and ellipsize
  },
  name: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginBottom: 2,
  },
  price: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  icon: {
    marginRight: 4,
  },
  changeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    textAlign: 'right',
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    flex: 1, // Allow text to take space for better tap target
    textAlign: 'center',
  }
});

export default ChatMessageStock; 