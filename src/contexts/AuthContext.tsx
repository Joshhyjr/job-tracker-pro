import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FirebaseError } from "firebase/app";
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

function getAuthErrorMessage(error: unknown, action = "Google sign-in"): string {
  // Network failures are recoverable; give users a retry path without exposing SDK internals.
  if (error instanceof FirebaseError && error.code === "auth/network-request-failed") {
    return `${action} could not reach Firebase. Check your connection and browser blocking settings, then retry.`;
  }
  // Firebase reports blocked helper frames and API requests as an internal error, so surface a deploy-actionable message.
  if (error instanceof FirebaseError && error.code === "auth/internal-error") {
    return "Google sign-in could not start. Verify the deployed Firebase settings and Content Security Policy, then retry.";
  }
  return error instanceof Error ? error.message : "Google sign-in failed. Please retry.";
}

function logAuthError(action: string, error: unknown) {
  // Provider errors can contain account details, so log only the diagnostic code.
  const code = error instanceof FirebaseError && /^auth\/[a-z-]+$/.test(error.code)
    ? error.code
    : "auth/unknown";
  console.error(`[firebase-auth] ${action}`, code);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(isFirebaseConfigured ? "" : "Firebase is not configured for this deployment.");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    try {
      const auth = getFirebaseAuth();
      // Keep the observer synchronous: Firebase does not await promises returned by listeners.
      return onAuthStateChanged(auth, (nextUser) => {
        if (nextUser && nextUser.email?.toLowerCase() !== ALLOWED_EMAIL) {
          // Deny local access immediately, even if clearing the Firebase session fails.
          setUser(null);
          setError(`Access is restricted to ${ALLOWED_EMAIL}.`);
          void firebaseSignOut(auth).catch((signOutError: unknown) => {
            logAuthError("Restricted session cleanup failed", signOutError);
            setError(`Access is restricted to ${ALLOWED_EMAIL}. ${getAuthErrorMessage(signOutError, "Session cleanup")}`);
          });
        } else {
          setUser(nextUser);
          setError("");
        }
        setLoading(false);
      });
    } catch (initializationError) {
      // Leave the public app usable if local auth initialization cannot complete.
      logAuthError("Session initialization failed", initializationError);
      setError(getAuthErrorMessage(initializationError, "Session initialization"));
      setLoading(false);
    }
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
        logAuthError("Google sign-in failed", signInError);
        setError(getAuthErrorMessage(signInError));
      }
    },
    signOut: async () => {
      if (!isFirebaseConfigured) return;
      setError("");
      try {
        await firebaseSignOut(getFirebaseAuth());
      } catch (signOutError) {
        // Menu handlers discard this promise, so report failures here and preserve the active session.
        logAuthError("Sign-out failed", signOutError);
        setError(getAuthErrorMessage(signOutError, "Sign-out"));
      }
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
