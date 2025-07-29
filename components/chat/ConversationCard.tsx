import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Conversation } from '@/types/chat';

// Helper function to get initials
const getInitials = (name: string): string => {
  if (!name) return '';
  return name
    .split(' ')
    .map(part => part[0])
    .filter(initial => !!initial)
    .join('')
    .toUpperCase()
    .substring(0, 2); // Max 2 initials
};

type ConversationCardProps = {
  conversation: Conversation;
  onPress: () => void;
};

export default function ConversationCard({ conversation, onPress }: ConversationCardProps) {
  const { colors } = useTheme();
  
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <TouchableOpacity 
        onPress={onPress}
        style={[styles.card, { backgroundColor: colors.cardBackground }]}
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
        
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.name, { color: colors.text }]}>
              {conversation.name}
            </Text>
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {conversation.lastMessageTime}
            </Text>
          </View>
          
          <View style={styles.bottomRow}>
            <Text 
              style={[
                styles.message, 
                conversation.unread ? { color: colors.text } : { color: colors.textSecondary },
                { flex: 1 }
              ]}
              numberOfLines={1}
            >
              {conversation.lastMessage}
            </Text>
            
            {conversation.unread ? (
              <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.unreadCount}>
                  {conversation.unreadCount}
                </Text>
              </View>
            ) : (
              <View style={styles.readStatus} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: 'white',
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  readStatus: {
    width: 20,
    alignItems: 'center',
  },
  initialsAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
  },
});