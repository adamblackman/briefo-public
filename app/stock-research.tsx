import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { ChevronLeft, Briefcase, Users, TrendingUp, BadgePercent, Calculator, ShieldCheck, Target, AlertTriangle, Landmark, FlaskConical, PieChart, Gauge, GitMerge, Truck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { DeepResearchReport, ResearchCriterion, ReportStatus } from '@/types/research';
import Markdown from 'react-native-markdown-display';

export default function StockResearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol: string; name: string }>();
  const { symbol, name } = params;
  const { user } = useAuth(); // Get user from auth context

  // State for the fetched report record and screen loading status
  const [currentReport, setCurrentReport] = React.useState<DeepResearchReport | null>(null);
  const [isFetchingStatus, setIsFetchingStatus] = React.useState<boolean>(true);
  
  // State for the submission process of a new report
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Updated criteria selection list
  const criteriaOptions = [
    'Management',         // 1
    'Competitors',        // 2
    'Outlook',            // 3 - Renamed
    'Risks',              // 4
    'Margins',            // 5
    'Valuation',          // 6
    'Capital Structure',  // 7
    'Research & Development', // 8
    'Revenue Breakdown',  // 9
    'Productivity Metrics', // 10
    'M&A Activity',       // 11
    'Supply Chain',       // 12
  ];
  const [selectedCriteria, setSelectedCriteria] = React.useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = React.useState<string>('');

  // Effect to fetch the latest report status for this stock and user
  React.useEffect(() => {
    const fetchLatestReport = async () => {
      if (!user || !symbol) {
        setIsFetchingStatus(false);
        setCurrentReport(null); // Ensure no stale report if user/symbol changes
        return;
      }

      setIsFetchingStatus(true);
      try {
        const { data, error } = await supabase
          .from('deep_research_reports')
          .select('*')
          .eq('user_id', user.id)
          .eq('ticker', symbol)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching report status:', error);
          setCurrentReport(null);
        } else if (data && data.length > 0) {
          setCurrentReport(data[0] as DeepResearchReport);
        } else {
          setCurrentReport(null); // No report found for this user/ticker
        }
      } catch (e) {
        console.error('Exception fetching report status:', e);
        setCurrentReport(null);
      } finally {
        setIsFetchingStatus(false);
      }
    };

    fetchLatestReport();
  }, [user, symbol]); // Rerun if user or symbol changes

  // Map criteria to icons
  const criteriaIcons: { [key: string]: React.ComponentType<any> } = {
    'Management': Briefcase,
    'Competitors': Users,
    'Outlook': TrendingUp, // Renamed & Reusing TrendingUp
    'Risks': AlertTriangle,
    'Margins': BadgePercent, // Renamed from Profit Margins
    'Valuation': Calculator, // Renamed from Valuation (P/E, P/S)
    'Capital Structure': Landmark,
    'Research & Development': FlaskConical,
    'Revenue Breakdown': PieChart,
    'Productivity Metrics': Gauge,
    'M&A Activity': GitMerge,
    'Supply Chain': Truck,
    // Kept ShieldCheck and Target just in case old names linger, can be removed later
    'Moat/Competitive Advantage': ShieldCheck,
    'Future Growth Prospects': Target,
  };

  const handleGenerateReport = async () => {
    if (!user || !symbol || selectedCriteria.length === 0) {
      console.warn('User, symbol, or criteria missing, cannot generate report request.');
      // Optionally, show an alert to the user
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare the data for insertion
      // Map string criteria back to the ResearchCriterion enum type if needed,
      // or ensure the strings match the enum values directly.
      const criteriaToInsert: ResearchCriterion[] = selectedCriteria.map(displayName => {
        // This mapping assumes your display names can be converted to enum keys
        // e.g., "Management" -> MANAGEMENT, "Research & Development" -> RESEARCH_DEVELOPMENT
        // This requires careful matching of the display names to the enum key patterns.
        const key = displayName.toUpperCase().replace(/ & /g, "_HYPHEN_").replace(/ /g, '_').replace(/\//g, '_').replace(/\(/g, '_').replace(/\)/g, '').replace(/-/g, '_').replace(/_HYPHEN_/g, '&');
        // A more robust approach if names differ significantly is a direct map object:
        // const directMap: { [key: string]: ResearchCriterion } = {
        //   'Management': ResearchCriterion.MANAGEMENT,
        //   'Competitors': ResearchCriterion.COMPETITORS,
        //   'Outlook': ResearchCriterion.OUTLOOK,
        //   'Risks': ResearchCriterion.RISKS,
        //   'Margins': ResearchCriterion.MARGINS,
        //   'Valuation': ResearchCriterion.VALUATION,
        //   'Capital Structure': ResearchCriterion.CAPITAL_STRUCTURE,
        //   'Research & Development': ResearchCriterion.RESEARCH_DEVELOPMENT,
        //   'Revenue Breakdown': ResearchCriterion.REVENUE_BREAKDOWN,
        //   'Productivity Metrics': ResearchCriterion.PRODUCTIVITY_METRICS,
        //   'M&A Activity': ResearchCriterion.MA_ACTIVITY,
        //   'Supply Chain': ResearchCriterion.SUPPLY_CHAIN,
        // };
        // return directMap[displayName];

        // For now, let's use a direct mapping for clarity and robustness given the current criteria names
        switch (displayName) {
          case 'Management': return ResearchCriterion.MANAGEMENT;
          case 'Competitors': return ResearchCriterion.COMPETITORS;
          case 'Outlook': return ResearchCriterion.OUTLOOK;
          case 'Risks': return ResearchCriterion.RISKS;
          case 'Margins': return ResearchCriterion.MARGINS;
          case 'Valuation': return ResearchCriterion.VALUATION;
          case 'Capital Structure': return ResearchCriterion.CAPITAL_STRUCTURE;
          case 'Research & Development': return ResearchCriterion.RESEARCH_DEVELOPMENT;
          case 'Revenue Breakdown': return ResearchCriterion.REVENUE_BREAKDOWN;
          case 'Productivity Metrics': return ResearchCriterion.PRODUCTIVITY_METRICS;
          case 'M&A Activity': return ResearchCriterion.MA_ACTIVITY;
          case 'Supply Chain': return ResearchCriterion.SUPPLY_CHAIN;
          default: 
            console.warn(`Unknown criteria display name: ${displayName}`);
            return displayName as any; // Fallback, but should not happen if criteriaOptions is source of truth
        }
      }).filter(Boolean); // Filter out any undefined values if default case was hit and returned nothing
      
      const reportRequest: Omit<DeepResearchReport, 'id' | 'created_at' | 'updated_at' | 'report'> = {
        user_id: user.id,
        ticker: symbol,
        criteria: criteriaToInsert,
        additional_notes: additionalNotes.trim() || null, // Store trimmed notes or null if empty
        status: ReportStatus.PENDING, // Explicitly set status
      };

      // Insert into Supabase
      const { data, error } = await supabase
        .from('deep_research_reports')
        .insert([reportRequest]) // insert expects an array
        .select(); // Optionally select the inserted row back

      if (error) {
        console.error('Error inserting report request:', error);
        // Handle specific errors, e.g., the unique constraint violation
        if (error.code === '23505') { // Postgres code for unique_violation
           alert('You already have a pending or generating report for this stock.');
        } else {
           alert(`Failed to submit report request: ${error.message}`);
        }
        throw error; // Re-throw to be caught by the outer catch if needed
      }

      // Update the current report state to show the pending UI immediately
      if (data && data.length > 0) {
        const newReport = data[0] as DeepResearchReport;
        setCurrentReport(newReport);

        // Invoke the edge function asynchronously
        // We don't await the function's completion here, just trigger it.
        supabase.functions.invoke('perplexity-research', {
          body: { reportId: newReport.id } // Pass reportId in the body
        })
        .then(({ data: invokeData, error: invokeError }) => {
          if (invokeError) {
            console.error('Error invoking perplexity-research function:', invokeError);
            // Optional: Show an alert to the user that triggering failed
            // The record is still in the DB with PENDING status, might need manual trigger or retry logic later.
             alert(`Failed to start report generation process: ${invokeError.message}. Please try again later or contact support.`);
             // Optionally revert the UI state if needed, though PENDING is technically correct
             // setCurrentReport(null); // Or revert to previous state
          } else {
            console.log('Perplexity research function invoked successfully:', invokeData);
            // UI is already showing PENDING/GENERATING based on setCurrentReport above
          }
        });
      }

      // ~~TODO: Optionally trigger the edge function immediately here,~~ Done above
      // or rely on a backend trigger/listener.

    } catch (err) {
      // Error already logged or alerted inside the try block
      console.error('Caught error during report request submission:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCriteria = (criteria: string) => {
    setSelectedCriteria(prev =>
      prev.includes(criteria)
        ? prev.filter(item => item !== criteria)
        : [...prev, criteria]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {name || symbol || 'Stock'} Research Report
          </Text>
        </View>
        <View style={{ width: 28 }} /> {/* Spacer to balance header */}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {isFetchingStatus ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading research details...</Text>
          </View>
        ) : currentReport && (currentReport.status === ReportStatus.PENDING || currentReport.status === ReportStatus.GENERATING) ? (
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.generatingText, { color: colors.text }]}>Generating Report</Text>
            <Text style={[styles.generatingSubText, { color: colors.textSecondary }]}>
              Your detailed research report is being prepared.
            </Text>
            <Text style={[styles.generatingSubText, { color: colors.textSecondary }]}>
              Please check back in a few minutes.
            </Text>
          </View>
        ) : currentReport && currentReport.status === ReportStatus.COMPLETED && currentReport.report ? (
          <Markdown style={markdownStyles(colors)}>
              {currentReport.report.replace(/\s?\[\d+\]/g, '')}
          </Markdown>
        ) : (
          <View style={styles.criteriaSelectionContainer}>
            <Text style={[styles.criteriaTitle, { color: colors.text }]}>Select Research Criteria:</Text>
            <View style={styles.criteriaButtonsWrapper}>
              {criteriaOptions.map(option => {
                const isSelected = selectedCriteria.includes(option);
                const IconComponent = criteriaIcons[option];
                const iconColor = isSelected ? colors.accent : colors.textSecondary;
                const textColor = isSelected ? colors.accent : colors.text;

                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.criteriaButton,
                      { backgroundColor: isSelected ? colors.accent + '20' : colors.cardBackground }, // Lighter accent background
                      { borderColor: isSelected ? colors.accent : colors.border }
                    ]}
                    onPress={() => toggleCriteria(option)}
                  >
                    {IconComponent && <IconComponent size={18} color={iconColor} />}
                    <Text style={[styles.criteriaText, { color: textColor }]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Additional Notes Text Input */}
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: colors.cardBackground, 
                color: colors.text, 
                borderColor: colors.border 
              }]}
              placeholder="Anything else?"
              placeholderTextColor={colors.textSecondary}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              multiline={true} // Allow multiple lines
            />

            <TouchableOpacity
              style={[
                styles.generateButton, 
                { backgroundColor: selectedCriteria.length > 0 ? colors.accent : colors.cardBackground },
                { opacity: selectedCriteria.length === 0 || isSubmitting ? 0.6 : 1 }
              ]}
              onPress={handleGenerateReport}
              disabled={selectedCriteria.length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.background} style={{ marginRight: 8 }}/>
              ) : null}
              <Text style={[styles.generateButtonText, { 
                color: selectedCriteria.length > 0 ? colors.background : colors.textSecondary
              }]}>
                Generate Report
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    paddingTop: 70, // Adjust as needed for safe area
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center', // Center title
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  reportContainer: {
    padding: 16,
    borderRadius: 12,
  },
  reportText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  criteriaSelectionContainer: {
    alignItems: 'center',
    width: '100%', // Ensure it takes full width for alignment
  },
  criteriaTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    marginBottom: 16,
    alignSelf: 'flex-start', // Align title to the left
  },
  criteriaButtonsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  criteriaButton: {
    width: '48%', // Adjust width for two columns
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center', // Keep content centered horizontally inside button
    flexDirection: 'row', // Layout icon and text horizontally
    justifyContent: 'flex-start', // Start content from left
  },
  criteriaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginLeft: 12, // Increased space between icon and text
    flexShrink: 1, // Allow text to wrap if needed
  },
  generateButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    width: '80%', // Adjust width as needed
  },
  generateButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  textInput: {
    width: '100%',
    height: 160, // Doubled fixed height, removed minHeight
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 20, // Space above text input
    marginBottom: 10, // Space below text input
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlignVertical: 'top', // Align text to top for multiline
  },
  loadingText: {
    marginTop: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  generatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 300, // Ensure it takes up some space
  },
  generatingText: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  generatingSubText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 6,
  },
});

