import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Dimensions, ActivityIndicator, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Stock } from '@/types/stocks';
import { useTheme } from '@/context/ThemeContext';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

type Profile = {
  user_id: string;
  profile_picture_url?: string | null;
  name?: string | null;
  friendship_id?: string;
};

type StockShareModalProps = {
  isVisible: boolean;
  onClose: () => void;
  stock: Stock;
  currentPrice?: number;
};

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 4;
const ITEM_MARGIN = 12;
const ITEM_SIZE = (width - (NUM_COLUMNS + 1) * ITEM_MARGIN) / NUM_COLUMNS;

export default function StockShareModal({ isVisible, onClose, stock, currentPrice }: StockShareModalProps) {
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
  }, [isVisible, currentAuthUid]);

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
      // Get current timestamp for created_at and updated_at
      const now = new Date().toISOString();
      
      // Prepare the stock message content - just use the stock symbol
      const stockContent = stock.symbol;

      // Fetch current stock price and gain data
      let stockPrice = currentPrice || null;
      let stockGain = null;

      // Always fetch the latest data for consistency
      try {
        const { data, error: RpcError } = await supabase.functions.invoke('stock-detail', {
          body: { symbol: stock.symbol },
        });

        if (!RpcError && data?.data) {
          stockPrice = data.data.currentPrice;
          stockGain = data.data.percentageChanges?.['1D'];
          
          // Convert stockGain to integer (store as basis points - multiply by 100)
          if (stockGain !== null) {
            stockGain = Math.round(stockGain * 100);
          }
          
          // Convert stockPrice to integer (multiply by 100 to preserve cents)
          if (stockPrice !== null) {
            stockPrice = Math.round(stockPrice * 100);
          }
        } else {
          console.error('Error fetching stock data:', RpcError);
        }
      } catch (err) {
        console.error('Exception fetching stock data:', err);
      }

      // 1. Send the stock message(s)
      const stockMessagesToSend = selectedFriends.map(friend => {
        if (!friend.friendship_id) {
          return null;
        }
        return {
          friendship_id: friend.friendship_id,
          sender_id: currentUserProfileTableId,
          content: stockContent,
          message_type: 'stock',
          created_at: now,
          updated_at: now,
          stock_price: stockPrice,
          stock_gain: stockGain,
          // Remove reference_id since it expects a bigint but we have a string
        };
      }).filter(msg => msg !== null);

      if (stockMessagesToSend.length > 0) {
        const { error: stockError } = await supabase.from('messages').insert(stockMessagesToSend as any);
        if (stockError) {
          console.error('[StockShareModal] Error sending stock messages:', stockError.message);
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
            created_at: now,
            updated_at: now,
          };
        }).filter(msg => msg !== null);

        if (textMessagesToSend.length > 0) {
          const { error: textError } = await supabase.from('messages').insert(textMessagesToSend as any);
          if (textError) {
            console.error('[StockShareModal] Error sending custom text messages:', textError.message);
          }
        }
      }

      setCustomMessage('');
      onClose();

    } catch (err: any) {
      console.error('[StockShareModal] Exception during send operation:', err.message);
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
      animationType="none"
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
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Sliding Content Area */}
      <Animated.View
        style={[styles.contentContainer, { backgroundColor: colors.cardBackground }]}
        entering={SlideInDown.duration(300)}
        exiting={SlideOutDown.duration(300)}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Share Stock</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading contacts...</Text>
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No contacts found. Add friends to share stocks with them.
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            numColumns={NUM_COLUMNS}
            keyExtractor={item => item.user_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.friendItem,
                  selectedFriends.some(f => f.user_id === item.user_id) && 
                  { borderColor: colors.accent, borderWidth: 2 }
                ]}
                onPress={() => handleToggleFriendSelection(item)}
              >
                {item.profile_picture_url ? (
                  <Image 
                    source={{ uri: item.profile_picture_url }} 
                    style={styles.profileImage} 
                  />
                ) : (
                  <View style={[styles.initialsBubble, { backgroundColor: colors.accent + '60' }]}>
                    <Text style={[styles.initialsText, { color: colors.text }]}>
                      {getInitials(item.name || 'User')}
                    </Text>
                  </View>
                )}
                <Text 
                  style={[styles.friendName, { color: colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.name || 'User'}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.friendsList}
          />
        )}

        <View style={styles.messageInputContainer}>
          <TextInput
            style={[
              styles.messageInput,
              { 
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.background,
                minHeight: 40,
                fontSize: 16
              }
            ]}
            placeholder="Add a message..."
            placeholderTextColor={colors.textSecondary}
            value={customMessage}
            onChangeText={setCustomMessage}
            maxLength={500}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            { 
              backgroundColor: selectedFriends.length > 0 ? colors.accent : colors.accent + '60',
              opacity: isSending ? 0.7 : 1 
            }
          ]}
          onPress={handleConfirmSend}
          disabled={selectedFriends.length === 0 || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={[styles.sendButtonText, { color: '#333' }]}>
              Send to {selectedFriends.length} {selectedFriends.length === 1 ? 'person' : 'people'}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  contentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  stockPreview: {
    marginVertical: 12,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  stockSymbol: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
  },
  stockName: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    marginVertical: 4,
  },
  stockPrice: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    marginVertical: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    marginBottom: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginTop: 8,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  friendsList: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  friendItem: {
    width: ITEM_SIZE,
    marginHorizontal: ITEM_MARGIN / 2,
    marginBottom: ITEM_MARGIN,
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 4,
  },
  initialsBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  initialsText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  friendName: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    width: '100%',
  },
  messageInputContainer: {
    marginBottom: 16,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    height: 40,
    textAlignVertical: 'center',
  },
  sendButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sendButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  }
}); 