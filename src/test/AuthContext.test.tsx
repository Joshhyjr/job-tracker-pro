import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALLOWED_EMAIL, AuthProvider, useAuth } from "@/contexts/AuthContext";

const authMocks = vi.hoisted(() => ({
  getAuth: vi.fn(() => ({})),
  observe: vi.fn(),
  persist: vi.fn(),
  popup: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  isFirebaseConfigured: true,
  getFirebaseAuth: authMocks.getAuth,
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  browserLocalPersistence: {},
  onAuthStateChanged: authMocks.observe,
  setPersistence: authMocks.persist,
  signInWithPopup: authMocks.popup,
  signOut: authMocks.signOut,
}));

// Exercise the public context contract, including promises discarded by menu click handlers.
function AuthControls() {
  const auth = useAuth();
  return <>
    <p>{auth.loading ? "Checking account" : "Ready"}</p>
    <p>{auth.user ? "Owner session" : "Public session"}</p>
    <p role="alert">{auth.error}</p>
    <button onClick={() => void auth.signInWithGoogle()}>Sign in</button>
    <button onClick={() => void auth.signOut()}>Sign out</button>
  </>;
}

function renderAuth() {
  return render(<AuthProvider><AuthControls /></AuthProvider>);
}

function emitUser(email: string | null) {
  const callback = authMocks.observe.mock.calls[0][1] as (user: User | null) => void;
  return callback(email ? { uid: "test-user", email } as User : null);
}

describe("Firebase auth recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMocks.getAuth.mockReturnValue({});
    authMocks.observe.mockReturnValue(authMocks.unsubscribe);
    authMocks.persist.mockResolvedValue(undefined);
    authMocks.signOut.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a useful network error and allows a subsequent sign-in attempt", async () => {
    authMocks.popup.mockRejectedValueOnce(new FirebaseError("auth/network-request-failed", "provider details"));
    authMocks.popup.mockResolvedValueOnce({ user: { email: ALLOWED_EMAIL } });
    renderAuth();
    act(() => { emitUser(null); });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Check your connection"));
    expect(console.error).toHaveBeenCalledWith("[firebase-auth] Google sign-in failed", "auth/network-request-failed");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(authMocks.popup).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("denies a restricted session even when Firebase cleanup rejects", async () => {
    authMocks.signOut.mockRejectedValueOnce(new FirebaseError("auth/network-request-failed", "provider details"));
    renderAuth();
    act(() => { expect(emitUser("other@example.com")).toBeUndefined(); });

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Public session")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Session cleanup could not reach Firebase"));
    expect(screen.getByRole("alert")).toHaveTextContent("Access is restricted");
  });

  it("handles sign-out rejection and retains the owner session for retry", async () => {
    authMocks.signOut.mockRejectedValueOnce(new FirebaseError("auth/network-request-failed", "provider details"));
    renderAuth();
    act(() => { emitUser(ALLOWED_EMAIL); });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Sign-out could not reach Firebase"));
    expect(screen.getByText("Owner session")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledTimes(2));
    act(() => { emitUser(null); });
    expect(screen.getByText("Public session")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("leaves the public app usable when initialization throws", () => {
    authMocks.getAuth.mockImplementationOnce(() => { throw new FirebaseError("auth/network-request-failed", "provider details"); });
    renderAuth();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Session initialization could not reach Firebase");
  });

  it("unsubscribes from session notifications on unmount", () => {
    const view = renderAuth();
    view.unmount();
    expect(authMocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
