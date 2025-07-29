import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ChartBar as BarChart2, ChevronUp, MessageSquare, TrendingUp } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StatsData } from '@/types/profile';

type ProfileStatsProps = {
  user: StatsData;
};

export default function ProfileStats({ user }: ProfileStatsProps) {
  const { colors } = useTheme();
  
  const stats = [
    { 
      title: 'Articles Read', 
      value: user.stats.articlesRead, 
      icon: <BarChart2 size={20} color={colors.accent} />,
      trend: '+12% this week',
      trendUp: true
    },
    { 
      title: 'Comments', 
      value: user.stats.comments, 
      icon: <MessageSquare size={20} color={colors.accent} />,
      trend: '+5% this week',
      trendUp: true
    },
    { 
      title: 'Portfolio Growth', 
      value: `${user.stats.portfolioGrowth}%`, 
      icon: <TrendingUp size={20} color={colors.positive} />,
      trend: 'YTD',
      trendUp: true
    },
  ];
  
  return (
    <Animated.View 
      entering={FadeIn.duration(300).delay(100)}
      style={[styles.card, { backgroundColor: colors.cardBackground }]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Comments
      </Text>
      
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View 
            key={index}
            style={[styles.statItem, { backgroundColor: colors.backgroundSecondary }]}
          >
            <View style={styles.statHeader}>
              {stat.icon}
              <View style={[
                styles.trendBadge, 
                { 
                  backgroundColor: stat.trendUp 
                    ? colors.positive + '20' 
                    : colors.negative + '20' 
                }
              ]}>
                <Text style={[
                  styles.trendText, 
                  { 
                    color: stat.trendUp ? colors.positive : colors.negative 
                  }
                ]}>
                  <ChevronUp size={12} /> {stat.trend}
                </Text>
              </View>
            </View>
            
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stat.value}
            </Text>
            <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
              {stat.title}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    marginBottom: 4,
  },
  statTitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
});