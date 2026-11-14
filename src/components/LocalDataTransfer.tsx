import { useState, type ChangeEvent } from "react";
import { getApplications } from "@/lib/storage";
import { safeLocalStorageGetItem } from "@/lib/browserStorage";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { createTransfer, MAX_TRANSFER_BYTES, parseTransfer, restoreTransfer, type LocalTransfer } from "@/lib/localTransfer";
import { getSiteKind, PORTFOLIO_ORIGIN, RECOVERY_PATH } from "@/lib/siteDomains";

export default function LocalDataTransfer() {
  const { user, loading, error: authError, signInWithGoogle } = useAuth();
  const [backup, setBackup] = useState<LocalTransfer | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [exported, setExported] = useState(false);

  function download() {
    setError("");
    try {
      const snapshot = createTransfer(localStorage, user?.uid);
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `job-tracker-transfer-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      // Leave time for the download to begin before releasing its browser-only payload.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExported(true);
    } catch {
      setError("Export could not finish. Browser storage may be blocked or contain invalid data. Your original data is unchanged.");
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setBackup(null);
    setConfirmed(false);
    setSuccess(false);
    setError("");
    if (!file) return;
    try {
      if (file.size > MAX_TRANSFER_BYTES) throw new Error("Too large");
      setBackup(parseTransfer(await file.text()));
    } catch {
      setError("Choose a valid Job Tracker transfer file under 20 MB. No browser data was changed.");
    }
    event.target.value = "";
  }

  async function exportLegacyApplications() {
    if (!user) return;
    try {
      // Firebase may already have completed its one-time local migration; recover rows through its explicit import flow.
      const { exportXLSX } = await import("@/lib/export");
      await exportXLSX(getApplications());
    } catch { setError("Workbook export failed. Keep the JSON transfer file and retry."); }
  }

  function restore() {
    if (!backup || !confirmed) return;
    try {
      // Recheck the current identity on click; signing out after preview must not bypass owner isolation.
      restoreTransfer(backup, localStorage, user?.uid);
      setSuccess(true);
      setBackup(null);
      setConfirmed(false);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Restore failed. Keep your transfer file and retry.");
    }
  }

  const entries = Object.entries(backup?.entries ?? {});
  const ownerMismatch = Boolean(backup?.ownerId && backup.ownerId !== user?.uid);
  return (
    <section className="app-panel space-y-4 p-5" aria-label="Transfer browser data">
      <h2 className="text-lg font-semibold">Transfer browser data</h2>
      <p className="text-sm text-muted-foreground">Firebase records stay in your existing account. Export on the old domain, then import the file on the new tracker domain in this browser. Repeat for other browsers or devices with local files.</p>
      <p className="text-sm">The download contains private data. Keep it on a trusted device and delete it after verifying your documents and local records on the new domain.</p>
      {!user && <p className="text-sm">Sign in to include private documents, legacy application data and import backups. Signed-out exports include only demo data and public preferences.</p>}
      {!user && <Button variant="outline" disabled={loading} onClick={() => void signInWithGoogle()}>Sign in for private data</Button>}
      {authError && <p role="alert" className="text-sm text-destructive">{authError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={loading} onClick={download}>Export local data</Button>
        <label className="text-sm font-medium">Choose transfer file<input aria-label="Choose transfer file" type="file" accept=".json,application/json" className="mt-1 block max-w-full text-sm" onChange={(event) => void chooseFile(event)} /></label>
      </div>
      {exported && <p role="status" className="text-sm">Export prepared. Check that the download saved before continuing. Original browser data has been retained.</p>}
      {backup && <div className="space-y-3 rounded-md border p-4">
        <p className="text-sm font-medium">{entries.length} storage entries from {new Date(backup.createdAt).toLocaleString()}</p>
        <ul className="space-y-1 text-xs">{entries.map(([key, value]) => <li key={key} className="break-all">{key} · {Math.ceil(new Blob([value]).size / 1024)} KB{safeLocalStorageGetItem(key) !== null ? " · replaces existing data" : " · new data"}</li>)}</ul>
        <p className="text-sm">Only the listed entries will be replaced. Firebase records are unchanged. Export any destination data you want to keep first.</p>
        {ownerMismatch && <p className="text-sm text-destructive">Sign in as the same owner who exported this file to restore it.</p>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I agree to replace the listed local data with this transfer file</label>
        <Button disabled={!confirmed || ownerMismatch || loading || entries.length === 0} onClick={restore}>Restore local data</Button>
      </div>}
      {user && safeLocalStorageGetItem("job-tracker-data") !== null && <div className="space-y-2 text-sm">
        <p>Legacy local application records are recovery copies and are not automatically added to Firebase after its initial migration. Export a workbook and use the tracker's spreadsheet import to merge any missing records.</p>
        <Button variant="outline" onClick={() => void exportLegacyApplications()}>Export legacy application workbook</Button>
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <div role="status" className="space-y-2 text-sm">
        <p>Import verified: every restored entry was read back successfully. Open the tracker to check your documents and local records before confirming the move on the old domain.</p>
        <a href="/app" className="font-medium underline">Open tracker with restored data</a>
        {getSiteKind() === "tracker" && <p><a href={`${PORTFOLIO_ORIGIN}${RECOVERY_PATH}`} className="underline">Return to the old domain to confirm verification</a></p>}
      </div>}
    </section>
  );
}
