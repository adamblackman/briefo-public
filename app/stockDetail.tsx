import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ChevronLeft, ChevronDown, ChevronUp, Send, Newspaper, BarChart2, FileText, ChevronRight } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import Animated from 'react-native-reanimated';
import { Stock } from '@/types/stocks';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase'; // Import Supabase client
import StockShareModal from '@/components/stocks/StockShareModal'; // Import the StockShareModal
import companySummariesData from '@/app/companySummaries.json';

const screenWidth = Dimensions.get('window').width;
const chartWidthConst = screenWidth + 4; // Add a tiny bit extra width to ensure coverage

// Helper function to format market value with abbreviations (M for million, B for billion)
const formatMarketValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  
  if (value >= 1_000_000_000) {
    const billions = value / 1_000_000_000;
    return `$${billions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} B`;
  } else if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
  } else {
    return `$${value.toLocaleString()}`;
  }
};

// Define the type for the detailed stock data from your Edge Function
interface StockDetailData {
  symbol: string;
  currentPrice: number | null;
  percentageChanges: {
    '1D': number | null;
    '1W': number | null;
    '1M': number | null;
    '3M': number | null;
    'YTD': number | null;
    '1Y': number | null;
    '2Y': number | null;
  };
  chartData: {
    '1D': { x: number; y: number }[];
    '1W': { x: number; y: number }[];
    '1M': { x: number; y: number }[];
    '3M': { x: number; y: number }[];
    'YTD': { x: number; y: number }[];
    '1Y': { x: number; y: number }[];
    '2Y': { x: number; y: number }[];
  };
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketValue: number | null;
  peRatio: string | null;
}

interface CompanySummary {
  ticker: string;
  name: string;
  description: string | null;
}

// Session cache stored outside component to persist across re-renders but not across app closes
let sessionStockDetailsCache: { [key: string]: StockDetailData } = {};

// Helper function to ensure chart data extends to the right edge
const ensureChartFillsWidth = (dataPoints: { x: number; y: number }[]): { x: number; y: number }[] => {
  if (dataPoints.length === 0) return [];
  
  // Clone the array to avoid modifying the original
  const result = [...dataPoints];
  
  // Get the last point's value
  const lastPoint = result[result.length - 1];
  
  // If we have actual data, add an extra point with the same y-value but at "now" timestamp
  // This ensures the line extends to the right edge
  const now = new Date().getTime();
  if (lastPoint && lastPoint.x < now) {
    result.push({ x: now, y: lastPoint.y });
  }
  
  return result;
};

