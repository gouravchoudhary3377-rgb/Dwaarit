/**
 * Firebase Phone Authentication utility.
 * On native (iOS/Android): uses @react-native-firebase/auth.
 * On web: gracefully degrades (phone auth requires native build).
 */
import { Platform } from 'react-native';

export type PhoneConfirmation = {
  confirm: (otp: string) => Promise<string>; // returns Firebase idToken
};

// ---- Native (iOS / Android) ----
let nativeAuth: any = null;

function getNativeAuth() {
  if (Platform.OS === 'web') return null;
  if (nativeAuth) return nativeAuth;
  try {
    // Dynamically required so Metro doesn't break the web bundle
    const rnfb = require('@react-native-firebase/auth');
    nativeAuth = rnfb.default ? rnfb.default() : rnfb();
    return nativeAuth;
  } catch {
    return null;
  }
}

/**
 * Send OTP via Firebase Phone Auth.
 * Returns a PhoneConfirmation whose `.confirm(otp)` resolves to the Firebase idToken.
 */
export async function sendFirebaseOtp(phoneE164: string): Promise<PhoneConfirmation> {
  if (Platform.OS === 'web') {
    throw new Error('Firebase Phone Auth is not available on web. Please use the mobile app.');
  }

  const auth = getNativeAuth();
  if (!auth) {
    throw new Error('Firebase Auth module could not be loaded. Ensure you are running a dev build.');
  }

  const confirmation = await auth.signInWithPhoneNumber(phoneE164);

  return {
    confirm: async (otp: string): Promise<string> => {
      const result = await confirmation.confirm(otp);
      const idToken: string = await result.user.getIdToken();
      return idToken;
    },
  };
}

/** Sign out from Firebase (call on app sign-out). */
export async function firebaseSignOut(): Promise<void> {
  if (Platform.OS === 'web') return;
  const auth = getNativeAuth();
  if (auth) {
    try { await auth.signOut(); } catch { /* ignore */ }
  }
}
