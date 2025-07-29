import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TouchableWithoutFeedback, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ListFilter, CheckSquare, Square, X as XIcon, Search } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import React, { useState, useEffect } from 'react';

export interface NewsHeaderProps {
  userCategories: string[];
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  onShowFavorites: () => void;
  searchQuery: string;
  onSearchChange: (text: string) => void;
}

export default function NewsHeader({ 
  userCategories, 
  selectedCategories, 
  onToggleCategory, 
  onShowFavorites,
  searchQuery,
  onSearchChange
}: NewsHeaderProps) {
  const { colors } = useTheme();
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [tempSelectedCategories, setTempSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    setTempSelectedCategories([...selectedCategories]);
  }, [isDropdownVisible]);

  useEffect(() => {
    const fetchEnumCategories = async () => {
      try {
        const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'categories' });
        if (error) {
          console.error('Error fetching enum categories:', error);
          setAllCategories([]);
        } else if (data) {
          setAllCategories(data.sort());
        }
      } catch (e: any) {
        console.error('Exception fetching enum categories:', e);
        setAllCategories([]);
      }
    };
    fetchEnumCategories();
  }, []);
  
  const handleToggleDropdownCategory = (category: string) => {
    // Update temporary selection without triggering the parent component
    setTempSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(cat => cat !== category)
        : [...prev, category]
    );
  };

  const handleCloseDropdown = () => {
    // Apply changes only when closing the dropdown
    tempSelectedCategories.forEach(category => {
      if (!selectedCategories.includes(category)) {
        onToggleCategory(category);
      }
    });
    
    selectedCategories.forEach(category => {
      if (!tempSelectedCategories.includes(category)) {
        onToggleCategory(category);
      }
    });
    
    setIsDropdownVisible(false);
  };

  const handleShowFavoritesPress = () => {
    setTempSelectedCategories([...userCategories]);
  };

  const isFavoritesSelected = () => {
    if (!userCategories || userCategories.length === 0) return false; // No user categories to be favorites
    if (userCategories.length !== tempSelectedCategories.length) return false;
    const sortedUserCategories = [...userCategories].sort();
    const sortedSelectedCategories = [...tempSelectedCategories].sort();
    return sortedUserCategories.every((cat, index) => cat === sortedSelectedCategories[index]);
  };

  const renderCategoryItem = ({ item }: { item: string }) => {
    const isSelected = tempSelectedCategories.includes(item);
    return (
      <TouchableOpacity
        style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
        onPress={() => handleToggleDropdownCategory(item)}
      >
        <View style={styles.categoryItemContainer}>
          {isSelected ? (
            <CheckSquare color={colors.accent} size={18} style={styles.checkboxIcon} />
          ) : (
            <Square color={colors.textSecondary} size={18} style={styles.checkboxIcon} />
          )}
          <Text style={{ color: isSelected ? colors.accent : colors.text, flexShrink: 1 }}>{item}</Text>
        </View>
      </TouchableOpacity>
    );
  };

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
          <Search color={colors.textSecondary} size={18} style={styles.searchIcon} />
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
        
        <TouchableOpacity onPress={() => setIsDropdownVisible(!isDropdownVisible)}>
          <View style={[styles.filterIcon, { backgroundColor: colors.cardBackground }]}>
            {!isDropdownVisible && (
              <ListFilter color={colors.text} size={20} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        transparent={true}
        visible={isDropdownVisible}
        onRequestClose={handleCloseDropdown}
      >
        <View style={styles.modalOverlay}>
          {/* Invisible backdrop to handle background taps */}
          <TouchableWithoutFeedback onPress={handleCloseDropdown}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          
          {/* X icon positioned to align with dropdown */}
          <TouchableOpacity 
            style={styles.closeIconContainer}
            onPress={handleCloseDropdown}
          >
            <View style={[styles.filterIcon, { backgroundColor: colors.cardBackground }]}>
              <XIcon color={colors.text} size={20} />
            </View>
          </TouchableOpacity>

          <View style={[styles.dropdown, { backgroundColor: colors.cardBackground }]}>
            <TouchableOpacity 
              style={[styles.dropdownItem, styles.favoritesButton, { borderBottomColor: colors.border }]}
              onPress={handleShowFavoritesPress}
            >
              <View style={styles.categoryItemContainer}> 
                {isFavoritesSelected() ? (
                  <CheckSquare color={colors.accent} size={18} style={styles.checkboxIcon} />
                ) : (
                  <Square color={colors.textSecondary} size={18} style={styles.checkboxIcon} />
                )}
                <Text style={[styles.favoritesText, { color: isFavoritesSelected() ? colors.accent : colors.text }]}>Favorites</Text>
              </View>
            </TouchableOpacity>
            <FlatList
              data={allCategories}
              keyExtractor={(item) => item}
              renderItem={renderCategoryItem}
            />
          </View>
        </View>
      </Modal>
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
  filterIcon: {
    padding: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    paddingTop: 70,
    paddingRight: 60,
  },
  closeIconContainer: {
    position: 'absolute',
    top: 70,
    right: 16,
    zIndex: 3,
  },
  dropdown: {
    width: 200,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 2,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  categoryItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxIcon: {
    marginRight: 10,
  },
  favoritesButton: {
  },
  favoritesText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1,
  },
});