export default function StockDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ stockData?: string }>();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '2Y'>('1D');
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [companyDescription, setCompanyDescription] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const stock: Stock | null = params.stockData ? JSON.parse(params.stockData) : null;

  const [apiStockData, setApiStockData] = useState<StockDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stock?.symbol) {
      const fetchStockDetails = async () => {
        if (sessionStockDetailsCache[stock.symbol]) {
          setApiStockData(sessionStockDetailsCache[stock.symbol]);
          setIsLoading(false);
          setError(null);
          return;
        }

        setIsLoading(true);
        setError(null);
        try {
          const { data, error: funcError } = await supabase.functions.invoke('stock-detail', {
            body: { symbol: stock.symbol },
          });

          if (funcError) {
            throw funcError;
          }

          if (data && data.data) { // The actual data is nested under response.data.data
            const detailedData = data.data as StockDetailData;
            setApiStockData(detailedData);
            sessionStockDetailsCache[stock.symbol] = detailedData; // Cache the data
          } else {
            throw new Error("No data returned from function or data format incorrect.");
          }
        } catch (e: any) {
          console.error('Error fetching stock details:', e);
          setError(e.message || 'Failed to fetch stock details.');
          // Keep potentially stale initial stock data for display if API fails
        } finally {
          setIsLoading(false);
        }

        // Load company description
        const summaryData = (companySummariesData as CompanySummary[]).find(
          (item) => item.ticker === stock.symbol
        );
        setCompanyDescription(summaryData?.description ?? 'No description available for this company.');
        setIsDescriptionExpanded(false); // Reset expansion state on stock change
      };

      fetchStockDetails();
    } else {
      setIsLoading(false);
      setError("Stock symbol not available.");
    }
  }, [stock?.symbol]);

  if (!stock) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{color: colors.text}}>Loading stock details or stock data not provided...</Text>
      </View>
    );
  }

  const currentPrice = apiStockData?.currentPrice ?? stock?.price ?? 0;
  // Fallback for initial 1D change for the header if API data is not yet ready or for other timeframes
  const initialDailyChange = apiStockData?.percentageChanges?.['1D'] ?? stock?.change ?? 0;

  const chartConfigAndData = useMemo(() => {
    let dataPoints: number[] = [];
    let changeForColorCalculation = initialDailyChange;

    if (apiStockData?.percentageChanges?.[selectedTimeframe] !== null && 
        apiStockData?.percentageChanges?.[selectedTimeframe] !== undefined) {
      changeForColorCalculation = apiStockData.percentageChanges[selectedTimeframe]!;
    }

    // Create properly extended chart data points
    if (apiStockData?.chartData?.[selectedTimeframe] && apiStockData.chartData[selectedTimeframe].length > 0) {
      // Ensure chart extends to the right edge by adding a data point if needed
      const extendedChartData = ensureChartFillsWidth(apiStockData.chartData[selectedTimeframe]);
      dataPoints = extendedChartData.map(point => point.y);
    } else if (stock?.chartData && selectedTimeframe === '1D') {
      dataPoints = stock.chartData;
    } else {
      // Fallback to mock generation
      const basePrice = apiStockData?.currentPrice ?? stock?.price ?? 0;
      switch(selectedTimeframe) {
        case '1D': dataPoints = [basePrice * 0.95, basePrice * 0.97, basePrice * 0.99, basePrice * 0.98, basePrice * 1.01, basePrice]; break;
        case '1W': dataPoints = [basePrice * 0.92, basePrice * 0.95, basePrice * 0.93, basePrice * 0.97, basePrice * 0.99, basePrice]; break;
        case '1M': dataPoints = [basePrice * 0.88, basePrice * 0.92, basePrice * 0.90, basePrice * 0.95, basePrice * 0.97, basePrice]; break;
        case '3M': dataPoints = [basePrice * 0.85, basePrice * 0.88, basePrice * 0.82, basePrice * 0.90, basePrice * 0.93, basePrice]; break;
        case 'YTD':dataPoints = [basePrice * 0.80, basePrice * 0.85, basePrice * 0.88, basePrice * 0.82, basePrice * 0.95, basePrice]; break;
        case '1Y': dataPoints = [basePrice * 0.75, basePrice * 0.80, basePrice * 0.77, basePrice * 0.85, basePrice * 0.90, basePrice]; break;
        case '2Y': dataPoints = [basePrice * 0.65, basePrice * 0.70, basePrice * 0.75, basePrice * 0.72, basePrice * 0.85, basePrice]; break;
        default:   dataPoints = [basePrice * 0.95, basePrice * 0.97, basePrice * 0.99, basePrice * 0.98, basePrice * 1.01, basePrice];
      }
    }
    
    if (dataPoints.length === 1) {
        dataPoints = [dataPoints[0], dataPoints[0]];
    } else if (dataPoints.length === 0) {
        const basePrice = apiStockData?.currentPrice ?? stock?.price ?? 0;
        dataPoints = [basePrice, basePrice];
    }

    const isPositiveForChart = changeForColorCalculation >= 0;

    return {
      lineChartData: {
        labels: [], 
        datasets: [
          {
            data: dataPoints,
            color: () => isPositiveForChart ? colors.positive : colors.negative,
            strokeWidth: 2
          }
        ],
        withInnerLines: false,
        fromZero: false,
      },
      chartKitConfig: {
        backgroundColor: colors.cardBackground,
        backgroundGradientFrom: colors.cardBackground,
        backgroundGradientTo: colors.cardBackground,
        decimalPlaces: 2,
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`, // Default, will be overridden by dataset color
        labelColor: (opacity = 1) => colors.textSecondary,
        style: {
          borderRadius: 16
        },
        propsForDots: {
          r: '4',
          strokeWidth: '2',
          stroke: isPositiveForChart ? colors.positive : colors.negative
        },
        propsForBackgroundLines: {
          stroke: "transparent"
        },
        horizontalLabelRotation: 0,
        verticalLabelRotation: 0,
      }
    };
  }, [selectedTimeframe, stock, apiStockData, colors, initialDailyChange]);
  
  if (isLoading && !apiStockData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.text, marginTop: 10 }}>Loading stock details...</Text>
      </View>
    );
  }

  if (error && !apiStockData) {
     return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 }}>Error: {error}</Text>
        <Text style={{color: colors.text, textAlign: 'center', paddingHorizontal: 20, marginTop: 10 }}>Could not load details for {stock?.symbol}.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
            <Text style={{color: colors.accent}}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const displayPrice = apiStockData?.currentPrice ?? stock?.price ?? 0;
  // Use this for the change display for the header section - it should reflect the selectedTimeframe's change or fallback
  
  let headerDisplayChange: number | string = 'N/A';
  let headerDisplayIsPositive = false;

  if (selectedTimeframe === '1D') {
    const dailyChange = apiStockData?.percentageChanges?.['1D'] ?? initialDailyChange;
    if (dailyChange !== null) {
      headerDisplayChange = dailyChange;
      headerDisplayIsPositive = dailyChange >= 0;
    }
  } else if (apiStockData?.percentageChanges?.[selectedTimeframe] !== null && 
             apiStockData?.percentageChanges?.[selectedTimeframe] !== undefined) {
    const timeframeChange = apiStockData.percentageChanges[selectedTimeframe]!;
    headerDisplayChange = timeframeChange;
    headerDisplayIsPositive = timeframeChange >= 0;
  }
  // If headerDisplayChange remains 'N/A', headerDisplayIsPositive remains false (won't be used for styling 'N/A')

  return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={[styles.symbol, { color: colors.text }]}>
              {stock?.symbol}
            </Text>
            <Text style={[styles.name, { color: colors.textSecondary }]}>
              {stock?.name}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={() => setIsShareModalVisible(true)}
          >
            <Send size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingHorizontal: 0 }}
          showsVerticalScrollIndicator={false}
        >
          <View 
            style={styles.priceContainer}
          >
            <Text style={[styles.price, { color: colors.text }]}>
              ${displayPrice.toFixed(2)}
            </Text>
            
            <View style={[
              styles.changeContainer, 
              // Only apply background if it's a number
              typeof headerDisplayChange === 'number' ? 
                { backgroundColor: headerDisplayIsPositive ? colors.positive + '20' : colors.negative + '20' } : 
                { backgroundColor: colors.cardBackground, paddingHorizontal: 10, paddingVertical: 5 } // Or some neutral style for N/A
            ]}>
              <Text style={[
                styles.change, 
                // Only apply color if it's a number
                typeof headerDisplayChange === 'number' ? 
                  { color: headerDisplayIsPositive ? colors.positive : colors.negative } : 
                  { color: colors.textSecondary } // Neutral color for N/A
              ]}>
                {typeof headerDisplayChange === 'number' ? 
                  `${headerDisplayIsPositive ? '+' : ''}${headerDisplayChange.toFixed(2)}%` : 
                  headerDisplayChange /* Which is 'N/A' */}
              </Text>
            </View>
          </View>

          <View style={[styles.chartContainer, { paddingHorizontal: 0, marginHorizontal: 0 }]}>
            <LineChart
              data={chartConfigAndData.lineChartData}
              width={chartWidthConst}
              height={220}
              chartConfig={{
                ...chartConfigAndData.chartKitConfig,
                // Enhance rendering quality for smoother, more precise curves
                propsForBackgroundLines: {
                  stroke: "transparent",
                },
                // Increased stroke width for visibility
                strokeWidth: 3,
                // Bezier curve will use default tension
              }}
              bezier
              style={{
                ...styles.chart,
                marginHorizontal: -2, 
                paddingLeft: 0, // Remove left padding
                paddingRight: 0, // Remove right padding
              }}
              withDots={false}
              withShadow={false}
              withVerticalLines={false}
              withHorizontalLines={false}
              withVerticalLabels={false}
              yLabelsOffset={999}
              yAxisLabel=""
              yAxisSuffix=""
              segments={2} 
              getDotProps={() => ({ r: '0' })} 
              formatXLabel={() => ''} 
              formatYLabel={() => ''} 
            />
            
            <View style={[styles.timeframeContainer, { paddingHorizontal: 16 }]}>
              {['1D', '1W', '1M', '3M', 'YTD', '1Y', '2Y'].map((period) => (
                <TouchableOpacity 
                  key={period}
                  style={styles.timeframeButton}
                  onPress={() => setSelectedTimeframe(period as '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '2Y')}
                >
                  <Text style={[
                    styles.timeframeText,
                    selectedTimeframe === period ? { color: colors.accent } : { color: colors.textSecondary }
                  ]}>
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {companyDescription && companyDescription !== 'No description available for this company.' && (
            <View style={[styles.descriptionSection, { paddingHorizontal: 16 }]}>
              <Text 
                style={[styles.descriptionText, { color: colors.textSecondary }]}
                numberOfLines={isDescriptionExpanded ? undefined : 4}
              >
                {companyDescription}
              </Text>
              {/* Only show Read More/Less if the description is long enough to be truncated or is expanded */}
              {(companyDescription.length > 200 || isDescriptionExpanded) && ( 
                <TouchableOpacity onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)} style={styles.readMoreButton}>
                  <Text style={[styles.readMoreText, { color: colors.accent }]}>
                    {isDescriptionExpanded ? 'Read Less' : 'Read More'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}> 
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}> 
                52-week High
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}> 
                {apiStockData?.fiftyTwoWeekHigh ? `$${apiStockData.fiftyTwoWeekHigh.toFixed(2)}` : 'N/A'}
              </Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}> 
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}> 
                Market Value
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}> 
                {formatMarketValue(apiStockData?.marketValue)}
              </Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}> 
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}> 
                52-week Low
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}> 
                {apiStockData?.fiftyTwoWeekLow ? `$${apiStockData.fiftyTwoWeekLow.toFixed(2)}` : 'N/A'}
              </Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}> 
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}> 
                P/E
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}> 
                {apiStockData?.peRatio ?? 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.newsSection}>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.cardBackground }]}
              onPress={() => {
                if (stock?.symbol) {
                  router.push({
                    pathname: '/perplexity',
                    params: { 
                      prefillMessage: `Recent News: ${stock.symbol}`,
                      autoSend: 'true'
                    },
                  });
                }
              }}
            >
              <View style={styles.actionButtonContent}>
                <Newspaper size={20} color={colors.accent} />
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Recent News
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.cardBackground }]}
              onPress={() => {
                if (stock?.symbol) {
                  router.push({
                    pathname: '/perplexity',
                    params: { 
                      prefillMessage: `Financial Analysis: ${stock.symbol}`,
                      autoSend: 'true'
                    },
                  });
                }
              }}
            >
              <View style={styles.actionButtonContent}>
                <BarChart2 size={20} color={colors.accent} />
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Financial Analysis
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.cardBackground }]}
              onPress={() => {
                // Navigate to the new stock-research screen
                if (stock?.symbol && stock?.name) {
                  router.push({
                    pathname: '/stock-research',
                    params: { 
                      symbol: stock.symbol,
                      name: stock.name
                    },
                  });
                }
              }}
            >
              <View style={styles.actionButtonContent}>
                <FileText size={20} color={colors.accent} />
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  Deep Research Report
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {stock && (
          <StockShareModal
            isVisible={isShareModalVisible}
            onClose={() => setIsShareModalVisible(false)}
            stock={stock}
            currentPrice={apiStockData?.currentPrice ?? stock?.price ?? 0}
          />
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4, // For easier touch
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  symbol: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  name: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  shareButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  price: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    marginRight: 12,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  change: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
  chartContainer: {
    marginTop: 0,
    alignItems: 'center',
    width: '100%', // Ensure full width
    paddingHorizontal: 0, // Remove any padding
  },
  chart: {
    marginVertical: 4,
    borderRadius: 0, // Remove border radius to extend to edges
    paddingHorizontal: 0, // Remove padding
  },
  timeframeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    width: '100%',
  },
  timeframeButton: {
    padding: 4,
  },
  timeframeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  descriptionSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  descriptionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  readMoreButton: {
    marginTop: 4,
  },
  readMoreText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    width: '48%', // Adjust for spacing if needed
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  newsSection: {
    padding: 16,
    paddingBottom: 32,
    marginTop: -8,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginLeft: 12,
  },
}); 