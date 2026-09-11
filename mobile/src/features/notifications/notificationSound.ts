import { AppState, Platform } from "react-native";
import { createAudioPlayer } from "expo-audio";
const notificationSound = require("../../../assets/notification_sound/universfield-new-notification-051-494246.mp3");

let lastPlayed = -Infinity;
let stopCurrent: (() => void) | null = null;

export function stopNotificationSound() {
  stopCurrent?.();
}

/** Call only AFTER recipient, mute and event-deduplication checks. */
export function playNotificationSound() {
  if (Platform.OS === "web" || AppState.currentState !== "active") return;
  const now = Date.now();
  if (now - lastPlayed < 1000) return; // Shared burst limit across chat, Blog and general notices.
  lastPlayed = now;
  stopNotificationSound();
  try {
    const player = createAudioPlayer(notificationSound, { updateInterval: 100 });
    let disposed = false;
    let started = false;
    let statusListener: { remove(): void } | undefined;
    let stateListener: { remove(): void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      statusListener?.remove();
      stateListener?.remove();
      try { player.remove(); } catch { /* Already released by native runtime. */ }
      if (stopCurrent === stop) stopCurrent = null;
    };
    stopCurrent = stop;
    const play = () => {
      if (disposed || started) return;
      if (AppState.currentState !== "active") { stop(); return; }
      started = true;
      try {
        player.volume = 0.65;
        player.play();
      } catch { stop(); }
    };
    // Do not change the app-wide audio mode (voice recording and media playback also use it).
    statusListener = player.addListener("playbackStatusUpdate", status => {
      if (status.didJustFinish) stop();
      else if (status.isLoaded) play();
    });
    stateListener = AppState.addEventListener("change", state => { if (state !== "active") stop(); });
    timer = setTimeout(stop, 10000); // Loading watchdog; allow the full 2.46-second supplied clip to finish.
    if (player.isLoaded) play();
  } catch {
    stopNotificationSound(); // Audio must never prevent notification delivery.
  }
}
