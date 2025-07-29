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
import { ArrowLeft, Paperclip, Send } from 'lucide-react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { Conversation, RichMessage } from '@/types/chat';
import { Message as DbMessage } from '@/types/chat';
import { Article } from '@/types/news';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

type ChatDetailScreenProps = {
  conversation: Conversation;
  onBack: () => void;
  currentUserProfileId: string | null;
};

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

export default function ChatDetailScreen({ conversation, onBack, currentUserProfileId }: ChatDetailScreenProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [textMessage, setTextMessage] = useState('');
  const [messages, setMessages] = useState<RichMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messageError, setMessageError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const mapDbMessageToRichMessage = useCallback((dbMsg: DbMessage & { sender: any /* Profile of sender */ }): RichMessage | null => {
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
            created_at: '', 
            summary: '',    
            link: '',       
            categories: [],  
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
      // Assuming dbMsg.content for stock might be a symbol or name, 
      // and reference_id could be a stock ID.
      // For now, let's adapt the existing simplified display for stock.
      // This might need a similar detailed object if stock messages become richer.
      return {
        ...commonProps,
        content: `Shared stock: ${dbMsg.content || 'Details unavailable'}`, // Simplified for now
        type: 'text', // Keeping as 'text' for now, or change to 'stock' if UI handles it
      };
    }
    return null;
  }, [currentUserProfileId]);

  useEffect(() => {
    if (!conversation.friendship_id || !currentUserProfileId) {
      setIsLoadingMessages(false);
      return;
    }
    setIsLoadingMessages(true);
    setMessageError(null);

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
            sender:sender_id (id, user_id, username, name, profile_picture_url)
          `)
          .eq('friendship_id', conversation.friendship_id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        const richMessages = data
          .map(dbMsg => mapDbMessageToRichMessage(dbMsg as any))
          .filter(msg => msg !== null) as RichMessage[];
        setMessages(richMessages);
      } catch (err: any) {
        console.error('Error fetching messages:', err);
        setMessageError('Failed to load messages.');
      } finally {
        setIsLoadingMessages(false);
      }
    };
    fetchMessages();

    const channel = supabase
      .channel(`messages:${conversation.friendship_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `friendship_id=eq.${conversation.friendship_id}` },
        async (payload) => {
          const newMessageId = (payload.new as DbMessage).id;
          const { data: newMessageData, error: fetchError } = await supabase
            .from('messages')
            .select(`*, sender:sender_id (*)`)
            .eq('id', newMessageId)
            .single();

          if (fetchError || !newMessageData) {
            console.error('Error fetching new message details:', fetchError);
            return;
          }

          const richMessage = mapDbMessageToRichMessage(newMessageData as any);
          if (richMessage) {
            setMessages((prevMessages) => [...prevMessages, richMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.friendship_id, currentUserProfileId, mapDbMessageToRichMessage]);

  const handleSend = async () => {
    if (textMessage.trim() && currentUserProfileId) {
      const tempMessageId = `temp-${Date.now()}`;
      const richMessage: RichMessage = {
        id: tempMessageId,
        content: textMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMine: true,
        type: 'text',
      };
      setMessages(prev => [...prev, richMessage]);

      const { error } = await supabase.from('messages').insert({
        friendship_id: conversation.friendship_id,
        sender_id: currentUserProfileId,
        content: textMessage.trim(),
        message_type: 'text',
      });

      setTextMessage('');

      if (error) {
        console.error('Error sending message:', error);
        setMessageError('Failed to send message.');
        setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
      }
    }
  };

  // Function to navigate to user's profile
  const navigateToUserProfile = () => {
    if (conversation.user_id) {
      router.push(`/user/${conversation.user_id}`);
    }
  };

  if (isLoadingMessages) {
    return <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}><ActivityIndicator color={colors.accent} size="large"/><Text style={{color: colors.textSecondary, marginTop: 10}}>Loading messages...</Text></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{backgroundColor: colors.cardBackground}}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.profileContainer}
            onPress={navigateToUserProfile}
            disabled={!conversation.user_id}
          >
            {conversation.avatar ? (
              <Image source={{ uri: conversation.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.initialsAvatar, { backgroundColor: colors.accent + '30' }]}>
                <Text style={[styles.initialsText, { color: colors.accent }]}>
                  {getInitials(conversation.name)}
                </Text>
              </View>
            )}
            <View>
              <Text style={[styles.name, { color: colors.text }]}>
                {conversation.name}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({animated: true})}
        contentInset={{ bottom: 70 }}
        contentOffset={{ x: 0, y: -70 }}
      >
        {messages.length === 0 && !isLoadingMessages && !messageError && (
          <View style={styles.centeredMessageContainer}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Send a message to start a chat!</Text>
          </View>
        )}
        {messageError && (
            <View style={styles.centeredMessageContainer}>
                <Text style={{ color: colors.error }}>{messageError}</Text>
            </View>
        )}
        {messages.map((msg: RichMessage, index: number) => {
          const isFirstInGroup = index === 0 || 
            (messages[index - 1] && messages[index - 1].timestamp.split(' | ')[1] !== msg.timestamp.split(' | ')[1]);
            
          const articleContent = msg.type === 'article' ? msg.content as Article : null;

          return (
            <View key={msg.id}>
              {isFirstInGroup && (
                <View style={styles.dateContainer}>
                  <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                    {msg.timestamp.split(' | ')[1]}
                  </Text>
                </View>
              )}
              
              <Animated.View
                entering={SlideInRight.duration(300).delay(index * 50)}
                style={[
                  styles.messageBubble,
                  msg.isMine 
                    ? [styles.myMessage, { backgroundColor: colors.accent + '30' }] 
                    : [styles.theirMessage, { backgroundColor: colors.cardBackground }],
                  msg.type === 'article' && { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' } 
                ]}
              >
                {msg.type === 'text' && (
                  <>
                    <Text style={[styles.messageText, { color: colors.text }]}>
                        {msg.content as string}
                    </Text>
                    <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                      {msg.timestamp.split(' | ')[0]}
                    </Text>
                  </>
                )}
                {msg.type === 'article' && articleContent && (
                  <View style={[styles.articleShare, msg.isMine ? { alignSelf: 'flex-end'} : {}]}>
                    {msg.article_image_url && (
                      <Image 
                        source={{ uri: msg.article_image_url }}
                        style={styles.articleImage} 
                        resizeMode="cover"
                      />
                    )}
                    <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                      <Text style={[styles.articleTitle, { color: colors.text }]} numberOfLines={2}>
                        {articleContent.title}
                      </Text>
                      <Text style={[styles.timestamp, { color: colors.textSecondary, marginTop: 4 }]}>
                        {msg.timestamp.split(' | ')[0]}
                      </Text>
                    </View>
                  </View>
                )}
                {/* TODO: Add rendering for 'stock' type messages if different from text */}
              </Animated.View>
            </View>
          );
        })}
      </ScrollView>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity style={styles.attachButton}>
            <Paperclip size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.input, 
              { 
                backgroundColor: colors.background,
                color: colors.text 
              }
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={textMessage}
            onChangeText={setTextMessage}
            multiline
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              { backgroundColor: textMessage.trim() ? colors.accent : colors.accent + '40' }
            ]}
            onPress={handleSend}
            disabled={!textMessage.trim()}
          >
            <Send size={18} color={textMessage.trim() ? "#444" : "white"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    fontFamily: 'Inter-Medium',
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
    paddingVertical: 8,
    borderTopWidth: 1,
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
  stockShare: { width: 240 },
  stockBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  stockSymbol: { fontFamily: 'Inter-Bold', fontSize: 14 },
  stockName: { fontFamily: 'Inter-Medium', fontSize: 16, marginBottom: 4 },
  stockPrice: { fontFamily: 'Inter-Bold', fontSize: 16, marginBottom: 12 },
  stockActionButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  stockActionText: { fontFamily: 'Inter-Medium', fontSize: 14, color: 'white' },
  articleShare: { width: 240 },
  articleImage: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8 },
  articleTitle: { fontFamily: 'Inter-Medium', fontSize: 16, marginBottom: 12 },
});