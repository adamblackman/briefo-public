import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Bell, ChevronRight, Lock, LogOut, Edit3, List, Building2, User, AtSign } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useState, ReactNode, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { getUserProfile, updateUserBio, updateUserName, updateUserUsername } from '@/lib/profileUtils';
import EditProfileModal from './EditProfileModal';

// Define interfaces for settings items
interface BaseSettingItem {
  icon: ReactNode;
  title: string;
  hasSwitch: boolean;
}

interface SwitchSettingItem extends BaseSettingItem {
  hasSwitch: true;
  value: boolean;
  onToggle: (value: boolean) => void;
  subtitle?: string;
}

interface RegularSettingItem extends BaseSettingItem {
  hasSwitch: false;
  subtitle?: string;
  itemKey?: 'name' | 'username' | 'bio' | string;
  onPress?: () => void;
}

type SettingItem = SwitchSettingItem | RegularSettingItem;

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export default function ProfileSettings() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  const [name, setName] = useState("Loading...");
  const [username, setUsername] = useState("Loading...");
  const [bio, setBio] = useState("Loading...");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingFieldKey, setEditingFieldKey] = useState<'name' | 'username' | 'bio' | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingLabel, setEditingLabel] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (user && user.id) {
        setIsLoadingProfile(true);
        setProfileError(null);
        try {
          const { success, data, error } = await getUserProfile(user.id);
          if (success && data) {
            setName(data.name || 'N/A');
            setUsername(data.username || 'N/A');
            setBio(data.bio || 'N/A');
          } else {
            console.error('Failed to fetch profile:', error);
            setProfileError('Failed to load profile.');
            setName('Error');
            setUsername('Error');
            setBio('Error');
          }
        } catch (e) {
          console.error('Exception fetching profile:', e);
          setProfileError('An unexpected error occurred.');
          setName('Error');
          setUsername('Error');
          setBio('Error');
        }
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleEditPress = (field: 'name' | 'username' | 'bio', currentValue: string, label: string) => {
    setEditingFieldKey(field);
    setEditingValue(currentValue === 'Loading...' || currentValue === 'Error' || currentValue === 'N/A' ? '' : currentValue);
    setEditingLabel(label);
    setIsModalVisible(true);
  };

  const handleSaveEdit = async (newValue: string) => {
    if (!editingFieldKey || !user?.id) return;

    let updateFunction;
    let processedNewValue = newValue;

    switch (editingFieldKey) {
      case 'name':
        updateFunction = updateUserName;
        break;
      case 'username':
        updateFunction = updateUserUsername;
        break;
      case 'bio':
        updateFunction = updateUserBio;
        break;
      default:
        return;
    }

    try {
      const { success, error } = await updateFunction(user.id, processedNewValue);
      if (success) {
        // Update local state optimistically or re-fetch
        if (editingFieldKey === 'name') setName(processedNewValue);
        else if (editingFieldKey === 'username') setUsername(processedNewValue);
        else if (editingFieldKey === 'bio') setBio(processedNewValue);
        setIsModalVisible(false);
      } else {
        throw error || new Error('Update failed');
      }
    } catch (e: any) {
      console.error(`Error updating ${editingFieldKey}:`, e);
      Alert.alert("Error", e.message || `Failed to update ${editingFieldKey}.`);
      // Re-throw to keep modal open and show error there, or handle error display in modal
      throw e;
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Log Out",
          onPress: async () => {
            try {
              await logout();
              router.replace('/auth');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
          style: "destructive"
        }
      ],
      { cancelable: false }
    );
  };
  
  const settingsSections: SettingSection[] = [
    {
      title: 'Profile',
      items: [
        {
          icon: <User size={20} color={colors.accent} />,
          title: '',
          hasSwitch: false,
          subtitle: name,
          itemKey: 'name',
          onPress: () => handleEditPress('name', name, 'Edit Name'),
        },
        {
          icon: <AtSign size={20} color={colors.accent} />,
          title: '',
          hasSwitch: false,
          subtitle: username,
          itemKey: 'username',
          onPress: () => handleEditPress('username', username, 'Edit Username'),
        },
        {
          icon: <Edit3 size={20} color={colors.accent} />,
          title: '',
          hasSwitch: false,
          subtitle: bio,
          itemKey: 'bio',
          onPress: () => handleEditPress('bio', bio, 'Edit Bio'),
        },
      ]
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: <List size={20} color={colors.accent} />,
          title: 'News Categories',
          hasSwitch: false,
          onPress: () => router.push({ pathname: '/select-categories', params: { fromSettings: 'true' } }),
        },
        {
          icon: <Building2 size={20} color={colors.accent} />,
          title: 'Favorite Companies',
          hasSwitch: false,
          onPress: () => router.push({ pathname: '/select-companies', params: { origin: 'settings' } }),
        },
        {
          icon: <Bell size={20} color={colors.accent} />,
          title: 'Notifications',
          hasSwitch: true,
          value: notificationsEnabled,
          onToggle: setNotificationsEnabled,
        },
      ]
    },
    {
      title: 'Privacy & Security',
      items: [
        {
          icon: <Lock size={20} color={colors.accent} />,
          title: 'Privacy Settings',
          hasSwitch: false,
        },
      ]
    }
  ];
  
  return (
    <Animated.View 
      entering={FadeIn.duration(300).delay(200)}
      style={[styles.card, { backgroundColor: colors.cardBackground }]}
    >
      
      {settingsSections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary }]}>
            {section.title}
          </Text>
          
          {section.items.map((item, itemIndex) => {
            const isPressable = 'onPress' in item && !!(item as RegularSettingItem).onPress && !item.hasSwitch;
            const ItemWrapper = isPressable ? TouchableOpacity : View;
            const { key, ...restItemProps } = {
              key: itemIndex,
              style: [
                styles.settingItem,
                { borderBottomColor: colors.border },
                itemIndex === section.items.length - 1 && { borderBottomWidth: 0 }
              ],
              ...(isPressable && { onPress: (item as RegularSettingItem).onPress, activeOpacity: 0.7 }),
            };

            return (
              <ItemWrapper key={key} {...restItemProps}>
                <View style={styles.settingLeft}>
                  {item.icon}
                  <View style={styles.settingTextContainer}>
                    {item.title ? (
                      <>
                        <Text style={[styles.settingTitle, { color: colors.text }]}>
                          {item.title}
                        </Text>
                        {item.subtitle && (
                          <Text style={[
                            (item as RegularSettingItem).itemKey === 'bio' ? styles.profileBioText : styles.settingSubtitle,
                            { color: colors.textSecondary },
                            (item as RegularSettingItem).itemKey === 'bio' && item.subtitle === 'N/A' && { color: colors.textPlaceholder, fontStyle: 'italic' }
                          ]}>
                            {(item as RegularSettingItem).itemKey === 'bio' && item.subtitle === 'N/A' ? 'Write a bio here...' : item.subtitle}
                          </Text>
                        )}
                      </>
                    ) : (
                      item.subtitle && (
                        <Text style={[
                          (item as RegularSettingItem).itemKey === 'bio' ? styles.profileBioText : styles.settingTitle,
                          { color: colors.text },
                          (item as RegularSettingItem).itemKey === 'bio' && item.subtitle === 'N/A' && { color: colors.textPlaceholder, fontStyle: 'italic' }
                        ]}>
                          {(item as RegularSettingItem).itemKey === 'bio' && item.subtitle === 'N/A' ? 'Write a bio here...' : item.subtitle}
                        </Text>
                      )
                    )}
                  </View>
                </View>
                
                {item.hasSwitch ? (
                  <Switch
                    value={(item as SwitchSettingItem).value}
                    onValueChange={(item as SwitchSettingItem).onToggle}
                    trackColor={{ false: colors.backgroundSecondary, true: colors.accent }}
                    thumbColor="white"
                  />
                ) : 'onPress' in item && (item as RegularSettingItem).onPress ? (
                  <ChevronRight size={20} color={colors.textSecondary} />
                ) : item.title ? (
                  !(item as RegularSettingItem).itemKey && <ChevronRight size={20} color={colors.textSecondary} />
                ) : null}
              </ItemWrapper>
            );
          })}
        </View>
      ))}
      
      <TouchableOpacity 
        style={[
          styles.logoutButton, 
          { 
            borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary
          }
        ]}
        onPress={handleLogout}
      >
        <LogOut size={18} color={colors.negative} />
        <Text style={[styles.logoutText, { color: colors.negative }]}>
          Log Out
        </Text>
      </TouchableOpacity>

      {editingFieldKey && (
        <EditProfileModal
          visible={isModalVisible}
          label={editingLabel}
          initialValue={editingValue}
          fieldKey={editingFieldKey}
          onClose={() => setIsModalVisible(false)}
          onSave={handleSaveEdit}
          inputProps={editingFieldKey === 'bio' ? { multiline: true, numberOfLines: 4 } : {}}
        />
      )}
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
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
  profileBioText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  settingSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 0,
  },
  logoutText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginLeft: 8,
  },
});