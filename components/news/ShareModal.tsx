import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Dimensions, ActivityIndicator, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Article } from '@/types/news'; // Assuming you have this type
import { useTheme } from '@/context/ThemeContext'; // Assuming you have a ThemeContext
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

type Profile = {
  user_id: string;
  profile_picture_url?: string | null;
  name?: string | null;
  friendship_id?: string;
};

type ShareModalProps = {
  isVisible: boolean;
  onClose: () => void;
  article: Article;
};

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 4;
const ITEM_MARGIN = 12;
const ITEM_SIZE = (width - (NUM_COLUMNS + 1) * ITEM_MARGIN) / NUM_COLUMNS;

export default function ShareModal({ isVisible, onClose, article }: ShareModalProps) {
  const { colors } = useTheme();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [currentAuthUid, setCurrentAuthUid] = useState<string | null>(null);
  const [currentUserProfileTableId, setCurrentUserProfileTableId] = useState<string | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<Profile[]>([]);
  const [customMessage, setCustomMessage] = useState('');

  // Helper function to get initials from name
  const getInitials = (name: string): string => {
    if (!name) return '?';
    
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  };

  useEffect(() => {
    const getCurrentUserProfileData = async () => {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          setCurrentAuthUid(null);
          setCurrentUserProfileTableId(null);
          return;
        }
        setCurrentAuthUid(authUser.id);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, user_id')
          .eq('user_id', authUser.id)
          .single();

        if (profileError) {
          setCurrentUserProfileTableId(null);
          return;
        }

        if (profileData) {
          setCurrentUserProfileTableId(profileData.id);
        } else {
          setCurrentUserProfileTableId(null);
        }
      } catch (error: any) {
        setCurrentAuthUid(null);
        setCurrentUserProfileTableId(null);
      }
    };

    getCurrentUserProfileData();
  }, []);

  useEffect(() => {
    if (!isVisible || !currentAuthUid) {
      setFriends([]);
      setSelectedFriends([]);
      setCustomMessage('');
      return;
    }

    const fetchFriends = async () => {
      setLoading(true);
      try {
        const { data: friendRelations, error: friendError } = await supabase
          .from('friends')
          .select('id, requester_id, recipient_id')
          .eq('status', 'accepted')
          .or(`requester_id.eq.${currentAuthUid},recipient_id.eq.${currentAuthUid}`);

        if (friendError) throw friendError;
        if (!friendRelations || friendRelations.length === 0) {
          setFriends([]);
          setLoading(false);
          return;
        }

        const friendUserIdToFriendshipIdMap: { [key: string]: string } = {};
        const friendUserIds = friendRelations.map(relation => {
          const friendUserId = relation.requester_id === currentAuthUid ? relation.recipient_id : relation.requester_id;
          if (friendUserId && relation.id) {
            friendUserIdToFriendshipIdMap[friendUserId] = relation.id; 
          }
          return friendUserId;
        }).filter(id => id) as string[];
        
        if (friendUserIds.length === 0) {
          setFriends([]);
          setLoading(false);
          return;
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, profile_picture_url, name')
          .in('user_id', friendUserIds);

        if (profilesError) throw profilesError;
        
        const mergedFriends = (profilesData || []).map(profile => ({
          ...profile,
          friendship_id: friendUserIdToFriendshipIdMap[profile.user_id]
        }));        
        setFriends(mergedFriends);
      } catch (err: any) {
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [isVisible, currentAuthUid, article.id]);

  const handleToggleFriendSelection = (friend: Profile) => {
    setSelectedFriends(prev => 
      prev.some(sf => sf.user_id === friend.user_id) 
        ? prev.filter(sf => sf.user_id !== friend.user_id) 
        : [...prev, friend]
    );
  };

  const handleConfirmSend = async () => {
    if (selectedFriends.length === 0 || !currentUserProfileTableId || isSending) {
      return;
    }

    setIsSending(true);
    try {
      // 1. Send the article message(s)
      const articleMessagesToSend = selectedFriends.map(friend => {
        if (!friend.friendship_id) {
          return null;
        }
        return {
          friendship_id: friend.friendship_id,
          sender_id: currentUserProfileTableId,
          content: article.title,
          message_type: 'article',
          reference_id: article.id,
          article_image_url: article.cover_image_url || null,
        };
      }).filter(msg => msg !== null);

      if (articleMessagesToSend.length > 0) {
        const { error: articleError } = await supabase.from('messages').insert(articleMessagesToSend as any);
        if (articleError) {
          console.error('[ShareModal] Error sending article messages:', articleError.message);
          // Optionally, decide if you want to stop here or still try to send the custom message
          // For now, we'll stop if the primary action (sharing article) fails.
          setIsSending(false);
          return;
        }
      }

      // 2. Send the custom text message(s) if present
      const trimmedMessage = customMessage.trim();
      if (trimmedMessage) {
        const textMessagesToSend = selectedFriends.map(friend => {
          if (!friend.friendship_id) {
            return null;
          }
          return {
            friendship_id: friend.friendship_id,
            sender_id: currentUserProfileTableId,
            content: trimmedMessage,
            message_type: 'text',
            // No reference_id or article_image_url for plain text messages
          };
        }).filter(msg => msg !== null);

        if (textMessagesToSend.length > 0) {
          const { error: textError } = await supabase.from('messages').insert(textMessagesToSend as any);
          if (textError) {
            console.error('[ShareModal] Error sending custom text messages:', textError.message);
            // Even if text message fails, the article might have been sent.
            // The modal will close, and user might need to be notified differently if this part fails.
          }
        }
      }

      // If all successful (or article sent and no custom message, or article sent and custom message failed but we proceed)
      setCustomMessage(''); // Clear message on successful send or after attempt
      onClose();

    } catch (err: any) {
      console.error('[ShareModal] Exception during send operation:', err.message);
    } finally {
      setIsSending(false);
    }
  };

  // Conditional rendering for animations to work correctly on mount/unmount
  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      animationType="none" // Changed from "slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      {/* Fading Overlay */}
      <Animated.View
        style={styles.fadingOverlay}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill} // Make touchable cover entire overlay
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Sliding Content Area */}
      <Animated.View
        style={styles.slidingContentWrapper}
        entering={SlideInDown.duration(300)}
        exiting={SlideOutDown.duration(300)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerText, { color: colors.text, marginLeft: 8 }]}>Share with Friends</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} disabled={isSending}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content (Loading/Empty/FlatList) */}
          {loading ? (
            <View style={styles.centeredMessageContainer}>
              <Text style={{ color: colors.textSecondary }}>Loading friends...</Text>
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.centeredMessageContainer}>
              <Text style={{ color: colors.textSecondary }}>No friends found to share with.</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              renderItem={({ item }) => {
                const isSelected = selectedFriends.some(sf => sf.user_id === item.user_id);
                return (
                  <TouchableOpacity 
                    style={[
                      styles.friendItem,
                      { 
                        width: ITEM_SIZE * 0.8,
                        height: ITEM_SIZE * 0.8,
                        margin: ITEM_MARGIN,
                      },
                      isSelected && { borderColor: colors.accent, borderWidth: 3 }
                    ]}
                    onPress={() => handleToggleFriendSelection(item)}
                    disabled={isSending}
                  >
                    {item.profile_picture_url ? (
                      <Image source={{ uri: item.profile_picture_url }} style={styles.profileImage} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
                        <Text style={{color: '#333333', fontSize: ITEM_SIZE / 4}}>
                          {getInitials(item.name || item.user_id)}
                        </Text>
                      </View>
                    )}
                    {isSelected && (
                      <View style={[
                        styles.selectionIndicatorBase,
                        { backgroundColor: colors.accent }
                      ]}>
                        <Text style={styles.selectionIndicatorText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.user_id}
              numColumns={NUM_COLUMNS}
              contentContainerStyle={styles.listContentContainer}
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1, maxHeight: '70%' }}
            />
          )}
          
          {/* Custom Message Input */}
          {!loading && friends.length > 0 && (
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                placeholder="Add a message..."
                placeholderTextColor={colors.textSecondary}
                value={customMessage}
                onChangeText={setCustomMessage}
                editable={!isSending}
                multiline
              />
            </View>
          )}

          {/* Send Button */}
          {!loading && friends.length > 0 && (
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: selectedFriends.length > 0 && !isSending ? colors.accent : colors.border },
              ]}
              disabled={selectedFriends.length === 0 || isSending}
              onPress={handleConfirmSend}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={[styles.sendButtonText, {color: selectedFriends.length > 0 ? 'white' : colors.textSecondary}]}>Send</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  slidingContentWrapper: {
    flex: 1,
    justifyContent: 'flex-end', // Positions modalContainer at the bottom
    pointerEvents: 'box-none', // Allow touches to pass through the wrapper to the overlay
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: ITEM_MARGIN,
    paddingTop: 4,
    paddingBottom: 32,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  closeButton: {
    padding: 5,
  },
  listContentContainer: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  friendItem: {
    borderRadius: (ITEM_SIZE * 0.8) / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectionIndicatorBase: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 100,
  },
  inputContainer: {
    marginHorizontal: ITEM_MARGIN,
    marginTop: ITEM_MARGIN,
    marginBottom: ITEM_MARGIN / 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    minHeight: 40, // Minimum height for single line
    maxHeight: 100, // Max height for multiline
  },
  sendButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginHorizontal: ITEM_MARGIN,
    marginBottom: ITEM_MARGIN + 10,
  },
  sendButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
}); 