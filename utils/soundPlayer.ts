import { Audio, AVPlaybackStatus } from 'expo-av';

let sound: Audio.Sound | null = null;

/**
 * تشغيل صوت تنبيه عند وصول طلب جديد
 */
export const playNotificationSound = async () => {
  try {
    // إيقاف الصوت القديم إن وجد
    if (sound) {
      await sound.unloadAsync();
    }

    // تحميل الصوت من assets
    const { sound: newSound } = await Audio.Sound.createAsync(
      require('../assets/sounds/notification.mp3'),
      { shouldPlay: true, volume: 1.0 }
    );
    
    sound = newSound;

    // تنظيف بعد انتهاء التشغيل
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        sound?.unloadAsync();
        sound = null;
      }
    });
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

/**
 * إيقاف الصوت
 */
export const stopNotificationSound = async () => {
  try {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      sound = null;
    }
  } catch (error) {
    console.error('Error stopping sound:', error);
  }
};

/**
 * ضبط مستوى الصوت
 */
export const setVolume = async (volume: number) => {
  try {
    if (sound) {
      await sound.setVolumeAsync(volume);
    }
  } catch (error) {
    console.error('Error setting volume:', error);
  }
};
