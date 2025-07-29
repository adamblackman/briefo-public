import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { CirclePlus as PlusCircle, Search as SearchIcon, X as XIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';

export interface PortfolioHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
}

export default function PortfolioHeader({ searchQuery, onSearchChange }: PortfolioHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  
  return (
    <SafeAreaView style={{ backgroundColor: colors.background }}>
      <View style={styles.headerContainer}>
        <View>
          <Image 
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <View style={[styles.searchInputContainer, { backgroundColor: colors.cardBackground }]}>
          <SearchIcon color={colors.textSecondary} size={18} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => onSearchChange('')}
              style={styles.clearButton}
            >
              <XIcon color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity 
          onPress={() => router.push({ pathname: '/select-companies', params: { origin: 'portfolio' } })}
        >
          <View style={[styles.addIconContainer, { backgroundColor: colors.cardBackground }]}>
            <PlusCircle color={colors.text} size={20} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
  },
  logo: {
    width: 100,
    height: 40,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 40,
    marginLeft: 5,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
  },
  clearButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconContainer: {
    padding: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
});