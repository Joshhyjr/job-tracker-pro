import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import LocalDataTransfer from "@/components/LocalDataTransfer";
import { Button } from "@/components/ui/button";
import { RECOVERY_PATH, TRACKER_ORIGIN, TRANSFER_CONFIRMED_KEY, trackerUrl } from "@/lib/siteDomains";
import { safeLocalStorageGetItem } from "@/lib/browserStorage";

export default function DomainTransferGate() {
  const location = useLocation();
  const recovery = location.pathname === RECOVERY_PATH;
  const destination = trackerUrl(recovery ? "/app" : `${location.pathname}${location.search}${location.hash}`);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const alreadyConfirmed = safeLocalStorageGetItem(TRANSFER_CONFIRMED_KEY) === TRACKER_ORIGIN;

  useEffect(() => {
    // Consent is per browser: a different device must still be able to recover its local documents.
    if (alreadyConfirmed && !recovery) window.location.replace(destination);
  }, [alreadyConfirmed, destination, recovery]);

  function confirmMove() {
    if (!verified) return;
    try {
      localStorage.setItem(TRANSFER_CONFIRMED_KEY, TRACKER_ORIGIN);
      if (localStorage.getItem(TRANSFER_CONFIRMED_KEY) !== TRACKER_ORIGIN) throw new Error("Storage blocked");
      window.location.assign(destination);
    } catch { setError("This browser could not remember the move. Your data is retained; use the new tracker link below."); }
  }

  return <main className="mx-auto max-w-3xl space-y-5 p-5 py-12">
    <h1 className="text-2xl font-semibold">Job Tracker has its own address</h1>
    <p>The portfolio stays here. Your tracker is now at <a className="break-all underline" href={destination}>{TRACKER_ORIGIN}</a>.</p>
    <LocalDataTransfer />
    <div className="space-y-3 rounded-md border p-5">
      <p>Open the new tracker, sign in again, and import your transfer file at Settings → Transfer browser data.</p>
      <a className="inline-block font-medium underline" href={destination}>Continue to Job Tracker</a>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />I verified my transferred data on the new domain, or have no local data to transfer</label>
      <Button disabled={!verified} onClick={confirmMove}>Confirm move for this browser</Button>
      <p className="text-xs text-muted-foreground">Confirmation enables automatic redirects in this browser. Original local data stays here. Recover it any time at <a className="underline" href={RECOVERY_PATH}>{RECOVERY_PATH}</a>.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
    <a className="text-sm underline" href="/">Back to portfolio</a>
  </main>;
}
