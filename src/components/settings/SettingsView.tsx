"use client";

import { useState, useEffect, useRef } from "react";
import {
  HardDrive,
  Cloud,
  RefreshCw,
  Check,
  LogIn,
  AlertTriangle,
  Trash2,
  Sliders,
  Code2,
  ShieldAlert,
  Volume2,
  VolumeX,
  Timer,
  Palette,
  CheckCircle2,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  FileJson,
  X,
  FileCheck,
} from "lucide-react";
import { driveSync } from "@/lib/driveSync";
import { api } from "@/lib/api";
import {
  STORAGE_KEYS,
  getLocal,
  setLocal,
  KansoSnapshot,
  SnapshotComparison,
  compareSnapshots,
  applyKansoSnapshot,
  exportSnapshotAsJsonFile,
  parseSnapshotFile,
} from "@/lib/storage";
import {
  applyTheme,
  getInitialTheme,
  ACCENT_PALETTES,
  AccentColor,
  ThemeMode,
} from "@/lib/theme";

interface SettingsViewProps {
  onResetComplete?: () => Promise<void>;
}

export default function SettingsView({ onResetComplete }: SettingsViewProps) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncConflict, setSyncConflict] = useState<{
    remoteSyncedAt: string;
    localLastModified: string | null;
  } | null>(null);

  // Pre-Restore Preview & Comparison Modal State
  const [pendingSnapshot, setPendingSnapshot] = useState<KansoSnapshot | null>(
    null
  );
  const [pendingSource, setPendingSource] = useState<"drive" | "file">("drive");
  const [pendingFilename, setPendingFilename] = useState<string | null>(null);
  const [comparison, setComparison] = useState<SnapshotComparison | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Danger Zone State
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const REQUIRED_CONFIRM_PHRASE = "DELETE ALL MY DATA";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSync =
        localStorage.getItem(STORAGE_KEYS.DRIVE_LAST_SYNC) ||
        localStorage.getItem("streakflow_drive_last_sync");
      if (savedSync) setLastSyncedAt(savedSync);
      setIsSignedIn(driveSync.isAuthenticated());
    }

    const checkGoogle = setInterval(() => {
      if (typeof window !== "undefined" && window.google) {
        driveSync.initTokenClient(() => {
          setIsSignedIn(true);
          setStatusMsg("Authenticated with Google Drive Private Vault.");
          if (
            localStorage.getItem(STORAGE_KEYS.DRIVE_AUTOSYNC) === "true" ||
            localStorage.getItem("streakflow_drive_autosync") === "true"
          ) {
            driveSync.triggerAutoSync().then((ok) => {
              if (ok) {
                const now = new Date().toISOString();
                setLastSyncedAt(now);
                setStatusMsg("Auto-sync: Backup updated to Google Drive.");
              }
            });
          }
        });
        clearInterval(checkGoogle);
      }
    }, 300);

    const handleDriveSynced = (e: Event) => {
      const customEvt = e as CustomEvent<{ timestamp?: string }>;
      setLastSyncedAt(customEvt.detail?.timestamp || new Date().toISOString());
    };
    window.addEventListener("kanso-drive-synced", handleDriveSynced);
    window.addEventListener("streakflow-drive-synced", handleDriveSynced);

    const handleSyncConflict = (e: Event) => {
      const customEvt = e as CustomEvent<{
        remoteSyncedAt: string;
        localLastModified: string | null;
      }>;
      if (customEvt.detail) {
        setSyncConflict(customEvt.detail);
      }
    };
    window.addEventListener("kanso-sync-conflict", handleSyncConflict);

    return () => {
      clearInterval(checkGoogle);
      window.removeEventListener("kanso-drive-synced", handleDriveSynced);
      window.removeEventListener("streakflow-drive-synced", handleDriveSynced);
      window.removeEventListener("kanso-sync-conflict", handleSyncConflict);
    };
  }, []);

  const handleLogin = () => {
    driveSync.requestLogin();
  };

  // Preferences State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [defaultDuration, setDefaultDuration] = useState("25");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [accentTheme, setAccentTheme] = useState<AccentColor>("pine");
  const [driveAutoSync, setDriveAutoSync] = useState(false);
  const [prefLcHandle, setPrefLcHandle] = useState("");
  const [prefCfHandle, setPrefCfHandle] = useState("");
  const [handlesSaved, setHandlesSaved] = useState(false);
  const [syncingHandles, setSyncingHandles] = useState(false);
  const [handlesSyncResult, setHandlesSyncResult] = useState<string | null>(
    null
  );

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const init = getInitialTheme();
      setThemeMode(init.mode);
      setAccentTheme(init.accent);

      const soundVal = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
      if (soundVal !== null) setSoundEnabled(soundVal === "true");

      const durVal = localStorage.getItem(STORAGE_KEYS.FOCUS_DURATION);
      if (durVal) setDefaultDuration(durVal);

      const autoSyncVal =
        localStorage.getItem(STORAGE_KEYS.DRIVE_AUTOSYNC) ||
        localStorage.getItem("streakflow_drive_autosync");
      if (autoSyncVal !== null) setDriveAutoSync(autoSyncVal === "true");

      const savedLc = getLocal<string>(STORAGE_KEYS.LC_HANDLE, "");
      if (savedLc) setPrefLcHandle(savedLc);

      const savedCf = getLocal<string>(STORAGE_KEYS.CF_HANDLE, "");
      if (savedCf) setPrefCfHandle(savedCf);
    }

    const handleHandlesUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ lcHandle?: string; cfHandle?: string }>;
      if (custom.detail) {
        if (custom.detail.lcHandle !== undefined)
          setPrefLcHandle(custom.detail.lcHandle);
        if (custom.detail.cfHandle !== undefined)
          setPrefCfHandle(custom.detail.cfHandle);
      }
    };
    window.addEventListener("streakflow-handles-updated", handleHandlesUpdated);

    const handleThemeChanged = (e: Event) => {
      const custom = e as CustomEvent<{ mode?: ThemeMode; accent?: AccentColor }>;
      if (custom.detail) {
        if (custom.detail.mode) setThemeMode(custom.detail.mode);
        if (custom.detail.accent) setAccentTheme(custom.detail.accent);
      }
    };
    window.addEventListener("kanso-theme-changed", handleThemeChanged);
    window.addEventListener("streakflow-theme-changed", handleThemeChanged);

    return () => {
      window.removeEventListener(
        "streakflow-handles-updated",
        handleHandlesUpdated
      );
      window.removeEventListener("kanso-theme-changed", handleThemeChanged);
      window.removeEventListener("streakflow-theme-changed", handleThemeChanged);
    };
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(next));
      localStorage.setItem("streakflow_sound_enabled", String(next));
    }
    if (next && typeof window !== "undefined") {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(520, ctx.currentTime);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.15);
        }
      } catch {}
    }
  };

  const handleSelectDuration = (mins: string) => {
    setDefaultDuration(mins);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.FOCUS_DURATION, mins);
      localStorage.setItem("streakflow_focus_duration", mins);
    }
  };

  const handleSelectThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode, accentTheme);
  };

  const handleSelectAccent = (accent: AccentColor) => {
    setAccentTheme(accent);
    applyTheme(themeMode, accent);
  };

  const toggleDriveAutoSync = () => {
    const next = !driveAutoSync;
    setDriveAutoSync(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.DRIVE_AUTOSYNC, String(next));
      localStorage.setItem("streakflow_drive_autosync", String(next));
    }
    if (next) {
      if (driveSync.isAuthenticated()) {
        driveSync.triggerAutoSync().then((ok) => {
          if (ok) {
            const now = new Date().toISOString();
            setLastSyncedAt(now);
            setStatusMsg(
              "Auto-sync active: Initial snapshot synced to Google Drive vault."
            );
          }
        });
      } else {
        setStatusMsg(
          "Auto-sync enabled. Click 'Connect Google Drive' below to authorize the private vault."
        );
      }
    } else {
      setStatusMsg("Auto-sync disabled. Manual backups only.");
    }
  };

  const handleSaveHandles = async (e: React.FormEvent) => {
    e.preventDefault();
    const lc = prefLcHandle.trim();
    const cf = prefCfHandle.trim();

    if (typeof window !== "undefined") {
      setLocal(STORAGE_KEYS.LC_HANDLE, lc);
      setLocal(STORAGE_KEYS.CF_HANDLE, cf);
      window.dispatchEvent(
        new CustomEvent("streakflow-handles-updated", {
          detail: { lcHandle: lc, cfHandle: cf },
        })
      );
    }
    setHandlesSaved(true);
    setTimeout(() => setHandlesSaved(false), 3000);

    // Trigger immediate auto-sync if handles are provided
    if (lc || cf) {
      setSyncingHandles(true);
      setHandlesSyncResult(null);
      try {
        const results: string[] = [];
        if (lc) {
          try {
            const res = await api.syncLeetCode(lc);
            results.push(`LeetCode: ${res.total_solved || 0} solved`);
          } catch {
            results.push("LeetCode: sync error");
          }
        }
        if (cf) {
          try {
            const res = await api.syncCodeforces(cf);
            results.push(
              `Codeforces: ${res.total_solved || res.synced_problems_count || 0} solved`
            );
          } catch {
            results.push("Codeforces: sync error");
          }
        }
        setHandlesSyncResult(`Synced: ${results.join(" • ")}`);
        if (onResetComplete) await onResetComplete();
      } finally {
        setSyncingHandles(false);
      }
    }
  };

  // 1. Google Drive Cloud Backup
  const handleSyncToDrive = async () => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      const snapshot = await driveSync.uploadSnapshot();
      setLastSyncedAt(snapshot.synced_at);
      setStatusMsg("Successfully synced snapshot to Google Drive private vault.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatusMsg(`Cloud sync failed: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  // 2. Google Drive Cloud Restore (Downloads & Opens Pre-Restore Preview Modal)
  const handleRestoreFromDriveClick = async () => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      const snapshot = await driveSync.downloadSnapshot();
      if (!snapshot) {
        setStatusMsg("No existing backup found in Google Drive private vault.");
        return;
      }
      const comp = compareSnapshots(snapshot);
      setPendingSnapshot(snapshot);
      setPendingSource("drive");
      setPendingFilename(null);
      setComparison(comp);
      setRestoreError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatusMsg(`Download failed: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  // 3. Offline JSON Export
  const handleExportJson = () => {
    try {
      exportSnapshotAsJsonFile();
      setStatusMsg("Exported local Kanso backup file (.json).");
    } catch (err) {
      setStatusMsg(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // 4. Offline JSON File Import (Parses & Opens Pre-Restore Preview Modal)
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await parseSnapshotFile(file);
      if (!res.valid || !res.snapshot) {
        setStatusMsg(`Invalid backup file: ${res.error || "Unrecognized format"}`);
        return;
      }
      const comp = compareSnapshots(res.snapshot);
      setPendingSnapshot(res.snapshot);
      setPendingSource("file");
      setPendingFilename(file.name);
      setComparison(comp);
      setRestoreError(null);
    } catch (err) {
      setStatusMsg(`Could not read file: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      // Reset input value so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 5. Confirm and Apply Restore from Preview Modal
  const handleConfirmRestore = async () => {
    if (!pendingSnapshot) return;
    setIsRestoring(true);
    setRestoreError(null);

    try {
      const res = applyKansoSnapshot(pendingSnapshot);
      if (!res.success) {
        setRestoreError(res.error || "Failed to restore snapshot.");
        return;
      }

      setPendingSnapshot(null);
      setComparison(null);
      setSyncConflict(null);
      setStatusMsg(
        "Backup successfully restored! All records, routines, and stats are now loaded."
      );

      if (onResetComplete) {
        await onResetComplete();
      }
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Failed to restore");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelRestore = () => {
    setPendingSnapshot(null);
    setComparison(null);
    setRestoreError(null);
  };

  const handleResetAllData = async () => {
    if (confirmText.trim() !== REQUIRED_CONFIRM_PHRASE) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.resetAllData();
      setDeleteSuccess(true);
      setConfirmText("");
      if (onResetComplete) {
        await onResetComplete();
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Reset failed";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 font-mono">
      {/* SECTION 1: STORAGE & BACKUP */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <HardDrive className="w-4 h-4 text-accent" />
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            Storage & Cloud Vault
          </h3>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-accent-subtle border border-accent/30 text-accent rounded-xl shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Kanso Private Storage
              </h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Your coding logs, daily routines, focus sprints, and date notes
                are stored locally on this device with zero tracking. You can
                sync private snapshots to Google Drive (
                <code className="text-accent font-mono">appDataFolder</code>
                ) or export offline JSON backup files.
              </p>
            </div>
          </div>

          {/* Sync Conflict Notification */}
          {syncConflict && (
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 text-xs text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Cloud Snapshot Is Newer</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                A newer snapshot from{" "}
                <span className="font-bold underline">
                  {new Date(syncConflict.remoteSyncedAt).toLocaleString()}
                </span>{" "}
                was found in your Drive vault. Click &quot;Restore from Drive&quot; below
                to review item counts before restoring, or &quot;Backup to Drive&quot; to
                overwrite.
              </p>
            </div>
          )}

          {/* GOOGLE DRIVE VAULT CARD */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground flex items-center gap-2 font-semibold">
                <Cloud className="w-4 h-4 text-accent" /> Google Drive Cloud
                Vault
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                  isSignedIn
                    ? "bg-accent-subtle text-accent border-accent/40"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {isSignedIn ? "Connected to Private Vault" : "Disconnected"}
              </span>
            </div>

            {!isSignedIn ? (
              <button
                onClick={handleLogin}
                className="w-full bg-card hover:bg-muted text-foreground text-xs py-2.5 px-4 rounded-xl border border-border transition flex items-center justify-center gap-2 cursor-pointer font-medium"
              >
                <LogIn className="w-4 h-4 text-accent" /> Connect Google Drive
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleSyncToDrive}
                  disabled={syncing}
                  className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-xs font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  Backup to Drive
                </button>

                <button
                  onClick={handleRestoreFromDriveClick}
                  disabled={syncing}
                  className="flex-1 bg-card hover:bg-muted disabled:opacity-50 text-foreground text-xs font-medium py-2.5 px-4 rounded-xl border border-border transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5 text-accent" />
                  Restore from Drive
                </button>
              </div>
            )}

            {lastSyncedAt && (
              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 px-1">
                <span>Last Cloud Snapshot:</span>
                <span className="text-foreground font-semibold">
                  {new Date(lastSyncedAt).toLocaleDateString()}{" "}
                  {new Date(lastSyncedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}

            {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <div className="text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-xl">
                Google OAuth Client ID is not configured in{" "}
                <code className="bg-surface px-1 py-0.5 rounded text-foreground border border-border-subtle font-mono">
                  .env.local
                </code>
                . Set{" "}
                <code className="bg-surface px-1 py-0.5 rounded text-foreground border border-border-subtle font-mono">
                  NEXT_PUBLIC_GOOGLE_CLIENT_ID
                </code>{" "}
                to enable Drive sync.
              </div>
            )}
          </div>

          {/* OFFLINE LOCAL BACKUP CARD */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground flex items-center gap-2 font-semibold">
                <FileJson className="w-4 h-4 text-accent" /> Offline File Backup (.json)
              </span>
              <span className="text-[10px] text-muted-foreground">
                Zero Network Required
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleExportJson}
                className="flex-1 bg-card hover:bg-muted text-foreground text-xs font-medium py-2.5 px-4 rounded-xl border border-border transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                Export Backup (.json)
              </button>

              <label className="flex-1 bg-card hover:bg-muted text-foreground text-xs font-medium py-2.5 px-4 rounded-xl border border-border transition flex items-center justify-center gap-2 cursor-pointer text-center">
                <Upload className="w-3.5 h-3.5 text-accent" />
                <span>Import from File (.json)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {statusMsg && (
            <div className="text-xs text-accent bg-accent-subtle border border-accent/40 p-3 rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-accent shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* PRE-RESTORE COMPARISON & PREVIEW MODAL */}
      {pendingSnapshot && comparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-mono animate-in fade-in duration-200">
          <div className="max-w-xl w-full bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-accent" />
                  Review Backup Before Restoring
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {pendingSource === "drive"
                    ? "Source: Google Drive Private Vault"
                    : `Source: Local file (${pendingFilename || "backup.json"})`}
                </p>
              </div>
              <button
                onClick={handleCancelRestore}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition cursor-pointer"
                title="Cancel restore"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Timestamps & Revision Vector */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-xl border border-border">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase font-bold">
                  Backup Timestamp
                </span>
                <span className="text-foreground font-semibold text-[11px]">
                  {new Date(comparison.remoteTimestamp).toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Revision #{comparison.remoteRevision}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase font-bold">
                  Current Local State
                </span>
                <span className="text-foreground font-semibold text-[11px]">
                  {comparison.localTimestamp
                    ? new Date(comparison.localTimestamp).toLocaleString()
                    : "Not yet synced"}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Revision #{comparison.localRevision}
                </span>
              </div>
            </div>

            {/* Conflict Warning or Success Tag */}
            {comparison.hasConflict && (
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Local Changes Warning
                </span>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Your local state has newer records than this backup.
                  Restoring will replace those local changes. A safety rollback
                  snapshot will be preserved.
                </p>
              </div>
            )}

            {comparison.isRemoteNewer && !comparison.hasConflict && (
              <div className="p-2.5 bg-accent-subtle border border-accent/40 rounded-xl text-xs text-accent flex items-center gap-2">
                <Check className="w-4 h-4 text-accent shrink-0" />
                <span>
                  This backup is newer than your current local storage state.
                </span>
              </div>
            )}

            {/* Side-by-Side Comparison Breakdown */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold block">
                Item Count Comparison
              </span>

              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-muted/60 p-2.5 font-bold text-[11px] text-muted-foreground uppercase">
                  <span>Record Category</span>
                  <span className="text-center">Backup Item</span>
                  <span className="text-right">Current Local</span>
                </div>

                {[
                  {
                    label: "Problem Logs",
                    remote: comparison.remoteCounts.logs,
                    local: comparison.localCounts.logs,
                  },
                  {
                    label: "Daily Focus Tasks",
                    remote: comparison.remoteCounts.focus,
                    local: comparison.localCounts.focus,
                  },
                  {
                    label: "Focus History",
                    remote: comparison.remoteCounts.focus_history,
                    local: comparison.localCounts.focus_history,
                  },
                  {
                    label: "Timetable Routines",
                    remote: comparison.remoteCounts.routines,
                    local: comparison.localCounts.routines,
                  },
                  {
                    label: "Backlog Tasks",
                    remote: comparison.remoteCounts.tasks,
                    local: comparison.localCounts.tasks,
                  },
                  {
                    label: "Daily Notes",
                    remote: comparison.remoteCounts.notes,
                    local: comparison.localCounts.notes,
                  },
                  {
                    label: "Progression Level",
                    remote: `Lvl ${comparison.remoteCounts.level} (${comparison.remoteCounts.xp} XP)`,
                    local: `Lvl ${comparison.localCounts.level} (${comparison.localCounts.xp} XP)`,
                  },
                  {
                    label: "Active Streak",
                    remote: `${comparison.remoteCounts.streak} days`,
                    local: `${comparison.localCounts.streak} days`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-3 p-2.5 items-center hover:bg-muted/30 transition text-foreground"
                  >
                    <span className="text-muted-foreground font-medium">
                      {row.label}
                    </span>
                    <span className="text-center font-bold text-accent">
                      {row.remote}
                    </span>
                    <span className="text-right font-medium text-foreground">
                      {row.local}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {restoreError && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 border-t border-border flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="py-2.5 px-3 bg-card hover:bg-muted border border-border text-foreground rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
                title="Download local state before applying"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span>Export Current First</span>
              </button>

              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelRestore}
                  disabled={isRestoring}
                  className="flex-1 py-2.5 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition cursor-pointer border border-border"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex-1 py-2.5 px-4 bg-accent hover:bg-accent-hover text-accent-foreground rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <span>Confirm & Restore</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: APPLICATION PREFERENCES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Sliders className="w-4 h-4 text-accent" />
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            Preferences & Environment
          </h3>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 font-mono">
          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-foreground block font-bold flex items-center gap-1.5">
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                Synthesizer Sound Effects
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Chimes for start, pause, and focus session completions
              </span>
            </div>
            <button
              onClick={toggleSound}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                soundEnabled
                  ? "bg-accent-subtle border-accent/40 text-accent"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {soundEnabled ? "Enabled" : "Muted"}
            </button>
          </div>

          {/* Default Focus Duration */}
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-foreground block font-bold flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-accent" />
                Default Sprint Duration
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Standard Pomodoro work block duration
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border self-start sm:self-auto">
              {[
                { label: "15m Sprint", val: "15" },
                { label: "25m Flow", val: "25" },
                { label: "50m Deep", val: "50" },
              ].map((d) => (
                <button
                  key={d.val}
                  onClick={() => handleSelectDuration(d.val)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer ${
                    defaultDuration === d.val
                      ? "bg-card text-accent font-bold border border-border shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Mode Selection */}
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-foreground block font-bold flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-accent" />
                Theme Mode
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Sumi (Dark), Washi (Light), or match System
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border self-start sm:self-auto">
              {[
                { id: "dark", label: "Sumi", icon: Moon },
                { id: "light", label: "Washi", icon: Sun },
                { id: "system", label: "System", icon: Monitor },
              ].map((m) => {
                const Icon = m.icon;
                const active = themeMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectThemeMode(m.id as ThemeMode)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? "bg-card text-accent font-semibold border border-border shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Selection */}
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-foreground block font-bold flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-accent" />
                Calm Accent Palette
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Select your focus highlight: Pine, Ceramic, Sand, or Clay
              </span>
            </div>
            <div className="flex items-center gap-2">
              {ACCENT_PALETTES.map((c) => {
                const isSelected = accentTheme === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectAccent(c.id)}
                    title={c.name}
                    aria-label={c.name}
                    style={{ backgroundColor: c.previewBg }}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer relative flex items-center justify-center ${
                      isSelected
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110"
                        : "opacity-60 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drive Auto-Sync Toggle */}
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
            <div>
              <span className="text-foreground block font-bold flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-accent" />
                Drive Snapshot Auto-Sync
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Automatically backup snapshot to Google Drive upon session completion
              </span>
            </div>
            <button
              onClick={toggleDriveAutoSync}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                driveAutoSync
                  ? "bg-accent-subtle border-accent/40 text-accent"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {driveAutoSync ? "Auto-Sync On" : "Manual Only"}
            </button>
          </div>

          {/* Default CP Handles Manager */}
          <form
            onSubmit={handleSaveHandles}
            className="pt-3 border-t border-border space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-foreground block font-bold flex items-center gap-1.5 text-xs">
                <Code2 className="w-3.5 h-3.5 text-accent" />
                Default Competitive Handles
              </span>
              {handlesSaved && (
                <span className="text-[10px] text-accent bg-accent-subtle border border-accent/40 px-2 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Handles Saved!
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="LeetCode username (e.g. neal_wu)"
                value={prefLcHandle}
                onChange={(e) => setPrefLcHandle(e.target.value)}
                className="bg-muted/40 border border-border rounded-xl px-3 py-2 text-foreground text-xs outline-none focus:border-accent"
              />
              <input
                type="text"
                placeholder="Codeforces handle (e.g. tourist)"
                value={prefCfHandle}
                onChange={(e) => setPrefCfHandle(e.target.value)}
                className="bg-muted/40 border border-border rounded-xl px-3 py-2 text-foreground text-xs outline-none focus:border-accent"
              />
            </div>
            {handlesSyncResult && (
              <p className="text-[11px] text-accent font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>{handlesSyncResult}</span>
              </p>
            )}
            <button
              type="submit"
              disabled={syncingHandles}
              className="w-full py-2 bg-card hover:bg-muted border border-border text-foreground rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncingHandles ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving & Syncing Profiles...</span>
                </>
              ) : (
                <span>Save & Sync Handles</span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* SECTION 3: DANGER ZONE (RESET DATA) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs uppercase tracking-wider text-rose-500 font-bold">
            Danger Zone
          </h3>
        </div>

        <div className="bg-rose-950/15 border border-rose-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-400 rounded-xl shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-400">
                Wipe All Saved User Data
              </h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Permanently deletes all logged coding submissions, focus sprint
                records, routine timetable items, and resets your Level, XP,
                and active streaks back to base values.
              </p>
            </div>
          </div>

          <div className="p-4 bg-card border border-rose-950 rounded-xl space-y-3">
            <label className="block text-xs text-foreground">
              To confirm, type{" "}
              <span className="text-rose-400 font-bold select-all bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/50">
                {REQUIRED_CONFIRM_PHRASE}
              </span>{" "}
              below:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE ALL MY DATA"'
              className="w-full bg-muted/50 border border-border focus:border-rose-500 text-foreground text-xs p-2.5 rounded-xl outline-none"
            />

            <button
              onClick={handleResetAllData}
              disabled={
                confirmText.trim() !== REQUIRED_CONFIRM_PHRASE || isDeleting
              }
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                confirmText.trim() === REQUIRED_CONFIRM_PHRASE && !isDeleting
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                  : "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting
                ? "Wiping Data..."
                : "Permanently Delete All Saved Data"}
            </button>

            {deleteSuccess && (
              <div className="text-xs text-accent bg-accent-subtle border border-accent/40 p-2.5 rounded-lg text-center">
                ✓ All user data successfully wiped. Refreshing dashboard...
              </div>
            )}

            {deleteError && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg text-center">
                {deleteError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
