
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aeuvfzwqrmgcabaxesbm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Il5T_drDNYK77iOyxjy_bw_7XRtp7u_';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
