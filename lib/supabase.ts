import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// EAS builds from a clean git checkout, so .env never reaches the cloud builder.
// The values live in eas.json's env blocks (both are public). Fail loudly instead
// of crashing natively if they are ever missing (the Totality Nutrition 1.0.0 (8) lesson).
if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. Check eas.json or .env.');
}

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only the web build can read a session out of an emailed link.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
