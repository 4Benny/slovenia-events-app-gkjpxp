import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://viatqtevcpvhnmqvzwvd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYXRxdGV2Y3B2aG5tcXZ6d3ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjI0NTksImV4cCI6MjA4NDk5ODQ1OX0.8OvA64ESioGuc7_QCplQLbqNH12Y0jnNiRQ6NzDYvTY";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

