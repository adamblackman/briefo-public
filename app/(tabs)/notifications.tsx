import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Notification } from '@/types/notifications';
import NotificationItem from '@/components/notifications/NotificationItem';

// Header for the Notifications screen
function NotificationsHeader() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }}>
      <View style={styles.headerContainer}>
        <Image 
          source={require('@/assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </SafeAreaView>
  );
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setNotifications([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }
      setNotifications(data || []);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );
  
  const handleNotificationPress = (notification: Notification) => {
    // TODO: Implement navigation to the related item
    // TODO: Mark notification as read
    // For now, let's refetch to simulate a change if we were marking as read
    // if (!notification.is_read) {
    //   markAsRead(notification.id);
    // }
  };
  
  // Function to mark notification as read (example, call this on press)
  // const markAsRead = async (notificationId: string) => {
  //   try {
  //     const { error } = await supabase
  //       .from('notifications')
  //       .update({ is_read: true })
  //       .eq('id', notificationId)
  //       .eq('user_id', user?.id);
      
  //     if (error) throw error;
  //     // Refresh list or update item locally
  //     fetchNotifications(); 
  //   } catch (err) {
  //     console.error('Error marking notification as read:', err);
  //   }
  // };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <NotificationsHeader />
        <View style={styles.centeredMessageContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <NotificationsHeader />
        <View style={styles.centeredMessageContainer}>
          <Text style={[styles.noNotificationsText, { color: colors.error }]}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <NotificationsHeader />
      {notifications.length === 0 ? (
        <View style={styles.centeredMessageContainer}>
          <Text style={[styles.noNotificationsText, { color: colors.textSecondary }]}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={({ item }) => (
            <NotificationItem notification={item} onPress={handleNotificationPress} />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 50, 
  },
  logo: {
    width: 100,
    height: 40,
  },
  centeredMessageContainer: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 20,
  },
  noNotificationsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 18,
  },
}); 