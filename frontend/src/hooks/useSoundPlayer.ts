import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

/**
 * useSoundPlayer
 * Lightweight wrapper around expo-audio. Loads three sounds bundled with the
 * app once, exposes imperative `play` and `loop` helpers, and supports a
 * global mute flag.
 *
 * NOTE: All asset requires are static so Metro can bundle them.
 */

const SOURCES = {
  newOrder: require('../../assets/sounds/new-order.mp3'),
  accepted: require('../../assets/sounds/accepted.mp3'),
  delivered: require('../../assets/sounds/delivered.mp3'),
} as const;

export type SoundKey = keyof typeof SOURCES;

let initialized = false;
async function ensureAudioMode() {
  if (initialized) return;
  initialized = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
  } catch {
    // ignore — web fallback
  }
}

type Players = Record<SoundKey, AudioPlayer>;

export function useSoundPlayer(muted: boolean = false) {
  const playersRef = useRef<Players | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lazily create players once (and only on native / browsers that support it)
  const players = useMemo<Players | null>(() => {
    if (playersRef.current) return playersRef.current;
    try {
      const built: Players = {
        newOrder: createAudioPlayer(SOURCES.newOrder),
        accepted: createAudioPlayer(SOURCES.accepted),
        delivered: createAudioPlayer(SOURCES.delivered),
      };
      playersRef.current = built;
      return built;
    } catch (e) {
      console.warn('useSoundPlayer init failed', e);
      return null;
    }
  }, []);

  useEffect(() => {
    ensureAudioMode();
    return () => {
      if (loopTimerRef.current) {
        clearInterval(loopTimerRef.current);
        loopTimerRef.current = null;
      }
      // Players are kept alive across hook unmounts intentionally; release on
      // app close handled by RN GC. expo-audio releases automatically when the
      // JS object is GC'd.
    };
  }, []);

  function play(key: SoundKey) {
    if (muted || !players) return;
    const p = players[key];
    try {
      // seekTo(0) then play; works for repeated triggers
      p.seekTo(0);
      p.play();
    } catch (e) {
      // Web sometimes requires user gesture — silently ignore
      if (Platform.OS === 'web') return;
      console.warn('sound play failed', key, e);
    }
  }

  /**
   * Loops a sound every `intervalMs` until `stopLoop()` is called or `active`
   * flips to false. The first beep fires immediately.
   */
  function startLoop(key: SoundKey, intervalMs: number = 6000) {
    stopLoop();
    if (muted) return;
    play(key);
    loopTimerRef.current = setInterval(() => play(key), intervalMs);
  }

  function stopLoop() {
    if (loopTimerRef.current) {
      clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }

  return { play, startLoop, stopLoop };
}
