import React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ChevronLeft, Paperclip, Send, X as XIcon, TrendingUp } from 'lucide-react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { Conversation, RichMessage } from '@/types/chat';
import { Message as DbMessage } from '@/types/chat';
import { Article } from '@/types/news';
import { Stock } from '@/types/stocks';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import ArticleShareModal from '@/components/chat/ArticleShareModal';
import { COMPANIES } from '@/app/companies';
import ChatMessageStock from '@/components/chat/ChatMessageStock';

// Helper function to get initials (similar to FriendsList.tsx)
const getInitials = (name: string | undefined) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(part => part[0])
    .filter(initial => !!initial) 
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export default function ChatScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const friendshipId = params.id as string;
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [textMessage, setTextMessage] = useState('');
  const [messages, setMessages] = useState<RichMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingFriendDetails, setIsLoadingFriendDetails] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isArticleModalVisible, setIsArticleModalVisible] = useState(false);
  const [attachedArticle, setAttachedArticle] = useState<Article | null>(null);
  const [attachedStock, setAttachedStock] = useState<Stock | null>(null);

  // Fetch current user's profile ID
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (error) {
          console.error("Error fetching current user's profile ID:", error);
          setError("Could not load your profile to start the chat.");
        } else if (data) {
          setCurrentUserProfileId(data.id);
        }
      };
      fetchProfile();
    }
  }, [user]);

  // Fetch friend details and set up conversation
  useEffect(() => {
    if (friendshipId && currentUserProfileId) {
      setIsLoadingFriendDetails(true);
      setError(null);

      const fetchFriendDetailsAndSetupConversation = async () => {
        try {
          const { data: friendRecord, error: friendError } = await supabase
            .from('friends')
            .select(`
              id,
              requester_id (id, user_id, name, username, profile_picture_url),
              recipient_id (id, user_id, name, username, profile_picture_url)
            `)
            .eq('id', friendshipId)
            .single();

          if (friendError) throw friendError;
          if (!friendRecord) throw new Error('Friendship not found.');

          // Determine who is the chat partner
          const reqProfile = friendRecord.requester_id as any;
          const recProfile = friendRecord.recipient_id as any;
          
          let chatPartnerProfileData: any;
          if (reqProfile && (Array.isArray(reqProfile) ? reqProfile[0]?.id : reqProfile.id) === currentUserProfileId) {
            chatPartnerProfileData = Array.isArray(recProfile) ? recProfile[0] : recProfile;
          } else if (recProfile && (Array.isArray(recProfile) ? recProfile[0]?.id : recProfile.id) === currentUserProfileId) {
            chatPartnerProfileData = Array.isArray(reqProfile) ? reqProfile[0] : reqProfile;
          } else {
            console.error('Failed to identify chat partner from friend record:', friendRecord, 'currentUserProfileId:', currentUserProfileId);
            throw new Error('Current user not part of this friendship or data structure mismatch.');
          }

          if (!chatPartnerProfileData) {
            throw new Error('Chat partner profile data not found.');
          }
          
          const newConversation: Conversation = {
            id: friendRecord.id,
            name: chatPartnerProfileData.name || chatPartnerProfileData.username || 'Chat Partner',
            avatar: chatPartnerProfileData.profile_picture_url || '',
            lastMessage: '',
            lastMessageTime: new Date().toISOString(),
            unread: false,
            unreadCount: 0,
            online: true,
            sent: true,
            delivered: true,
            friendship_id: friendRecord.id,
            messages: [],
            user_id: chatPartnerProfileData.user_id,
          };
          setConversation(newConversation);
        } catch (err: any) {
          console.error('Error setting up conversation:', err);
          setError(err.message || 'Failed to load chat details.');
        } finally {
          setIsLoadingFriendDetails(false);
        }
      };

      fetchFriendDetailsAndSetupConversation();
    }
  }, [friendshipId, currentUserProfileId]);

  const mapDbMessageToRichMessage = useCallback((dbMsg: DbMessage & { sender: any }): RichMessage | null => {
    if (!currentUserProfileId) return null;

    const commonProps = {
      id: dbMsg.id,
      timestamp: new Date(dbMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date(dbMsg.created_at).toLocaleDateString(),
      isMine: dbMsg.sender_id === currentUserProfileId,
    };

    if (dbMsg.message_type === 'text') {
      return {
        ...commonProps,
        content: dbMsg.content,
        type: 'text',
      };
    }

    if (dbMsg.message_type === 'article') {
      if (dbMsg.reference_id !== undefined && dbMsg.content) {
        return {
          ...commonProps,
          content: { 
            id: dbMsg.reference_id,
            title: dbMsg.content,
            // Placeholders for other Article fields, assuming Article type might require them
            created_at: '', 
            summary: '',    
            link: '',       
            categories: [],
            source: '',
          } as any as Article,
          type: 'article',
          article_image_url: dbMsg.article_image_url,
        };
      } else {
        console.warn('Missing data for article message (ID or Title):', dbMsg);
        return { 
            ...commonProps,
            content: "Shared article: Essential details missing.",
            type: 'text',
        };
      }
    }

    if (dbMsg.message_type === 'stock') {
      return {
        ...commonProps,
        content: {
          symbol: dbMsg.content,
          name: COMPANIES[dbMsg.content as keyof typeof COMPANIES] || 'Unknown Company',
          price: 0,
          change: 0,
          marketCap: 0,
          volume: 0,
          sector: '',
        } as Stock,
        type: 'stock',
        stock_price: dbMsg.stock_price,
        stock_gain: dbMsg.stock_gain,
      };
    }
    return null;
  }, [currentUserProfileId]);

  // Fetch messages and set up real-time subscription
  useEffect(() => {
    if (!friendshipId || !currentUserProfileId || !conversation) {
      setIsLoadingMessages(false);
      return;
    }
    setIsLoadingMessages(true);
    setError(null);

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            sender_id,
            message_type,
            reference_id,
            article_image_url,
            stock_price,
            stock_gain,
            sender:sender_id (id, user_id, username, name, profile_picture_url)
          `)
          .eq('friendship_id', friendshipId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        const richMessages = data
          .map(dbMsg => mapDbMessageToRichMessage(dbMsg as any))
          .filter(msg => msg !== null) as RichMessage[];
        setMessages(richMessages);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 0);
      } catch (err: any) {
        console.error('Error fetching messages:', err);
        setError('Failed to load messages.');
      } finally {
        setIsLoadingMessages(false);
      }
    };
    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`messages:${friendshipId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `friendship_id=eq.${friendshipId}` },
        async (payload) => {
          const newMessageId = (payload.new as DbMessage).id;
          
          // Check if message already exists (optimistic update might have added it)
          if (messages.some(msg => msg.id === newMessageId)) {
            // console.log("Message already exists in state, skipping:", newMessageId);
            return; 
          }

          const { data: newMessageData, error: fetchError } = await supabase
            .from('messages')
            .select(`
              id,
              content,
              created_at,
              sender_id,
              message_type,
              reference_id,
              article_image_url,
              stock_price,
              stock_gain,
              sender:sender_id (id, user_id, username, name, profile_picture_url)
            `)
            .eq('id', newMessageId)
            .single();

          if (fetchError || !newMessageData) {
            console.error('Error fetching new message details:', fetchError);
            return;
          }

          const richMessage = mapDbMessageToRichMessage(newMessageData as any);
          if (richMessage) {
            // Double-check ID again after fetching, just in case of race condition
            setMessages((prevMessages) => {
              if (prevMessages.some(msg => msg.id === richMessage.id)) {
                return prevMessages; // Already added, do nothing
              }
              // Check if it's replacing a temp message (relevant for messages from self on other devices)
              // Simple approach: Just add if not present by ID. handleSend covers local optimistic updates.
              return [...prevMessages, richMessage];
            });
            // Scroll only if the new message is added
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [friendshipId, currentUserProfileId, conversation, mapDbMessageToRichMessage]);

  const handleSelectArticle = (article: Article) => {
    setAttachedArticle(article);
    setAttachedStock(null);
    setIsArticleModalVisible(false);
  };

  const removeAttachedArticle = () => {
    setAttachedArticle(null);
  };

  const removeAttachedStock = () => {
    setAttachedStock(null);
  };

  // Parse input text to detect stock tickers with @ symbol
  const parseInputForStocks = (input: string) => {
    const regex = /@([A-Z]+)/g;
    const matches = input.match(regex);
    
    if (matches && matches.length > 0) {
      // Get the first stock ticker mentioned
      const ticker = matches[0].substring(1);
      
      if (COMPANIES[ticker as keyof typeof COMPANIES]) {
        // Stock found in companies list
        setAttachedStock({
          symbol: ticker,
          name: COMPANIES[ticker as keyof typeof COMPANIES],
          price: 0, // Placeholder values
          change: 0,
          marketCap: 0,
          volume: 0,
          sector: ''
        });
        
        // Don't remove the @ticker part from the message
        return true;
      }
    }
    return false;
  };

  const handleTextInputChange = (text: string) => {
    setTextMessage(text);
    
    // Check for stock tickers pattern in the input, case insensitive
    const regex = /@([a-zA-Z]+)/g;
    const matches = text.match(regex);
    
    if (matches && matches.length > 0) {
      // Get the last stock ticker mentioned (most recent one)
      const tickerWithAt = matches[matches.length - 1];
      const ticker = tickerWithAt.substring(1).toUpperCase(); // Convert to uppercase for lookup
      
      if (COMPANIES[ticker as keyof typeof COMPANIES]) {
        // Stock found in companies list
        setAttachedStock({
          symbol: ticker,
          name: COMPANIES[ticker as keyof typeof COMPANIES],
          price: 0, // Placeholder values
          change: 0,
          marketCap: 0,
          volume: 0,
          sector: ''
        });
      }
    } else {
      // No stock ticker in the message, clear the attachment
      setAttachedStock(null);
    }
  };

  const handleSend = async () => {
    if (!currentUserProfileId || !friendshipId) {
      console.error('User profile or friendship ID is missing.');
      setError('Cannot send message. Please try again.');
      return;
    }

    const articleToSend = attachedArticle;
    const stockToSend = attachedStock;
    const textContentToSend = textMessage.trim();

    if (!articleToSend && !stockToSend && !textContentToSend) {
      return; // Nothing to send
    }

    // --- Optimistic UI Update ---
    let tempArticleMessageId: string | null = null;
    let tempStockMessageId: string | null = null;
    let tempTextMessageId: string | null = null;
    const optimisticMessages: RichMessage[] = [];
    const now = new Date();
    const timestampString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + now.toLocaleDateString();

    // Prepare optimistic messages
    if (articleToSend) {
      tempArticleMessageId = `temp-article-${Date.now()}`;
      optimisticMessages.push({
        id: tempArticleMessageId,
        content: articleToSend,
        timestamp: timestampString,
        isMine: true,
        type: 'article',
        article_image_url: articleToSend.cover_image_url,
      });
    }
    
    if (stockToSend) {
      tempStockMessageId = `temp-stock-${Date.now()}`;
      optimisticMessages.push({
        id: tempStockMessageId,
        content: stockToSend,
        timestamp: timestampString,
        isMine: true,
        type: 'stock',
        // Add placeholder stock price/gain if needed for optimistic display
        stock_price: undefined,
        stock_gain: undefined,
      });
    }
    
    if (textContentToSend) {
      tempTextMessageId = `temp-text-${Date.now()}`;
      optimisticMessages.push({
        id: tempTextMessageId,
        content: textContentToSend,
        timestamp: timestampString,
        isMine: true,
        type: 'text',
      });
    }

    // Add optimistic messages to UI and clear inputs
    if (optimisticMessages.length > 0) {
      setMessages(prev => [...prev, ...optimisticMessages]);
      const articleWasAttached = !!attachedArticle;
      const stockWasAttached = !!attachedStock;
      const textWasSent = !!textContentToSend;

      if (articleWasAttached) setAttachedArticle(null);
      if (stockWasAttached) setAttachedStock(null);
      if (textWasSent) setTextMessage('');
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 0);
    }
    // --- End Optimistic UI Update ---

    // --- Send Messages to Backend ---
    let firstMessageSent = false; // Flag to send notification only once per batch

    // Send article if present
    if (articleToSend && tempArticleMessageId) {
      const currentTempId = tempArticleMessageId; 
      try {
        const { data: insertedArticle, error: articleError } = await supabase.from('messages').insert({
          friendship_id: friendshipId,
          sender_id: currentUserProfileId,
          content: articleToSend.title,
          message_type: 'article',
          reference_id: articleToSend.id,
          article_image_url: articleToSend.cover_image_url || null,
        }).select().single();

        if (articleError) throw articleError;
        firstMessageSent = true;

        if (insertedArticle) {
          const realArticleMessage = mapDbMessageToRichMessage(insertedArticle as any);
          if (realArticleMessage) {
            setMessages(prev => prev.map(msg => msg.id === currentTempId ? realArticleMessage : msg));
          } else {
            // Fallback: remove temp if mapping fails
             setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
          }
        } else {
           // Fallback: remove temp if insert returns null data
           setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
        }
      } catch (error) {
        console.error('Error sending article message:', error);
        setError('Failed to send article.');
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
        // Restore input for retry only if this was the only thing being sent
        if (optimisticMessages.length === 1) setAttachedArticle(articleToSend);
      }
    }

    // Send stock if present
    if (stockToSend && tempStockMessageId) {
       const currentTempId = tempStockMessageId; 
      try {
        // Fetch current stock price and gain data
        let stockPrice = null;
        let stockGain = null;

        try {
          const { data, error: RpcError } = await supabase.functions.invoke('stock-detail', {
            body: { symbol: stockToSend.symbol },
          });

          if (!RpcError && data?.data) {
            stockPrice = data.data.currentPrice;
            stockGain = data.data.percentageChanges?.['1D'];
            
            // Convert stockGain to integer (store as basis points - multiply by 100)
            if (typeof stockGain === 'number') {
              stockGain = Math.round(stockGain * 100);
            } else {
              stockGain = null; // Ensure it's null if not a number
            }
            
            // Convert stockPrice to integer (multiply by 100 to preserve cents)
            if (typeof stockPrice === 'number') {
              stockPrice = Math.round(stockPrice * 100);
            } else {
              stockPrice = null; // Ensure it's null if not a number
            }
          } else {
            console.error('Error fetching stock data:', RpcError);
          }
        } catch (err) {
          console.error('Exception fetching stock data:', err);
        }

        const { data: insertedStock, error: stockError } = await supabase.from('messages').insert({
          friendship_id: friendshipId,
          sender_id: currentUserProfileId,
          content: stockToSend.symbol,
          message_type: 'stock',
          reference_id: null, 
          stock_price: stockPrice,
          stock_gain: stockGain,
        }).select().single();

        if (stockError) throw stockError;
        if (!firstMessageSent) firstMessageSent = true;

        if (insertedStock) {
            const realStockMessage = mapDbMessageToRichMessage(insertedStock as any);
            if (realStockMessage) {
                setMessages(prev => prev.map(msg => msg.id === currentTempId ? realStockMessage : msg));
            } else {
                setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
            }
        } else {
            setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
        }

      } catch (error) {
        console.error('Error sending stock message:', error);
        setError('Failed to send stock.');
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
        // Restore input for retry only if this was the only thing being sent
         if (optimisticMessages.length === 1) setAttachedStock(stockToSend);
      }
    }

    // Send text message if present
    if (textContentToSend && tempTextMessageId) {
      const currentTempId = tempTextMessageId; 
      try {
        const { data: insertedText, error: textError } = await supabase.from('messages').insert({
          friendship_id: friendshipId,
          sender_id: currentUserProfileId,
          content: textContentToSend,
          message_type: 'text',
        }).select().single();

        if (textError) throw textError;
        if (!firstMessageSent) firstMessageSent = true;

        if (insertedText) {
            const realTextMessage = mapDbMessageToRichMessage(insertedText as any);
            if (realTextMessage) {
                setMessages(prev => prev.map(msg => msg.id === currentTempId ? realTextMessage : msg));
            } else {
                setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
            }
        } else {
            setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
        }

      } catch (error) {
        console.error('Error sending text message:', error);
        setError('Failed to send message text.');
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(msg => msg.id !== currentTempId));
         // Restore input for retry only if this was the only thing being sent
         if (optimisticMessages.length === 1) setTextMessage(textContentToSend);
      }
    }
     // --- End Send Messages to Backend ---

    // --- Send Notification via Edge Function ---
    if (firstMessageSent && conversation?.user_id && currentUserProfileId) {
      try {
        // Determine the content for the notification preview
        let notificationPreview = 'Sent you a message';
        if (articleToSend) {
          notificationPreview = `Sent you an article: ${articleToSend.title.substring(0, 50)}${articleToSend.title.length > 50 ? '...' : ''}`;
        } else if (stockToSend) {
          notificationPreview = `Sent you a stock: $${stockToSend.symbol}`;
        } else if (textContentToSend) {
          notificationPreview = textContentToSend.substring(0, 100) + (textContentToSend.length > 100 ? '...' : '');
        }

        const { error: functionError } = await supabase.functions.invoke('create-chat-notification', {
          body: {
            recipientUserId: conversation.user_id, // The user_id of the person receiving the message
            senderProfileId: currentUserProfileId, // The profile_id of the sender
            friendshipId: friendshipId,
            messagePreview: notificationPreview,
          },
        });
        if (functionError) {
          console.error('Error calling create-chat-notification function:', functionError);
          // Non-critical, so don't show error to user, just log
        }
      } catch (invokeError) {
        console.error('Exception when calling create-chat-notification function:', invokeError);
      }
    }
  };

  // Add a function to navigate to the user's profile
  const navigateToUserProfile = () => {
    if (conversation?.user_id) {
      router.push(`/user/${conversation.user_id}`);
    }
  };

  // Unified loading state for initial friend details and messages
  if (isLoadingFriendDetails || (conversation && isLoadingMessages && messages.length === 0 && !error)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Error State
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 10, backgroundColor: colors.cardBackground, borderRadius: 8 }}>
          <Text style={{ color: colors.text }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Conversation not found (implies loading phases passed without setting conversation, and no specific error string)
  if (!conversation) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: colors.error, textAlign: 'center' }}>Chat not found or details could not be loaded.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 10, backgroundColor: colors.cardBackground, borderRadius: 8 }}>
          <Text style={{ color: colors.text }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{backgroundColor: colors.cardBackground}}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.profileContainer}
            onPress={navigateToUserProfile}
            disabled={!conversation?.user_id}
          >
            {conversation?.avatar ? (
              <Image source={{ uri: conversation.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.initialsAvatar, { backgroundColor: colors.accent + '30' }]}>
                <Text style={[styles.initialsText, { color: colors.accent }]}>
                  {getInitials(conversation?.name)}
                </Text>
              </View>
            )}
            <View>
              <Text style={[styles.name, { color: colors.text }]}>
                {conversation?.name}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={[
          styles.messagesContent,
          messages.length === 0 && !isLoadingMessages && { flex: 1, justifyContent: 'center' }
        ]}
        showsVerticalScrollIndicator={false}
        contentInset={{ bottom: 70 }}
        contentOffset={{ x: 0, y: -70 }}
      >
        {messages.length === 0 && !isLoadingMessages && (
          <View style={styles.centeredMessageContainer}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Send a message to start a chat!</Text>
          </View>
        )}
        
        {messages.map((msg: RichMessage, index: number) => {
          const isFirstInGroup = index === 0 || 
            (messages[index - 1] && messages[index - 1].timestamp.split(' | ')[1] !== msg.timestamp.split(' | ')[1]);
            
          const articleContent = msg.type === 'article' ? msg.content as Article : null;
          const stockContent = msg.type === 'stock' ? msg.content as Stock : null;

          return (
            <View key={msg.id}>
              {isFirstInGroup && (
                <View style={styles.dateContainer}>
                  <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                    {msg.timestamp.split(' | ')[1]} {/* Date part */}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.messageBubble,
                  msg.isMine 
                    ? [styles.myMessage, { backgroundColor: colors.accent + '30' }] 
                    : [styles.theirMessage, { backgroundColor: colors.cardBackground }],
                  // Adjust padding for article and stock messages
                  (msg.type === 'article' || msg.type === 'stock') && { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }
                ]}
              >
                {msg.type === 'text' && (
                  <>
                    <Text style={[styles.messageText, { color: colors.text }]}>
                        {msg.content as string} 
                    </Text>
                    <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                      {msg.timestamp.split(' | ')[0]} {/* Time part */}
                    </Text>
                  </>
                )}
                {msg.type === 'article' && articleContent && (
                  <TouchableOpacity 
                    style={[styles.articleShare, msg.isMine ? { alignSelf: 'flex-end'} : { alignSelf: 'flex-start'}]}
                    onPress={() => {
                      if (articleContent.id) {
                        router.push(`/article/${articleContent.id}`);
                      }
                    }}
                    activeOpacity={0.7}
                  > 
                    {msg.article_image_url && (
                      <Image 
                        source={{ uri: msg.article_image_url }}
                        style={styles.articleImage} 
                        resizeMode="cover"
                      />
                    )}
                    <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
                      <Text style={[styles.articleTitle, { color: colors.text }]} numberOfLines={2}>
                        {articleContent.title}
                      </Text>
                      <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                        {msg.timestamp.split(' | ')[0]} {/* Time part */}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                {msg.type === 'stock' && stockContent && (
                  <View style={{ paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }}>
                    <ChatMessageStock 
                      stock={stockContent} 
                      stock_price={msg.stock_price} 
                      stock_gain={msg.stock_gain}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ paddingBottom: 0 }}
      >
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.cardBackground }}>
          {/* Attached Article Preview */}
          {attachedArticle && (
            <View style={[styles.attachedItemContainer, { borderBottomColor: colors.border }]}>
              <View style={styles.attachedItemInfo}>
                <Paperclip size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <Text style={[styles.attachedItemTitle, { color: colors.text }]} numberOfLines={1}>
                  {attachedArticle.title}
                </Text>
              </View>
              <TouchableOpacity onPress={removeAttachedArticle} style={styles.removeAttachedButton}>
                <XIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Attached Stock Preview */}
          {attachedStock && (
            <View style={[styles.attachedItemContainer, { borderBottomColor: colors.border }]}>
              <View style={styles.attachedItemInfo}>
                <TrendingUp size={16} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.attachedItemTitle, { color: colors.text }]} numberOfLines={1}>
                  ${attachedStock.symbol} - {attachedStock.name}
                </Text>
              </View>
              <TouchableOpacity onPress={removeAttachedStock} style={styles.removeAttachedButton}>
                <XIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.cardBackground }]}>
            <TouchableOpacity 
              style={styles.attachButton} 
              onPress={() => setIsArticleModalVisible(true)}
              disabled={!!attachedArticle || !!attachedStock}
            >
              <Paperclip size={20} color={(!!attachedArticle || !!attachedStock) ? colors.border : colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={[
                styles.input, 
                { 
                  backgroundColor: colors.background,
                  color: colors.text,
                }
              ]}
              placeholder={(attachedArticle || attachedStock) ? "Type a message..." : "Type @TICKER or a message..."}
              placeholderTextColor={colors.textSecondary}
              value={textMessage}
              onChangeText={handleTextInputChange}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                { backgroundColor: (textMessage.trim() || attachedArticle || attachedStock) ? colors.accent : colors.accent + '40' }
              ]}
              onPress={handleSend}
              disabled={!textMessage.trim() && !attachedArticle && !attachedStock}
            >
              <Send size={18} color={(textMessage.trim() || attachedArticle || attachedStock) ? "#444" : "white"} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <ArticleShareModal
        isVisible={isArticleModalVisible}
        onClose={() => setIsArticleModalVisible(false)}
        onSelectArticle={handleSelectArticle}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  profileContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  initialsAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  name: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.1)'
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 20,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  articleShare: { 
    width: 240,
  },
  articleImage: {
    width: 240,
    height: 140,
    borderRadius: 8,
  },
  articleTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 16, 
    marginVertical: 8,
  },
  attachedItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  attachedItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  attachedItemTitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  removeAttachedButton: {
    padding: 4,
  },
}); 