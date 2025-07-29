import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Notification, NotificationType } from '@/types/notifications'; // Make sure this path is correct
import { formatDistanceToNowStrict } from 'date-fns';
import { useRouter } from 'expo-router';
import {
  Newspaper, // For SUGGESTED_NEWS
  MessageSquare, // For MESSAGE
  UserPlus, // For FRIEND_REQUEST
  AtSign, // For TAGGED_COMMENT
  AlertCircle, // Fallback
  UserCheck, // For ACCEPTED_REQUEST
} from 'lucide-react-native';

interface NotificationItemProps {
  notification: Notification;
  onPress?: (notification: Notification) => void;
}

const ICON_SIZE = 24;

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onPress }) => {
  const { colors } = useTheme();
  const router = useRouter();

  const getIcon = () => {
    switch (notification.notification_type) {
      case NotificationType.SUGGESTED_NEWS:
        return <Newspaper size={ICON_SIZE} color={colors.accent} />;
      case NotificationType.MESSAGE:
        return <MessageSquare size={ICON_SIZE} color={colors.accent} />;
      case NotificationType.FRIEND_REQUEST:
        return <UserPlus size={ICON_SIZE} color={colors.accent} />;
      case NotificationType.TAGGED_COMMENT:
        return <AtSign size={ICON_SIZE} color={colors.warning} />;
      case NotificationType.ACCEPTED_REQUEST:
        return <UserCheck size={ICON_SIZE} color={colors.accent} />;
      default:
        return <AlertCircle size={ICON_SIZE} color={colors.textSecondary} />;
    }
  };

  const timeAgo = notification.created_at
    ? formatDistanceToNowStrict(new Date(notification.created_at), { addSuffix: true })
    : '';

  const renderNotificationContent = () => {
    if (notification.notification_type === NotificationType.SUGGESTED_NEWS) {
      let articleTitle = notification.message_preview || '';
      if (articleTitle.startsWith('Suggested Article: ')) {
        articleTitle = articleTitle.substring('Suggested Article: '.length);
      }
      return (
        <>
          <Text style={[styles.notificationTypeBold, { color: colors.text }]}>
            Suggested Article
          </Text>
          <Text style={[styles.notificationContentRegular, { color: colors.text }]} numberOfLines={2}>
            {articleTitle}
          </Text>
        </>
      );
    } else if (notification.notification_type === NotificationType.MESSAGE) {
      let senderName = 'New Message';
      let messageContent = notification.message_preview || '';
      const parts = (notification.message_preview || '').split(': ');
      if (parts.length > 1) {
        senderName = parts[0];
        messageContent = parts.slice(1).join(': ');
      } else {
        // Fallback if parsing fails, show the whole preview as content
        messageContent = notification.message_preview || 'Sent you a message';
        senderName = 'Chat Message' // Or derive from a known source if available
      }
      return (
        <>
          <Text style={[styles.notificationTypeBold, { color: colors.text }]}>
            {senderName}
          </Text>
          <Text style={[styles.notificationContentRegular, { color: colors.text }]} numberOfLines={2}>
            {messageContent}
          </Text>
        </>
      );
    } else if (notification.notification_type === NotificationType.FRIEND_REQUEST) {
        // Assuming message_preview is already like "[Sender Name] sent you a friend request."
        // We just display it directly here, the navigation part handles going to the user profile.
         return (
          <Text style={[styles.messageDefault, { color: colors.text }]} numberOfLines={2}>
            {notification.message_preview || 'Friend Request'}
          </Text>
        );
    } else if (notification.notification_type === NotificationType.ACCEPTED_REQUEST) {
      // Assuming message_preview is like "[Accepter's Name] accepted your friend request."
      // Extract accepter's name for bolding
      let accepterName = "Someone";
      let restOfTheMessage = "accepted your friend request.";
      if (notification.message_preview) {
        const parts = notification.message_preview.split(" accepted your friend request.");
        if (parts.length > 0 && parts[0]) {
          accepterName = parts[0];
        }
      }
      return (
        <>
          <Text style={[styles.notificationTypeBold, { color: colors.text }]}>
            {accepterName}
          </Text>
          <Text style={[styles.notificationContentRegular, { color: colors.text }]} numberOfLines={2}>
            {restOfTheMessage}
          </Text>
        </>
      );
    }
    
    // Default for other notification types (e.g. TAGGED_COMMENT)
    return (
      <Text style={[styles.messageDefault, { color: colors.text }]} numberOfLines={2}>
        {notification.message_preview || 'Notification'}
      </Text>
    );
  };

  const handlePress = () => {
    if (onPress) {
      onPress(notification);
    }

    if (notification.notification_type === NotificationType.SUGGESTED_NEWS && 
        notification.related_item_id && 
        notification.related_item_source === 'news') {
      router.push(`/article/${notification.related_item_id}`);
    } else if (notification.notification_type === NotificationType.MESSAGE &&
               notification.related_item_id &&
               notification.related_item_source === 'chats') {
      router.push(`/(chat)/${notification.related_item_id}`);
    } else if (notification.notification_type === NotificationType.FRIEND_REQUEST &&
               notification.related_item_id && // This ID should now be the sender's auth_users.id
               notification.related_item_source === 'friend_requests') {
      router.push(`/user/${notification.related_item_id}`); 
    } else if (notification.notification_type === NotificationType.ACCEPTED_REQUEST &&
               notification.related_item_id && // This ID should be the accepter's auth_users.id
               notification.related_item_source === 'users') {
      router.push(`/user/${notification.related_item_id}`);
    }
    // Add other navigation handlers here
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
        notification.is_read ? styles.read : styles.unread
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>{getIcon()}</View>
      <View style={styles.contentContainer}>
        {renderNotificationContent()}
        <Text style={[styles.time, { color: colors.textSecondary }]}>{timeAgo}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 10,
  },
  unread: {
    // Optionally add distinct styling for unread items, e.g., a bolder border or a dot
  },
  read: {
    opacity: 0.7, // Example: Dim read notifications slightly
  },
  iconContainer: {
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  messageDefault: { // Renamed from 'message' to avoid conflict
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    marginBottom: 4,
  },
  notificationTypeBold: { // Replaces 'notificationType' and for sender name
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    marginBottom: 2,
  },
  notificationContentRegular: { // Replaces 'articleTitle' and for message content
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginBottom: 4,
  },
  time: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
});

export default NotificationItem; 