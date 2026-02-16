
import { supabase } from "@/app/integrations/supabase/client";

/**
 * Supabase Auth Helpers
 * 
 * This file contains utility functions for Supabase authentication.
 * All authentication is handled through Supabase Auth.
 */

/**
 * Sign up with email and password
 * Triggers email verification flow
 */
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "https://natively.dev/email-confirmed",
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign in with email and password
 * Requires email to be verified
 */
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Verify email with OTP code
 */
export async function verifyOTP(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    type: "email",
    email,
    token,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}
