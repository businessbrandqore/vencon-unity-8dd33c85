import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export const initPushNotifications = async (userId?: string) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('Push notification permission denied');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration token:', token.value);
      
      // Store push token in user profile for sending notifications
      if (userId) {
        await supabase.from('users').update({
          gps_location: token.value // Using gps_location field to store push token temporarily
        }).eq('id', userId);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification tapped:', notification);
      // Handle deep linking based on notification data
      const data = notification.notification.data;
      if (data?.route) {
        window.location.href = data.route;
      }
    });
  } catch (error) {
    console.log('Push notifications not available:', error);
  }
};
