import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'dwaarit:admin_muted';

/**
 * useMuteToggle — persisted boolean for muting all in-app alert sounds.
 * Used by the admin dashboard header to silence the new-order alarm.
 */
export function useMuteToggle() {
  const [muted, setMuted] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === '1') setMuted(true);
      hydratedRef.current = true;
    });
  }, []);

  function toggle() {
    setMuted((prev) => {
      const next = !prev;
      AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }

  function set(value: boolean) {
    setMuted(value);
    AsyncStorage.setItem(KEY, value ? '1' : '0').catch(() => {});
  }

  return { muted, toggle, set };
}
