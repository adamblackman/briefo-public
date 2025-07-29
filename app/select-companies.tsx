import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, SafeAreaView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { COMPANIES } from './companies';
import { ChevronLeft, X as ClearIcon } from 'lucide-react-native';

// Convert object to array for UI rendering - this will be used for search results
const FULL_COMPANY_LIST = Object.entries(COMPANIES).map(([ticker, name]) => ({ ticker, name }));

const SECTORS_WITH_COMPANIES = [
  {
    sectorName: "Technology",
    companies: [
      { ticker: "AAPL", name: "Apple Inc." },
      { ticker: "MSFT", name: "Microsoft Corp." },
      { ticker: "NVDA", name: "NVIDIA Corporation" },
      { ticker: "AVGO", name: "Broadcom Inc." }
    ]
  },
  {
    sectorName: "Financials",
    companies: [
      { ticker: "JPM", name: "JPMorgan Chase & Co." },
      { ticker: "V", name: "Visa Inc." },
      { ticker: "MA", name: "Mastercard Incorporated" },
      { ticker: "BAC", name: "Bank of America Corporation" }
    ]
  },
  {
    sectorName: "Healthcare",
    companies: [
      { ticker: "JNJ", name: "Johnson & Johnson" },
      { ticker: "LLY", name: "Eli Lilly and Company" },
      { ticker: "UNH", name: "UnitedHealth Group Incorporated" },
      { ticker: "MRK", name: "Merck & Co., Inc." }
    ]
  },
  {
    sectorName: "Consumer Discretionary",
    companies: [
      { ticker: "AMZN", name: "Amazon.com, Inc." },
      { ticker: "TSLA", name: "Tesla, Inc." },
      { ticker: "HD", name: "The Home Depot, Inc." },
      { ticker: "MCD", name: "McDonald\'\'s Corporation" }
    ]
  },
  {
    sectorName: "Consumer Staples",
    companies: [
      { ticker: "PG", name: "Procter & Gamble Company" },
      { ticker: "KO", name: "The Coca-Cola Company" },
      { ticker: "PEP", name: "PepsiCo, Inc." },
      { ticker: "COST", name: "Costco Wholesale Corporation" }
    ]
  },
  {
    sectorName: "Energy",
    companies: [
      { ticker: "XOM", name: "Exxon Mobil Corporation" },
      { ticker: "CVX", name: "Chevron Corporation" },
      { ticker: "COP", name: "ConocoPhillips" },
      { ticker: "SLB", name: "Schlumberger Limited" }
    ]
  },
  {
    sectorName: "Industrials",
    companies: [
      { ticker: "GE", name: "GE Aerospace" },
      { ticker: "CAT", name: "Caterpillar Inc." },
      { ticker: "BA", name: "The Boeing Company" },
      { ticker: "HON", name: "Honeywell International Inc." }
    ]
  },
  {
    sectorName: "Real Estate",
    companies: [
      { ticker: "PLD", name: "Prologis, Inc." },
      { ticker: "AMT", name: "American Tower Corporation" },
      { ticker: "EQIX", name: "Equinix, Inc." },
      { ticker: "CCI", name: "Crown Castle Inc." }
    ]
  },
  {
    sectorName: "Utilities",
    companies: [
      { ticker: "NEE", name: "NextEra Energy, Inc." },
      { ticker: "DUK", name: "Duke Energy Corporation" },
      { ticker: "SO", name: "The Southern Company" },
      { ticker: "D", name: "Dominion Energy, Inc." }
    ]
  },
  {
    sectorName: "Communication Services",
    companies: [
      { ticker: "GOOGL", name: "Alphabet Inc. (Class A)" },
      { ticker: "META", name: "Meta Platforms, Inc." },
      { ticker: "NFLX", name: "Netflix, Inc." },
      { ticker: "CMCSA", name: "Comcast Corporation" }
    ]
  },
  {
    sectorName: "Materials",
    companies: [
      { ticker: "LIN", name: "Linde plc" },
      { ticker: "APD", name: "Air Products and Chemicals, Inc." },
      { ticker: "SHW", name: "The Sherwin-Williams Company" },
      { ticker: "ECL", name: "Ecolab Inc." }
    ]
  }
];

type ValidBackPath = '/(tabs)/settings' | '/(tabs)/portfolio';

