import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Stock } from '@/types/stocks';
import { supabase } from '@/lib/supabase';

type StockCardProps = {
  stock: Stock;
  onPress: () => void;
};

interface StockDetailData {
  currentPrice: number | null;
  percentageChanges: {
    '1D': number | null;
  };
}

export default function StockCard({ stock, onPress }: StockCardProps) {
  const { colors } = useTheme();
  const [stockDetails, setStockDetails] = useState<StockDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
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
  }, [stock.symbol]);
  
  // Get values for display
  const currentPrice = stockDetails?.currentPrice || stock.price;
  const dailyChange = stockDetails?.percentageChanges?.['1D'] ?? stock.change;
  const isPositive = dailyChange >= 0;
  
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <TouchableOpacity 
        onPress={onPress}
        style={[styles.card, { backgroundColor: colors.cardBackground }]}
      >
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
          <View>
            <Text 
              style={[styles.name, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {stock.name.length > 23 ? stock.name.substring(0, 19) + '...' : stock.name}
            </Text>
          </View>
        </View>
        
        <View style={styles.rightContent}>
          <View style={styles.priceAndChangeContainer}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
            ) : (
              <>
                <Text style={[styles.price, { color: colors.text }]}>
                  ${currentPrice.toFixed(2)}
                </Text>
                <View style={styles.changeContainer}>
                  {isPositive ? (
                    <TrendingUp size={14} color={colors.positive} />
                  ) : (
                    <TrendingDown size={14} color={colors.negative} />
                  )}
                  <Text style={[
                    styles.change, 
                    { color: isPositive ? colors.positive : colors.negative }
                  ]}>
                    {isPositive ? '+' : ''}{dailyChange.toFixed(2)}%
                  </Text>
                </View>
              </>
            )}
          </View>
          <ChevronRight size={20} color={colors.textSecondary} style={styles.chevronIcon} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  symbol: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
  },
  name: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceAndChangeContainer: {
    alignItems: 'flex-end',  // Right-align the price and change
    minHeight: 40, // Ensure consistent height during loading
    justifyContent: 'center',
  },
  price: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 2,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  change: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginLeft: 4,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  loader: {
    marginRight: 4,
  }
});