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
import Animated, { FadeIn, SlideInRight, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { Conversation, RichMessage } from '@/types/chat';
import { Message as DbMessage } from '@/types/chat';
import { Article } from '@/types/news';
import { Stock } from '@/types/stocks';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
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

// Helper function to parse and render formatted text
const FormattedTextMessage: React.FC<{ text: string; baseTextStyle: any; headingStyle: any; boldStyle: any }> = ({ text, baseTextStyle, headingStyle, boldStyle }) => {
  // First, pre-process the text to clean up heading formats
  // This ensures # symbols at the start of lines are treated as heading markers
  const processedText = text.replace(/^(#+)\s+(.+)$/gm, (match, hashes, content) => {
    // Format: number of hashes + content (to be styled differently later)
    return `__HEADING_${hashes.length}__${content}`;
  });
  
  const lines = processedText.split('\n'); // Split by newline characters

  return (
    <>
      {lines.map((line, lineIndex) => {
        let content: React.ReactNode[] = [];
        
        // Check for our special heading marker
        const headingMatch = line.match(/^__HEADING_([123])__(.+)$/);
        
        if (headingMatch) {
          const headingLevel = parseInt(headingMatch[1]); // 1, 2, or 3
          const headingText = headingMatch[2]; // Just the heading content
          
          content.push(
            <Text 
              key={`line-${lineIndex}-heading`} 
              style={[
                baseTextStyle, 
                headingStyle,
                { fontSize: 24 - (headingLevel * 2) } // 22 for h1, 20 for h2, 18 for h3
              ]}
            >
              {headingText}
            </Text>
          );
        } else {
          // Process for bold tags
          const parts = line.split(/(\*\*)/g); // Split by **
          let isBold = false;
          const lineElements: React.ReactNode[] = [];

          parts.forEach((part, partIndex) => {
            if (part === '**') {
              isBold = !isBold;
            } else if (part) { // Ensure part is not empty
              lineElements.push(
                <Text key={`part-${lineIndex}-${partIndex}`} style={isBold ? [baseTextStyle, boldStyle] : baseTextStyle}>
                  {part}
                </Text>
              );
            }
          });
          
          if (lineElements.length > 0) {
            content.push(<Text key={`line-${lineIndex}-content`} style={baseTextStyle}>{lineElements}</Text>);
          } else if (!headingMatch){ // Handle empty lines that are not headings
             content.push(<Text key={`line-${lineIndex}-empty`} style={baseTextStyle}>{''}</Text>);
          }
        }
        
        return (
          <React.Fragment key={`line-fragment-${lineIndex}`}>
            {content}
          </React.Fragment>
        );
      })}
    </>
  );
};

// Static Perplexity AI Conversation data
const PERPLEXITY_CONVERSATION_DATA: Conversation = {
  id: 'perplexity-ai-chat', // Unique ID for this conversation instance
  name: 'Perplexity',
  avatar: require('@/assets/perplexity.jpg'), // Will need to adjust how Image handles this vs. string URI
  lastMessage: '',
  lastMessageTime: new Date().toISOString(),
  unread: false,
  unreadCount: 0,
  online: true, 
  sent: true,
  delivered: true,
  messages: [],
  // friendship_id is not applicable here
  // user_id for Perplexity could be a special constant if needed for 'sender' logic
};

// Typing indicator with bouncing dots animation
const TypingIndicator = () => {
  const { colors } = useTheme();
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  
  // Styles for the animated dots
  const dot1Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: dot1.value }]
    };
  });
  
  const dot2Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: dot2.value }]
    };
  });
  
  const dot3Style = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: dot3.value }]
    };
  });
  
  // Start the animation when the component mounts
  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite repetitions
      true // Reverse each time
    );
    
    // Delay the second dot slightly
    setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, 150);
    
    // Delay the third dot slightly more
    setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, 300);
  }, []);
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
      <Animated.View style={[styles.typingDot, { backgroundColor: colors.accent }, dot1Style]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: colors.accent }, dot2Style]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: colors.accent }, dot3Style]} />
    </View>
  );
};

