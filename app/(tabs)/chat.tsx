import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import ChatHeader from '@/components/chat/ChatHeader';
import ConversationCard from '@/components/chat/ConversationCard';
import { Conversation } from '@/types/chat';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Animated, { FadeIn } from 'react-native-reanimated';

// Perplexity AI chat data
const PERPLEXITY_CHAT: Omit<Conversation, 'avatar'> & { isAI: true } = {
  id: 'perplexity-ai',
  name: 'Perplexity',
  lastMessage: 'Ask me anything...',
  lastMessageTime: '', // Will be set dynamically
  unread: false,
  unreadCount: 0,
  online: true,
  sent: true,
  delivered: true,
  isAI: true, // Special flag to identify this as the AI chat
};

// Helper function to format timestamps
const formatTime = (date: Date): string => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === now.toDateString()) {
    // Today, show time
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (date.toDateString() === yesterday.toDateString()) {
    // Yesterday
    return 'Yesterday';
  } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    // Within last week, show day name
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    // Older, show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

// The Perplexity conversation card component
function PerplexityCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [lastMessageTime, setLastMessageTime] = useState('Now');
  
  // Fetch last Perplexity message time
  useEffect(() => {
    if (!user) return;
    
    const fetchLastPerplexityMessage = async () => {
      try {
        // First get the user's profile ID
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', user.id)
          .single();
          
        if (!profileData?.user_id) return;
        
        // Then fetch the latest AI message
        const { data: messageData, error } = await supabase
          .from('ai_messages')
          .select('created_at')
          .eq('user_id', profileData.user_id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (error || !messageData || messageData.length === 0) {
          setLastMessageTime('Now');
          return;
        }
        
        // Format the timestamp
        const messageDate = new Date(messageData[0].created_at);
        setLastMessageTime(formatTime(messageDate));
      } catch (err) {
        console.error('Error fetching last Perplexity message:', err);
        setLastMessageTime('Now');
      }
    };
    
    fetchLastPerplexityMessage();
  }, [user]);
  
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <TouchableOpacity 
        onPress={onPress}
        style={[styles.card, { backgroundColor: colors.cardBackground }]}
      >
        <Image 
          source={require('@/assets/perplexity.jpg')} 
          style={styles.avatar} 
        />
        
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.name, { color: colors.text }]}>
              Perplexity
            </Text>
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {lastMessageTime}
            </Text>
          </View>
          
          <View style={styles.bottomRow}>
            <Text 
              style={[
                styles.message, 
                { color: colors.textSecondary, flex: 1 }
              ]}
              numberOfLines={1}
            >
              Ask me anything...
            </Text>
            
            <View style={styles.readStatus} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const friendshipIdParam = params.friendshipId as string | undefined;

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [errorLoadingConversations, setErrorLoadingConversations] = useState<string | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);

  // Fetch current user's profile ID
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', user.id)
          .single();
        if (error) {
          console.error("Error fetching current user's profile ID:", error);
          setErrorLoadingConversations("Could not load your profile to fetch chats.");
        } else if (data) {
          setCurrentUserProfileId(data.user_id);
        }
      };
      fetchProfile();
    }
  }, [user]);

  // Fetch all conversations with messages using useFocusEffect
  useFocusEffect(
    useCallback(() => {
      if (!currentUserProfileId) {
        if (!isLoadingConversations) setIsLoadingConversations(true);
        return;
      }
      setIsLoadingConversations(true);
      setErrorLoadingConversations(null);

      const fetchConversations = async () => {
        try {
          const { data: friendships, error: friendshipsError } = await supabase
            .from('friends')
            .select('id, requester_id (id, user_id, username, name, profile_picture_url), recipient_id (id, user_id, username, name, profile_picture_url)')
            .eq('status', 'accepted')
            .or(`requester_id.eq.${currentUserProfileId},recipient_id.eq.${currentUserProfileId}`);

          if (friendshipsError) throw friendshipsError;
          if (!friendships?.length) {
            setConversations([]);
            return;
          }

          const conversationsData: Conversation[] = [];
          for (const friendship of friendships) {
            const { data: messages, error: messagesError } = await supabase
              .from('messages')
              .select('id, content, created_at, sender_id, message_type, sender:sender_id (id, user_id, username, name, profile_picture_url)')
              .eq('friendship_id', friendship.id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (messagesError) {
              console.error(`Error fetching messages for friendship ${friendship.id}:`, messagesError);
              continue;
            }

            if (messages && messages.length > 0) {
              const getProfileData = (profileField: any): { user_id: string, name?: string, username?: string, profile_picture_url?: string } | null => {
                if (Array.isArray(profileField) && profileField.length > 0) return profileField[0];
                if (profileField && typeof profileField === 'object' && !Array.isArray(profileField)) return profileField;
                return null;
              };
              const requesterProfile = getProfileData(friendship.requester_id);
              const recipientProfile = getProfileData(friendship.recipient_id);
              let chatPartnerProfile: { user_id: string, name?: string, username?: string, profile_picture_url?: string } | null = null;

              if (requesterProfile?.user_id === currentUserProfileId) chatPartnerProfile = recipientProfile;
              else if (recipientProfile?.user_id === currentUserProfileId) chatPartnerProfile = requesterProfile;
              else {
                console.warn(`Could not determine chat partner for friendship ${friendship.id}. Current: ${currentUserProfileId}, Req: ${requesterProfile?.user_id}, Rec: ${recipientProfile?.user_id}`);
                continue;
              }
              if (!chatPartnerProfile) continue;

              const lastMessage = messages[0];
              let lastMessageContent = lastMessage.content;
              if (lastMessage.message_type !== 'text') lastMessageContent = `Shared a ${lastMessage.message_type}`;
              
              const lastMessageCreatedAt = lastMessage.created_at; // Store the raw timestamp
              const formattedTime = formatTime(new Date(lastMessageCreatedAt));

              conversationsData.push({
                id: friendship.id,
                friendship_id: friendship.id,
                name: chatPartnerProfile.name || chatPartnerProfile.username || 'Chat Partner',
                avatar: chatPartnerProfile.profile_picture_url || '',
                lastMessage: lastMessageContent,
                lastMessageTime: formattedTime, // For display
                lastMessageCreatedAt: lastMessageCreatedAt, // For sorting
                unread: false, unreadCount: 0, online: false, sent: true, delivered: true, messages: [],
                user_id: chatPartnerProfile.user_id,
              });
            }
          }
          // Sort conversations by the raw created_at timestamp
          conversationsData.sort((a, b) => {
            // Ensure lastMessageCreatedAt exists and is valid for comparison
            const timeA = a.lastMessageCreatedAt ? new Date(a.lastMessageCreatedAt).getTime() : 0;
            const timeB = b.lastMessageCreatedAt ? new Date(b.lastMessageCreatedAt).getTime() : 0;
            return timeB - timeA; // Most recent first (descending order)
          });
          setConversations(conversationsData);
        } catch (err: any) {
          console.error('Error fetching conversations:', err);
          setErrorLoadingConversations(err.message || 'Failed to load chats.');
        } finally {
          setIsLoadingConversations(false);
        }
      };
      fetchConversations();
    }, [currentUserProfileId])
  );

  // Effect to filter conversations based on searchQuery
  useEffect(() => {
    if (searchQuery === '') {
      setFilteredConversations(conversations);
    } else {
      setFilteredConversations(
        conversations.filter(conversation =>
          conversation.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [conversations, searchQuery]);

  // Handle conversation selection - now we just navigate to the standalone chat screen
  const handleConversationSelect = (conversation: Conversation) => {
    // For perplexity, we'll add navigation later -- THIS IS NOW HANDLED BY handlePerplexitySelect
    if (conversation.id === 'perplexity-ai') {
      // This case should ideally not be hit if PerplexityCard has its own onPress handler.
      // router.push('/(chat)/perplexity'); // Kept for safety, but PerplexityCard should handle its own navigation
      return;
    }
    
    router.push(`/(chat)/${conversation.friendship_id}`);
  };

  // Handle Perplexity AI chat selection
  const handlePerplexitySelect = () => {
    router.push('/(chat)/perplexity');
  };

  if (isLoadingConversations && conversations.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (errorLoadingConversations) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ChatHeader searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} />
        <Text style={{ color: colors.error, textAlign: 'center' }}>{errorLoadingConversations}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ChatHeader searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} />
      
      {conversations.length === 0 && !isLoadingConversations ? (
        <View style={styles.emptyContainer}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            No conversations yet. Start chatting with a friend from your Friends tab!
          </Text>
          {/* Always show Perplexity */}
          <View style={styles.perplexityContainer}>
            <PerplexityCard onPress={handlePerplexitySelect} />
          </View>
        </View>
      ) : filteredConversations.length === 0 && searchQuery !== '' ? (
        <View style={styles.emptyContainer}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            No chats found for "{searchQuery}".
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationCard 
              conversation={item} 
              onPress={() => handleConversationSelect(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <PerplexityCard onPress={handlePerplexitySelect} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  perplexityContainer: {
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  // Card styles duplicated from ConversationCard
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
  time: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginRight: 8,
  },
  readStatus: {
    width: 20,
    alignItems: 'center',
  },
});