interface EditCompaniesHeaderProps {
  backPath: ValidBackPath;
}

// Custom Header for the settings edit flow
function EditCompaniesHeader({ backPath }: EditCompaniesHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const headerStyles = StyleSheet.create({
    headerContainer: { 
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 50,
      backgroundColor: colors.background, 
    },
    headerTitle: { 
      fontFamily: 'Inter-Bold',
      fontSize: 22, 
      color: colors.text, 
      textAlign: 'center',
    },
    backButton: { 
      padding: 4,
    },
  });

  const backButtonEffectiveWidth = 28 + (headerStyles.backButton.padding * 2);

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }}>
      <View style={headerStyles.headerContainer}>
        <TouchableOpacity onPress={() => router.replace(backPath)} style={headerStyles.backButton}>
          <ChevronLeft color={colors.text} size={28} />
        </TouchableOpacity>
        <Text style={headerStyles.headerTitle}>Edit Favorite Companies</Text>
        <View style={{ width: backButtonEffectiveWidth }} />
      </View>
    </SafeAreaView>
  );
}

export default function SelectCompaniesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, setSigningUp } = useAuth();
  const params = useLocalSearchParams();
  const origin = params.origin as string | undefined;
  const isEditMode = origin === 'settings' || origin === 'portfolio';

  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to access this page.');
      router.replace('/auth');
      return;
    }
    fetchProfile();
  }, [user, router]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('favorite_companies')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Allow no profile row
           console.error('Error fetching profile:', error);
           Alert.alert('Error', 'Could not load your current preferences.');
      } else if (data?.favorite_companies) {
        setSelectedCompanies(data.favorite_companies);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Alert.alert('Error', 'An unexpected error occurred while fetching your preferences.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (ticker: string) => {
    setSelectedCompanies(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    );
  };

  const handleSaveOrFinish = async () => {
    if (!isEditMode && selectedCompanies.length < 3) {
      Alert.alert('Select More', 'Please select at least 3 companies to continue.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to save preferences.');
      router.replace('/auth');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ favorite_companies: selectedCompanies, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      
      if (isEditMode) {
        Alert.alert('Success', 'Favorite companies updated!');
        if (origin === 'portfolio') {
          router.replace('/(tabs)/portfolio');
        } else {
          router.replace('/(tabs)/settings');
        }
      } else {
        setSigningUp(false);
        router.replace('/(tabs)'); 
      }
    } catch (error: any) {
      console.error('Error saving companies:', error);
      Alert.alert('Save Error', error.message || 'Could not save your company preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCompaniesBySearch = searchTerm 
    ? FULL_COMPANY_LIST.filter(company => 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        company.ticker.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20, // Added horizontal padding for screen edges
    },
    contentContainer: { 
        paddingTop: 0, 
        paddingBottom: 20, // Ensure space at the bottom of scroll content
    },
    title: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 10,
      // marginTop: 20, // No longer needed if header is separate
      fontFamily: 'Inter-Bold',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
      fontFamily: 'Inter-Regular',
    },
    searchContainer: { 
        flexDirection: 'row', // Keep for overall structure if needed, but main styling on wrapper
        alignItems: 'center',
        marginBottom: 20,
        // Horizontal padding for the search bar area relative to screen edges is handled by parent style (e.g. styles.container or styles.contentContainer)
    },
    searchInputWrapper: { // New style for the visual search bar
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 12, // Padding inside the wrapper
    },
    searchInput: {
      flex: 1, 
      color: colors.text,
      paddingVertical: 12,
      // Removed paddingHorizontal, borderWidth, borderColor, borderRadius, backgroundColor
      paddingRight: 30, // Space for the clear icon
      fontSize: 16,
      fontFamily: 'Inter-Regular',
    },
    clearSearchButton: {
        padding: 8, // Make touch area slightly larger
        // marginLeft: 8, // Removed, as it's now positioned by the wrapper
        position: 'absolute', // Position it absolutely within the wrapper
        right: 8, // Position to the right
    },
    scrollView: {
      // marginBottom: 20, // Removed, button is outside scrollview
    },
    companyButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      marginRight: 8,
      alignItems: 'center',
    },
    companyText: {
      fontSize: 13,
      fontFamily: 'Inter-Medium',
    },
    companyTicker: {
        fontSize: 11,
        fontFamily: 'Inter-Regular',
        marginTop: 1,
    },
    selectedButton: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    selectedText: {
      color: '#333333',
    },
    unselectedButton: {
      backgroundColor: colors.cardBackground,
    },
    unselectedText: {
      color: colors.text,
    },
    button: {
      backgroundColor: colors.accent,
      padding: 18,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 20, 
    },
    buttonText: {
      color: '#333333',
      fontSize: 18,
      fontWeight: 'bold',
      fontFamily: 'Inter-Bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    sectorContainer: { // New style for each sector block
        marginBottom: 24,
    },
    sectorTitle: {
        fontSize: 20,
        fontFamily: 'Inter-SemiBold',
        color: colors.text,
        marginBottom: 12,
    },
    companiesGrid: { // For the 4 companies in a sector
        flexDirection: 'row',
        flexWrap: 'wrap',
        // justifyContent: 'space-between', // Or 'flex-start'
    },
    companyDetailContainer: {
        alignItems: 'center',
    },
    // Ensure EditCompaniesHeader styles are defined if this is a standalone component.
    // For now, EditCompaniesHeader is defined above and has its own styles.
  });

  // Define style for 'No companies found' text to ensure clarity
  const noCompaniesTextStyle = {
    color: colors.textSecondary, 
    textAlign: 'center' as 'center', // Explicitly type textAlign
    fontFamily: 'Inter-Regular',
    paddingVertical: 20, // Add some padding if it's the only thing shown
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{color: colors.textSecondary, marginTop: 10, fontFamily: 'Inter-Regular'}}>Loading preferences...</Text>
      </View>
    );
  }

  const determineBackPath = (): ValidBackPath => {
    if (origin === 'portfolio') {
      return '/(tabs)/portfolio';
    }
    // Default to settings for 'settings' origin or if undefined (though should always be defined in edit mode)
    return '/(tabs)/settings';
  };

  const renderCompanyItem = (item: { ticker: string; name: string }) => (
    <TouchableOpacity
      key={item.ticker}
      style={[
        styles.companyButton,
        selectedCompanies.includes(item.ticker) ? styles.selectedButton : styles.unselectedButton,
      ]}
      onPress={() => toggleCompany(item.ticker)}
      disabled={saving}
    >
      <View style={styles.companyDetailContainer}>
        <Text style={[ styles.companyText, selectedCompanies.includes(item.ticker) ? styles.selectedText : styles.unselectedText ]}>
          {item.name}
        </Text>
        <Text style={[ styles.companyTicker, selectedCompanies.includes(item.ticker) ? styles.selectedText : { color: colors.textSecondary } ]}>
          ({item.ticker})
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      {isEditMode && <EditCompaniesHeader backPath={determineBackPath()} />}
      <View style={[styles.container, {paddingTop: isEditMode ? 0 : 20}]}>
        {!isEditMode && (
          <>
            <Text style={styles.title}>Favorite Companies</Text>
            <Text style={styles.subtitle}>Select at least 3 companies (tickers) you follow.</Text>
          </>
        )}
        
        <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
                {searchTerm ? (
                    <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearSearchButton}>
                        <ClearIcon size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.contentContainer}>
              {searchTerm ? (
                <View style={styles.companiesGrid}> {/* Use companiesGrid for consistent layout */}
                  {filteredCompaniesBySearch.length > 0 ? (
                    filteredCompaniesBySearch.map(renderCompanyItem)
                  ) : (
                    <Text style={noCompaniesTextStyle}>No companies found.</Text>
                  )}
                </View>
              ) : (
                SECTORS_WITH_COMPANIES.map(sector => (
                  <View key={sector.sectorName} style={styles.sectorContainer}>
                    <Text style={styles.sectorTitle}>{sector.sectorName}</Text>
                    <View style={styles.companiesGrid}>
                      {sector.companies.map(renderCompanyItem)}
                    </View>
                  </View>
                ))
              )}
            </View>
        </ScrollView>
        
        <TouchableOpacity style={styles.button} onPress={handleSaveOrFinish} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#333333" />
          ) : (
            <Text style={styles.buttonText}>
              {isEditMode ? 'Save Changes' : `Finish Setup (${selectedCompanies.length}/3)`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 