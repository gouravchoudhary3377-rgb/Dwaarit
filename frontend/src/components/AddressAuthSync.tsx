// Bridges AuthContext -> addressStore so address book stays in sync with login state.
import { useEffect } from 'react';

import { useAuth } from '@/src/context/AuthContext';
import { useAddressStore } from '@/src/store/addressStore';

export function AddressAuthSync() {
  const { token } = useAuth();
  const setAuthToken = useAddressStore((s) => s.setAuthToken);

  useEffect(() => {
    setAuthToken(token ?? null);
  }, [token, setAuthToken]);

  return null;
}
