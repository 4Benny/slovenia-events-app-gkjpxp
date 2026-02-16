
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { supabase } from "@/app/integrations/supabase/client";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const listenerRegistered = useRef(false);
  const roleLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isAbortErrorLike = (err: any): boolean => {
    const name = String(err?.name || "");
    const message = String(err?.message || "");
    const details = String(err?.details || "");
    return (
      name === "AbortError" ||
      message.includes("AbortError") ||
      message.toLowerCase().includes("aborted") ||
      details.toLowerCase().includes("aborted")
    );
  };

  // Fetch role ONCE after session is ready
  useEffect(() => {
    if (!user || roleLoadedRef.current) {
      return;
    }

    const fetchRole = async () => {
      // Abort any previous fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      // Don't permanently lock out retries until we have a stable result.
      roleLoadedRef.current = false;

      try {
        let query = supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        query = (query as any).abortSignal(abortControllerRef.current.signal);

        const { data: profile, error } = await query;

        if (error) {
          if (isAbortErrorLike(error)) return;
          // Transient errors should be retryable.
          console.error("[AuthContext] Role fetch error:", error);
          setUserRole('user');
          return;
        }

        // If profile doesn't exist yet (e.g. user hasn't completed onboarding),
        // default to 'user' and avoid noisy errors.
        const role = profile?.role ?? 'user';
        setUserRole(role);
        roleLoadedRef.current = true;
      } catch (err: any) {
        if (isAbortErrorLike(err)) return;
        console.error("[AuthContext] Role fetch failed:", err);
        setUserRole('user');
      }
    };

    fetchRole();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user]);

  useEffect(() => {
    // Prevent multiple listener registrations
    if (listenerRegistered.current) {
      return;
    }
    
    listenerRegistered.current = true;

    // Get initial session ONCE
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("[AuthContext] Error getting initial session:", error);
          setSession(null);
          setUser(null);
        } else {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        }
      } catch (error) {
        console.error("[AuthContext] Failed to initialize auth:", error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Register SINGLE auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
      // Only update state for meaningful events, ignore TOKEN_REFRESHED to prevent loops
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Reset role when user changes
        if (event === 'SIGNED_OUT') {
          setUserRole(null);
          roleLoadedRef.current = false;
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
          roleLoadedRef.current = false;
        }
        
        if (event === 'INITIAL_SESSION') {
          setLoading(false);
        }
      }
    });

    // Cleanup function - unsubscribe on unmount
    return () => {
      subscription.unsubscribe();
      listenerRegistered.current = false;
    };
  }, []); // Empty dependency array - run ONCE on mount

  const refreshSession = async () => {
    try {
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("[AuthContext] Error refreshing session:", error);
        return;
      }
      
      setSession(refreshedSession);
      setUser(refreshedSession?.user ?? null);
    } catch (error) {
      console.error("[AuthContext] Failed to refresh session:", error);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("[AuthContext] Sign out error:", error);
      }
    } catch (error) {
      console.error("[AuthContext] Sign out failed:", error);
    } finally {
      // Always clear local state immediately for ONE CLICK OUT
      setUser(null);
      setSession(null);
      setUserRole(null);
      roleLoadedRef.current = false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        userRole,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
