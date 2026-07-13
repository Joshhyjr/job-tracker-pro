import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

export const ALLOWED_EMAIL = "joshuakivaria@gmail.com";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(isFirebaseConfigured ? "" : "Firebase is not configured for this deployment.");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const auth = getFirebaseAuth();

    // The observer is the single source of truth for restored and newly created auth sessions.
    return onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser && nextUser.email?.toLowerCase() !== ALLOWED_EMAIL) {
        await firebaseSignOut(auth);
        setUser(null);
        setError(`Access is restricted to ${ALLOWED_EMAIL}.`);
      } else {
        setUser(nextUser);
        setError("");
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    signInWithGoogle: async () => {
      if (!isFirebaseConfigured) {
        setError("Add the Firebase environment variables before signing in.");
        return;
      }
      setError("");
      try {
        const auth = getFirebaseAuth();
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        if (result.user.email?.toLowerCase() !== ALLOWED_EMAIL) {
          await firebaseSignOut(auth);
          setError(`Access is restricted to ${ALLOWED_EMAIL}.`);
        }
      } catch (signInError) {
        // Popup cancellation and provider failures should remain recoverable from the login screen.
        setError(signInError instanceof Error ? signInError.message : "Google sign-in failed. Please retry.");
      }
    },
    signOut: async () => {
      if (isFirebaseConfigured) await firebaseSignOut(getFirebaseAuth());
    },
  }), [error, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The hook intentionally shares this module with its provider so consumers cannot import the raw context.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