export default function PerplexityChatScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  
  const params = useLocalSearchParams<{ prefillMessage?: string; autoSend?: string; stockData?: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [textMessage, setTextMessage] = useState('');
  const [messages, setMessages] = useState<RichMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingFriendDetails, setIsLoadingFriendDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isArticleModalVisible, setIsArticleModalVisible] = useState(false);
  const [attachedArticle, setAttachedArticle] = useState<Article | null>(null);
  const [attachedStock, setAttachedStock] = useState<Stock | null>(null);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  
  // New state for streaming
  const [streamingMessage, setStreamingMessage] = useState<RichMessage | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const streamController = useRef<AbortController | null>(null);
  const hasAttemptedAutoSendRef = useRef(false);

  // Fetch current user's *profile* ID (from 'profiles' table)
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id') // Correctly select user_id, which links to auth.users and is used in ai_messages
          .eq('user_id', user.id) // user.id is auth.uid()
          .single();
        if (error) {
          console.error("Error fetching current user's profile ID for AI chat:", error);
          setError("Could not load your profile to start the chat.");
        } else if (data && data.user_id) {
          setCurrentUserProfileId(data.user_id);
        } else {
          setError("Could not find your profile (user_id) to start the chat.");
        }
      };
      fetchProfile();
    }
  }, [user]);

  // Set up the static Perplexity conversation
  useEffect(() => {
    // Set the conversation object for Perplexity AI
    // The avatar needs to be handled carefully as `require` returns a number, not a string URI.
    // For now, let's assume the Image component in the header can handle it or we use a placeholder.
    // We can refine avatar handling in the next step.
    setConversation({
        ...PERPLEXITY_CONVERSATION_DATA,
        // If your Image component in the header *requires* a URI string:
        // avatar: 'https://example.com/perplexity_avatar.png' // Placeholder or actual remote URL
        // Or, we modify the header to accept a local image source.
        // For now, the type of PERPLEXITY_CONVERSATION_DATA.avatar is intentionally a number from require()
    });
    setIsLoadingFriendDetails(false); // No friend details to load
    setIsLoadingMessages(true); // Prepare to load AI messages

  }, []); // Runs once on mount
  
  // Clean up streaming on unmount
  useEffect(() => {
    return () => {
      if (streamController.current) {
        streamController.current.abort();
        streamController.current = null;
      }
    };
  }, []);

  // A utility function to deduplicate messages by ID
  const deduplicateMessages = useCallback((messages: RichMessage[]): RichMessage[] => {
    const seenIds = new Set<string>();
    return messages.filter(msg => {
      if (seenIds.has(msg.id)) {
        // Skip duplicate
        return false;
      }
      seenIds.add(msg.id);
      return true;
    });
  }, []);

  // When messages change, make sure we don't have duplicates
  useEffect(() => {
    const uniqueMessages = deduplicateMessages(messages);
    if (uniqueMessages.length !== messages.length) {
      setMessages(uniqueMessages);
    }
  }, [messages, deduplicateMessages]);

  const mapDbMessageToRichMessage = useCallback((dbMsg: DbMessage & { sender?: any, user_id?: string, sender_type?: 'user' | 'perplexity', is_streaming?: boolean } , isAiMessage: boolean = false): RichMessage | null => {
    // For user messages, currentUserProfileId is the user_id from profiles table.
    // For AI messages, dbMsg.user_id is the user_id from profiles, and dbMsg.sender_type indicates actual sender.
    if (!currentUserProfileId && !isAiMessage) return null; 
    if (!dbMsg) return null;

    // Skip temporary messages from the database if we're already showing a local streaming message
    if (streamingMessage && dbMsg.is_streaming === true && dbMsg.sender !== 'user') {
      // Skip duplicate streaming message
      return null;
    }

    let isMineLogic = false;
    if (isAiMessage) {
        // dbMsg from ai_messages. sender determines if it's from the user or perplexity.
        // Messages with sender='user' are sent by the user and should appear on the right
        isMineLogic = dbMsg.sender === 'user';
    } else {
        // This branch would be for P2P messages if this function was reused, using sender_id.
        // However, for Perplexity screen, we only deal with AI messages or messages from current user to AI.
        if (!currentUserProfileId || !dbMsg.sender_id) return null; 
        isMineLogic = dbMsg.sender_id === currentUserProfileId; // Assumes sender_id is the profile PK for P2P
    }

    const commonProps = {
      id: dbMsg.id || `temp-${Date.now()}`,
      timestamp: new Date(dbMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + new Date(dbMsg.created_at).toLocaleDateString(),
      isMine: isMineLogic,
      is_streaming: dbMsg.is_streaming || false
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

  // Fetch messages and set up real-time subscription (ADAPT FOR AI MESSAGES)
  useEffect(() => {
    if (!currentUserProfileId) { 
        setIsLoadingMessages(false);
        // Don't set error text as we're showing the loading spinner instead
        return;
    }
    
    // Fetch AI messages for this user
    setIsLoadingMessages(true);
    setError(null);

    const fetchAiMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_messages')
          .select(`
            id,
            content,
            created_at,
            user_id,
            sender,
            message_type,
            reference_id,
            article_image_url,
            stock_price,
            stock_gain,
            is_streaming
          `)
          .eq('user_id', currentUserProfileId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        const richMessages = data
          .map(dbMsg => mapDbMessageToRichMessage(dbMsg as any, true))
          .filter(msg => msg !== null) as RichMessage[];
        
        setMessages(richMessages);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 0);
      } catch (err: any) {
        console.error('Error fetching AI messages:', err);
        setError('Failed to load conversation with Perplexity.');
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchAiMessages();
    
    // Set up real-time subscription for new AI messages
    const channel = supabase
      .channel(`ai_messages:${currentUserProfileId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_messages', filter: `user_id=eq.${currentUserProfileId}` },
        async (payload) => {
          const newMessage = payload.new as DbMessage & { sender: 'user' | 'perplexity', is_streaming?: boolean };
          
          // Check if message already exists by ID or if it's a streaming message we're already handling
          if (messages.some(msg => msg.id === newMessage.id) || 
              (streamingMessage && newMessage.is_streaming === true)) {
            // Message already exists or is being handled
            return; 
          }
          
          // If this is a streaming message and we're currently in streaming mode, don't add it
          if (newMessage.is_streaming === true && isGeneratingResponse) {
            // Ignore streaming message while already generating
            return;
          }
          
          // Transform to richMessage
          const richMessage = mapDbMessageToRichMessage(newMessage, true);
          if (richMessage) {
            // Double-check ID again after mapping, just in case of race condition or if ID wasn't in payload.new directly
            setMessages((prevMessages) => {
              if (prevMessages.some(msg => msg.id === richMessage.id)) {
                return prevMessages; // Already added, do nothing
              }
              return [...prevMessages, richMessage];
            });
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 0);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_messages', filter: `user_id=eq.${currentUserProfileId}` },
        async (payload) => {
          const updatedMessage = payload.new as DbMessage & { sender: 'user' | 'perplexity', is_streaming?: boolean };
          
          // Check if this is an update to a streaming message
          if (updatedMessage.is_streaming === false && streamingMessage && streamingMessage.id === updatedMessage.id) {
            // The message is no longer streaming - update it and clear streaming state
            setStreamingMessage(null);
            setStreamingContent('');
            
            // Update the message in the list with the final content
            const richMessage = mapDbMessageToRichMessage(updatedMessage, true);
            if (richMessage) {
              setMessages((prevMessages) => 
                prevMessages.map(msg => msg.id === richMessage.id ? richMessage : msg)
              );
            }
          } else {
            // Regular update to a message
            const richMessage = mapDbMessageToRichMessage(updatedMessage, true);
            if (richMessage) {
              setMessages((prevMessages) => 
                prevMessages.map(msg => msg.id === richMessage.id ? richMessage : msg)
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserProfileId, mapDbMessageToRichMessage]);

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

  // Parse input text to detect stock tickers with @ symbol - enabled for AI chat
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
    // Stock sharing enabled for AI chat
    const regex = /@([a-zA-Z]+)/g;
    const matches = text.match(regex);
    
    if (matches && matches.length > 0) {
      const tickerWithAt = matches[matches.length - 1];
      const ticker = tickerWithAt.substring(1).toUpperCase(); 
      
      if (COMPANIES[ticker as keyof typeof COMPANIES]) {
        setAttachedStock({
          symbol: ticker,
          name: COMPANIES[ticker as keyof typeof COMPANIES],
          price: 0, change: 0, marketCap: 0, volume: 0, sector: ''
        });
      }
    } else {
      setAttachedStock(null);
    }
  };

  // A utility function to safely update message content without causing key issues
  const updateMessageContent = useCallback((messageId: string, newContent: string, isStreaming: boolean = true) => {
    setMessages(prevMessages => {
      // First check if the message exists
      const messageExists = prevMessages.some(msg => msg.id === messageId);
      if (!messageExists) {
        // Message not found
        return prevMessages;
      }
      
      // Create a fresh copy of the messages array to avoid reference issues
      return prevMessages.map(msg => 
        msg.id === messageId
          ? { ...msg, content: newContent, is_streaming: isStreaming }
          : msg
      );
    });
  }, [setMessages]); // Added setMessages to dependencies
  
  // Function to handle streaming responses
  const handleStreamResponse = useCallback(async (userId: string, messageId: string) => {
    if (!userId || !messageId) {
      console.error('Missing required parameters for streaming');
      return;
    }
    
    try {
      // Create abort controller for the stream
      streamController.current = new AbortController();
      
      // Create a placeholder streaming message with a consistent format
      const now = new Date();
      const timestampString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + now.toLocaleDateString();
      const tempId = `temp-streaming-response-${now.getTime()}`;
      
      const placeholderStreamingMessage: RichMessage = {
        id: tempId,
        content: '', // Start with empty content to show typing indicator
        timestamp: timestampString,
        isMine: false,
        type: 'text',
        is_streaming: true
      };
      
      // Check if we might already have this message from the realtime subscription
      const existingStreamingMsg = messages.find(m => m.is_streaming === true && !m.isMine);
      
      if (existingStreamingMsg) {
        // Use existing streaming message
        setStreamingMessage(existingStreamingMsg);
        // Make sure content is empty initially to show the typing indicator
        updateMessageContent(existingStreamingMsg.id, '', true);
      } else {
        // Create new placeholder streaming message
        setStreamingMessage(placeholderStreamingMessage);
        setMessages(prev => [...prev, placeholderStreamingMessage]);
      }
      
      setStreamingContent('');
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 0);

      // Use Supabase's invoke method but request non-streaming mode
      // This works better in React Native which has limited streaming support
      const { data, error } = await supabase.functions.invoke('perplexity-chat', {
        body: { 
          user_id: userId, 
          message_id: messageId,
          stream: false // Use non-streaming API for reliability
        }
      });

      if (error) {
        throw new Error(`Function error: ${error.message}`);
      }

      // Simulate streaming by showing the response character by character
      if (data && data.response) {
        let accumulatedText = '';
        const fullText = data.response as string;
        
        // Get the real message ID if available, otherwise use placeholder ID
        const streamingMessageIdToUse = data.message_id || (existingStreamingMsg ? existingStreamingMsg.id : tempId);
        
        // If we have a real message ID and a temp placeholder, update the placeholder
        if (data.message_id && !existingStreamingMsg) {
          // Update streaming message reference first
          setStreamingMessage(prev => prev ? {...prev, id: streamingMessageIdToUse} : null);
          
          // Then update the messages array with new ID
          setMessages(prev => 
            prev.map(msg => 
              msg.id === tempId 
                ? {...msg, id: streamingMessageIdToUse} 
                : msg
            )
          );
        }
        
        // Show the typing indicator for a moment before starting to show text
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate streaming by revealing characters gradually
        const chunkSize = 10; // Characters per chunk
        const delayMs = 0.1;   // Delay between chunks in ms (WAS 10)
        
        for (let i = 0; i < fullText.length; i += chunkSize) {
          if (streamController.current?.signal.aborted) {
            // Streaming aborted
            break;
          }
          
          // Get next chunk
          const nextChunk = fullText.substring(i, i + chunkSize);
          accumulatedText += nextChunk;
          
          // Update UI with new text using our helper function
          setStreamingContent(accumulatedText);
          updateMessageContent(streamingMessageIdToUse, accumulatedText, true);
          
          // Scroll as text comes in periodically
          if (i % (chunkSize * 10) === 0) {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: false });
            }, 0);
          }
          
          // Wait before next chunk
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      // Mark streaming as complete
      const finalId = data?.message_id || (existingStreamingMsg ? existingStreamingMsg.id : tempId);
      updateMessageContent(finalId, data?.response || '', false);
      
      // Scroll to end when done
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 0);
      
    } catch (e) {
      console.error('Stream fetch error:', e);
      setError('Failed to connect to AI service. Please try again.');
      
      // Remove the placeholder message since we couldn't get a response
      if (streamingMessage) {
        setMessages(prev => 
          prev.filter(msg => msg.id !== streamingMessage?.id)
        );
      }
      
      setStreamingMessage(null);
      setStreamingContent('');
    } finally {
      setIsGeneratingResponse(false); // End the loading state
      
      // Reset the abort controller
      streamController.current = null;
    }
  }, [messages, supabase, updateMessageContent, setMessages, setStreamingMessage, setStreamingContent, setError, setIsGeneratingResponse, scrollViewRef, streamController]); // Added missing dependencies

  const handleSend = useCallback(async () => {
    if (!currentUserProfileId) { 
      console.error('User profile ID (user_id) is missing for AI chat.');
      setError('Cannot send message. Please try again.');
      return;
    }

    if (isGeneratingResponse) {
      return; // Don't allow sending while generating
    }

    const articleToSend = attachedArticle;
    const stockToSend = attachedStock;
    const textContentToSend = textMessage.trim();

    if (!articleToSend && !stockToSend && !textContentToSend) {
      return; // Nothing to send
    }

    // Determine message content and type
    let finalContent: string | Article | Stock = '';
    let finalMessageType: 'text' | 'article' | 'stock' = 'text';
    let tempMessageId = `temp-ai-${Date.now()}`;
    let articleImageUrl: string | null | undefined = undefined;
    let stockPriceVal: number | null | undefined = undefined;
    let stockGainVal: number | null | undefined = undefined;
    let combinedText = false;

    const now = new Date();
    const timestampString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " + now.toLocaleDateString();

    if (articleToSend && textContentToSend) {
      finalContent = `Regarding the article \"${articleToSend.title}\": ${textContentToSend}`;
      finalMessageType = 'text';
      combinedText = true;
    } else if (stockToSend && textContentToSend) {
      finalContent = `Regarding the stock ${stockToSend.symbol} (${stockToSend.name}): ${textContentToSend}`;
      finalMessageType = 'text';
      combinedText = true;
    } else if (articleToSend) {
      finalContent = articleToSend;
      finalMessageType = 'article';
      articleImageUrl = articleToSend.cover_image_url;
    } else if (stockToSend) {
      finalContent = stockToSend;
      finalMessageType = 'stock';
    } else if (textContentToSend) {
      finalContent = textContentToSend;
      finalMessageType = 'text';
    }

    // Create single optimistic message based on final type
    const optimisticMessage: RichMessage = {
      id: tempMessageId,
      content: finalContent,
      timestamp: timestampString,
      isMine: true,
      type: finalMessageType,
      article_image_url: finalMessageType === 'article' ? articleImageUrl : undefined,
      stock_price: finalMessageType === 'stock' ? stockPriceVal : undefined,
      stock_gain: finalMessageType === 'stock' ? stockGainVal : undefined,
    };

    // Add optimistic message to UI and clear inputs
    setMessages(prev => [...prev, optimisticMessage]);
    if (articleToSend) setAttachedArticle(null);
    if (stockToSend) setAttachedStock(null);
    if (textContentToSend) setTextMessage('');
      
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 0);

    setIsGeneratingResponse(true); // Set loading state

    // --- Send Single User Message to Backend ---
    let userMessageIDToTriggerFunction: string | null = null;
    
    try {
        let insertPayload: any = {
            user_id: currentUserProfileId,
            sender: 'user',
            message_type: finalMessageType,
        };

        if (finalMessageType === 'text') {
            insertPayload.content = finalContent as string;
        } else if (finalMessageType === 'article') {
            const article = finalContent as Article;
            insertPayload.content = article.title;
            insertPayload.reference_id = article.id;
            insertPayload.article_image_url = article.cover_image_url || null;
        } else if (finalMessageType === 'stock') {
            const stock = finalContent as Stock;
            insertPayload.content = stock.symbol;
            // Fetch stock details if it's a standalone stock message
            if (!combinedText) {
                try {
                    const { data: stockDetailData, error: RpcError } = await supabase.functions.invoke('stock-detail', {
                        body: { symbol: stock.symbol },
                    });
                    if (!RpcError && stockDetailData?.data) {
                        stockPriceVal = stockDetailData.data.currentPrice;
                        stockGainVal = stockDetailData.data.percentageChanges?.['1D'];
                        stockPriceVal = typeof stockPriceVal === 'number' ? Math.round(stockPriceVal * 100) : null;
                        stockGainVal = typeof stockGainVal === 'number' ? Math.round(stockGainVal * 100) : null;
                        insertPayload.stock_price = stockPriceVal;
                        insertPayload.stock_gain = stockGainVal;
                    } else {
                        console.error('Error fetching stock data for AI chat:', RpcError);
                    }
                } catch (err) {
                    console.error('Exception fetching stock data for AI chat:', err);
                }
            }
        }

        const { data: insertedMessage, error: insertError } = await supabase
            .from('ai_messages')
            .insert(insertPayload)
            .select('*') // Select the full inserted row to get all fields back
            .single();
            
        if (insertError) throw insertError;

        if (insertedMessage) {
            const realMessage = mapDbMessageToRichMessage(insertedMessage as any, true);
            if (realMessage) {
                // Update the optimistic message with real data (including potentially updated stock info)
                setMessages(prev => prev.map(msg => 
                    msg.id === tempMessageId 
                        ? { ...realMessage, content: msg.content } // Keep optimistic content if it differs slightly (e.g., combined text vs stock object) but use real ID etc.
                        : msg
                ));
                userMessageIDToTriggerFunction = realMessage.id;
            } else {
                // Failed to map, remove optimistic message
                setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
            }
        } else {
            // Insert failed silently? Remove optimistic message
            setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
        }
    } catch (error) {
        console.error('Error sending consolidated AI message:', error);
        setError('Failed to send message to AI.');
        setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
        // Restore input if needed (tricky with combined messages)
        // if (!combinedText && textContentToSend) setTextMessage(textContentToSend);
        // if (!combinedText && articleToSend) setAttachedArticle(articleToSend);
        // if (!combinedText && stockToSend) setAttachedStock(stockToSend);
        setIsGeneratingResponse(false);
        return; // Stop if sending failed
    }
    
    // --- End Send User Message to Backend ---

    // Now call the edge function to generate a response if we have a valid message ID
    if (userMessageIDToTriggerFunction) {
      try {
        // Instead of calling the function directly, use the streaming handler
        await handleStreamResponse(currentUserProfileId, userMessageIDToTriggerFunction);
        // handleStreamResponse will update isGeneratingResponse when complete
      } catch (err) {
        console.error('Error with streaming response:', err);
        setError('Failed to get AI response. Please try again.');
        setIsGeneratingResponse(false);
      }
    } else {
      // If no message was actually sent (e.g., all attempts failed before sending or nothing to send initially)
      setIsGeneratingResponse(false); // Ensure loading indicator is turned off
    }
  }, [currentUserProfileId, isGeneratingResponse, attachedArticle, attachedStock, textMessage, supabase, mapDbMessageToRichMessage, handleStreamResponse, COMPANIES, setMessages, setAttachedArticle, setAttachedStock, setTextMessage, setError, setIsGeneratingResponse, scrollViewRef]); // Added missing dependencies

  useEffect(() => {
    const { prefillMessage, autoSend } = params || {}; // Safely access params

    if (
      prefillMessage &&
      autoSend === 'true' &&
      !hasAttemptedAutoSendRef.current &&
      currentUserProfileId &&
      !isGeneratingResponse
    ) {
      hasAttemptedAutoSendRef.current = true; 

      const messageToSend = prefillMessage;

      const stockMatch = messageToSend.match(/@([A-Z]+)/);
      let tempStockToAttach: Stock | null = null;
      if (stockMatch && stockMatch[1]) {
        const ticker = stockMatch[1];
        if (COMPANIES[ticker as keyof typeof COMPANIES]) {
          tempStockToAttach = {
            symbol: ticker,
            name: COMPANIES[ticker as keyof typeof COMPANIES],
            price: 0, change: 0, marketCap: 0, volume: 0, sector: ''
          };
          setAttachedStock(tempStockToAttach);
        }
      }
      setTextMessage(messageToSend);

      const sendTimeoutId = setTimeout(() => {
        if (currentUserProfileId && !isGeneratingResponse) { 
          handleSend()
            .then(() => {
              const newParams = { ...params };
              delete newParams.prefillMessage;
              delete newParams.autoSend;
              router.replace({ pathname: '/perplexity', params: newParams as any }); // Type cast for newParams
            })
            .catch(e => {
              console.error("Auto-send failed:", e);
              setTextMessage('');
              if (tempStockToAttach) setAttachedStock(null);
              hasAttemptedAutoSendRef.current = false; 
            });
        } else {
          setTextMessage('');
          if (tempStockToAttach) setAttachedStock(null);
          hasAttemptedAutoSendRef.current = false; 
        }
      }, 100);

      return () => clearTimeout(sendTimeoutId);
    }
  // Ensure handleSend, setTextMessage, setAttachedStock are stable via useCallback/useState setters
  }, [params, currentUserProfileId, isGeneratingResponse, router, handleSend, setTextMessage, setAttachedStock, COMPANIES]); // Added COMPANIES

  useEffect(() => {
    if (!params?.prefillMessage) { // Safe access to params.prefillMessage
      hasAttemptedAutoSendRef.current = false;
    }
  }, [params?.prefillMessage]); // Safe access for dependency array

  const handleProfileNavigation = () => {
    // Profile navigation logic here? Or disable button if no action?
  }

  // Unified loading state for initial setup
  // isLoadingFriendDetails is now false by default for this screen.
  // We mainly wait for currentUserProfileId.
  if (!currentUserProfileId && !error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Loading profile...</Text>
      </View>
    );
  }
  
  // Error State (covers profile loading errors too)
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

  // Loading state - show a nice loading indicator
  if (isLoadingMessages || !currentUserProfileId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ 
          headerShown: true,
          headerStyle: { backgroundColor: colors.cardBackground },
          headerTintColor: colors.text,
          headerTitle: "Perplexity",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }} />
        
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textSecondary, marginTop: 16, fontFamily: 'Inter-Medium' }}>
            Loading conversation...
          </Text>
        </View>
      </View>
    );
  }

  // Conversation not found (implies loading phases passed without setting conversation, and no specific error string)
  // For Perplexity, conversation should always be set by the useEffect hook.
  // This condition might still be hit if setConversation fails or is delayed unexpectedly.
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

  // This effect should primarily react to `params` and `currentUserProfileId`, `isGeneratingResponse`.
  // `autoSendAttempted` prevents re-running for the *same instance* of params if other deps change.
  // If params themselves change (e.g. user navigates with new prefillMessage), autoSendAttempted should allow it.
  // So, autoSendAttempted should be reset if `params.prefillMessage` changes.
  // This logic is getting complicated. Let's simplify.
  // The effect runs if prefillMessage is present. If sent, clear params. If not, user can send manually.
  // }, [params, currentUserProfileId, isGeneratingResponse, autoSendAttempted, router]); // handleSend, setTextMessage, setAttachedStock are stable from useCallback/useState
  
  // Reset autoSendAttempted if prefillMessage is no longer present or changes
  // useEffect(() => {
  //     if (!params.prefillMessage) {
  //         setAutoSendAttempted(false);
  //     }
  // }, [params.prefillMessage]);

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
            onPress={handleProfileNavigation}
            disabled={true}
          >
            <Image source={require('@/assets/perplexity.jpg')} style={styles.avatar} />
            
            <View>
              <Text style={[styles.name, { color: colors.text }]}>
                {conversation?.name || 'Perplexity'}
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
          
          // Ensure truly unique key even if IDs have duplicates 
          const uniqueKey = `message-${msg.id}-${index}-${Math.random().toString(36).substring(2, 7)}`;
          
          // Check if this is the currently streaming message
          const isStreaming = streamingMessage && msg.id === streamingMessage.id;

          return (
            <View key={uniqueKey}>
              {isFirstInGroup && (
                <View style={styles.dateContainer} key={`date-${index}-${Math.random().toString(36).substring(2, 7)}`}>
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
                  (msg.type === 'article' || msg.type === 'stock') && { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' },
                  // Add subtle animation indicator for streaming
                  (msg.is_streaming === true) && { borderWidth: 1, borderColor: colors.accent + '50' }
                ]}
              >
                {msg.type === 'text' && (
                  <>
                    {msg.is_streaming === true && (msg.content as string).length === 0 ? (
                      <TypingIndicator />
                    ) : (
                      <FormattedTextMessage
                        text={msg.content as string}
                        baseTextStyle={[styles.messageText, { color: colors.text }]}
                        headingStyle={styles.headingText}
                        boldStyle={styles.boldText}
                      />
                    )}
                    <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                      {msg.timestamp.split(' | ')[0]} {/* Time part */}
                      {(msg.is_streaming === true) && " • typing..."}
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
              disabled={!!attachedArticle || !!attachedStock || isGeneratingResponse} // Disable when generating response
            >
              <Paperclip size={20} color={
                (!!attachedArticle || !!attachedStock || isGeneratingResponse) 
                  ? colors.border 
                  : colors.textSecondary
              } />
            </TouchableOpacity>
            <TextInput
              style={[
                styles.input, 
                { 
                  backgroundColor: colors.background,
                  color: colors.text,
                }
              ]}
              placeholder={(attachedArticle || attachedStock) ? "Type a message..." : "Ask Perplexity anything..."}
              placeholderTextColor={colors.textSecondary}
              value={textMessage}
              onChangeText={handleTextInputChange}
              multiline
              editable={!isGeneratingResponse} // Disable input while generating response
            />
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                { backgroundColor: (textMessage.trim() || attachedArticle || attachedStock) ? colors.accent : colors.accent + '40' }
              ]}
              onPress={handleSend}
              disabled={(!textMessage.trim() && !attachedArticle && !attachedStock) || isGeneratingResponse}
            >
              {isGeneratingResponse ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Send size={18} color={(textMessage.trim() || attachedArticle || attachedStock) ? "#444" : "white"} />
              )}
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
    maxWidth: '90%',
    paddingVertical: 10,
    paddingHorizontal: 16,
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
  boldText: {
    fontFamily: 'Inter-Bold',
  },
  headingText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18, // Example size, adjust as needed
    marginVertical: 5,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
}); 