// Define styles for the Markdown component
const markdownStyles = (colors: any) => StyleSheet.create({
    // Override basic text style
    body: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 24,
        fontFamily: 'Inter-Regular',
    },
    // Heading Styles
    heading1: {
        color: colors.text,
        fontFamily: 'Inter-Bold',
        fontSize: 24,
        marginTop: 16,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 6,
    },
    heading2: {
        color: colors.text,
        fontFamily: 'Inter-Bold',
        fontSize: 20,
        marginTop: 14,
        marginBottom: 8,
    },
    heading3: {
        color: colors.text,
        fontFamily: 'Inter-SemiBold', // Use SemiBold for h3 if available
        fontSize: 18,
        marginTop: 12,
        marginBottom: 6,
    },
    // Add styles for other elements as needed (e.g., lists, blockquotes)
    hr: {
      backgroundColor: colors.border + '80', // Lighter gray using alpha
      height: 2, // Thicker line
      marginTop: 16,
      marginBottom: 16,
    },
    // Table styles
    table: {
        borderWidth: 2, // Thicker border
        borderColor: colors.border + '80', // Lighter gray using alpha
        borderRadius: 4,
        marginBottom: 16,
    },
    thead: {
        // Optional: Add background or different border for header
    },
    tbody: {
        // Optional: Add styles for table body
    },
    th: { // Table Header cell
        borderColor: colors.border + '80', // Lighter gray using alpha
        borderWidth: 1, // Thicker border
        padding: 8,
        fontWeight: 'bold', // Use bold font for headers
    },
    td: { // Table Data cell
        borderColor: colors.border + '80', // Lighter gray using alpha
        borderWidth: 1, // Thicker border
        padding: 8,
        color: colors.text,
    },
    tr: { // Table Row
        // Optional: Add styles for rows if needed, e.g., alternating background
        borderBottomWidth: 0, // Usually handled by cell borders
    },
    bullet_list: {
        marginBottom: 10,
    },
    list_item: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    // You can customize the bullet appearance here if needed
}); 