import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft } from 'lucide-react-native';

// Custom Header for the settings edit flow
function EditCategoriesHeader() {
  const { colors } = useTheme();
  const router = useRouter();

  // Define styles for this header component directly
  const headerStyles = StyleSheet.create({
    headerContainer: { 
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 50,
      backgroundColor: colors.background, // ensure background color is applied
    },
    headerTitle: { 
      fontFamily: 'Inter-Bold',
      fontSize: 22, 
      marginLeft: 10,
      color: colors.text, // ensure text color is applied
    },
    backButton: { 
      padding: 4,
    },
  });

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }}>
      <View style={headerStyles.headerContainer}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/settings')} style={headerStyles.backButton}>
          <ChevronLeft color={colors.text} size={28} />
        </TouchableOpacity>
        <Text style={headerStyles.headerTitle}>Edit News Categories</Text>
      </View>
    </SafeAreaView>
  );
}

export default function SelectCategoriesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const fromSettings = params.fromSettings === 'true';

  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true); // For loading categories themselves
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchEnumCategories = async () => {
      setCategoriesLoading(true);
      try {
        // Note: Supabase doesn't have a direct JS client method to list enum values easily.
        // We use rpc to call a PostgreSQL function. You'd need to create this function
        // in your Supabase SQL editor, or adjust if you have another way.
        //
        // SQL function to create in Supabase SQL Editor:
        // CREATE OR REPLACE FUNCTION get_enum_values(enum_name text)
        // RETURNS text[] AS $$
        // SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
        // FROM pg_type t
        // JOIN pg_enum e ON t.oid = e.enumtypid
        // JOIN pg_namespace n ON n.oid = t.typnamespace
        // WHERE t.typname = enum_name AND n.nspname = 'public'; -- Assuming public schema
        // $$ LANGUAGE sql IMMUTABLE;
        //
        // If your enum is not in the 'public' schema, adjust n.nspname accordingly.

        const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'categories' });

        if (error) {
          console.error('Error fetching enum categories:', error);
          Alert.alert('Error', 'Could not load categories. Please try again.');
          setAllCategories([]); // Set to empty or some default
        } else if (data) {
          setAllCategories(data);
        }
      } catch (e: any) {
        console.error('Exception fetching enum categories:', e);
        Alert.alert('Error', 'An unexpected error occurred while loading categories.');
        setAllCategories([]);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchEnumCategories();
  }, []);

  // Optional: Fetch existing preferences if user might be re-visiting this screen
  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('news_categories')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: row not found, which is fine for new user
          console.error('Error fetching profile:', error);
          Alert.alert('Error', 'Could not load your current preferences.');
        } else if (data && data.news_categories) {
          setSelectedCategories(data.news_categories);
        }
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleSaveOrNext = async () => {
    if (!fromSettings && selectedCategories.length < 3) {
      Alert.alert('Select More', 'Please select at least 3 news categories to continue.');
      return;
    }
    // If fromSettings is true, we allow saving any number of categories (including 0)

    if (!user) {
      Alert.alert('Error', 'You must be logged in to save preferences.');
      router.replace('/auth');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ news_categories: selectedCategories, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      if (fromSettings) {
        Alert.alert('Success', 'Categories updated!');
        router.replace('/(tabs)/settings'); // Navigate back to settings
      } else {
        router.replace('/select-companies'); // Original navigation
      }
    } catch (error: any) {
      console.error('Error saving categories:', error);
      Alert.alert('Save Error', error.message || 'Could not save your preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Moved the main styles definition here, before it's used by SelectCategoriesScreen
  // but ensuring EditCategoriesHeader has its own or doesn't rely on this instance.
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
      paddingTop: fromSettings ? 20 : 60, // Adjust paddingTop if header is shown
    },
    title: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 10,
      marginTop: 20,
      fontFamily: 'Inter-Bold',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 25,
      fontFamily: 'Inter-Regular',
    },
    scrollView: {
      marginBottom: 20,
    },
    categoryButton: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      marginRight: 10, // For spacing in a row-like wrap if used
      alignItems: 'center',
    },
    categoryText: {
      fontSize: 16,
      fontFamily: 'Inter-Medium',
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
      marginTop: 0,
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
    categoryContainer: { // For a wrap layout if categories are many
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    }
  });

  if (loading || categoriesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{color: colors.textSecondary, marginTop: 10, fontFamily: 'Inter-Regular'}}>
          {categoriesLoading ? 'Loading categories...' : 'Loading preferences...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      {fromSettings && <EditCategoriesHeader />}
      <View style={styles.container}>
        {!fromSettings && (
          <>
            <Text style={styles.title}>News Categories</Text>
            <Text style={styles.subtitle}>Select at least 3 categories you're interested in.</Text>
          </>
        )}
        {fromSettings && (
            <Text style={[styles.subtitle, { marginTop: 10, marginBottom: 20}]}>Select your preferred news categories.</Text>
        )}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.categoryContainer}>
          {allCategories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategories.includes(category) ? styles.selectedButton : styles.unselectedButton,
              ]}
              onPress={() => toggleCategory(category)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategories.includes(category) ? styles.selectedText : styles.unselectedText,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={[styles.button, {marginBottom: fromSettings ? 20 : 0}]} onPress={handleSaveOrNext} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#333333" />
          ) : (
            <Text style={styles.buttonText}>
              {fromSettings ? 'Save Changes' : `Next (${selectedCategories.length}/3)`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
} 