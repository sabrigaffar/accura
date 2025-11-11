import * as Haptics from 'expo-haptics';

export function useHaptics() {
  const impactLight = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  };
  const impactMedium = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  };
  const impactHeavy = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  };
  const selection = () => {
    try { Haptics.selectionAsync(); } catch {}
  };
  const success = () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  };
  const error = () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  };

  return { impactLight, impactMedium, impactHeavy, selection, success, error };
}
