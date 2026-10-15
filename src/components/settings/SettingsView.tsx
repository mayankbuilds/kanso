"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { driveSync } from "@/lib/driveSync";
import { api } from "@/lib/api";
import { STORAGE_KEYS, getLocal, setLocal } from "@/lib/storage";
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

  // Danger Zone State
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const REQUIRED_CONFIRM_PHRASE = "DELETE ALL MY DATA";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSync = localStorage.getItem("streakflow_drive_last_sync");
      if (savedSync) setLastSyncedAt(savedSync);
      setIsSignedIn(driveSync.isAuthenticated());
    }

    const checkGoogle = setInterval(() => {
      if (typeof window !== "undefined" && window.google) {
        driveSync.initTokenClient(() => {
          setIsSignedIn(true);
          setStatusMsg("Authenticated with Google Drive.");
          if (localStorage.getItem("streakflow_drive_autosync") === "true") {
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
    window.addEventListener("streakflow-drive-synced", handleDriveSynced);

    return () => {
      clearInterval(checkGoogle);
      window.removeEventListener("streakflow-drive-synced", handleDriveSynced);
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
    null,
  );

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const init = getInitialTheme();
      setThemeMode(init.mode);
      setAccentTheme(init.accent);

      const soundVal = localStorage.getItem("streakflow_sound_enabled");
      if (soundVal !== null) setSoundEnabled(soundVal === "true");

      const durVal = localStorage.getItem("streakflow_focus_duration");
      if (durVal) setDefaultDuration(durVal);

      const autoSyncVal = localStorage.getItem("streakflow_drive_autosync");
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
        handleHandlesUpdated,
      );
      window.removeEventListener("kanso-theme-changed", handleThemeChanged);
      window.removeEventListener("streakflow-theme-changed", handleThemeChanged);
    };
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (typeof window !== "undefined") {
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
      localStorage.setItem("streakflow_drive_autosync", String(next));
    }
    if (next) {
      if (driveSync.isAuthenticated()) {
        driveSync.triggerAutoSync().then((ok) => {
          if (ok) {
            const now = new Date().toISOString();
            setLastSyncedAt(now);
            setStatusMsg(
              "Auto-sync active: Initial snapshot synced to Google Drive.",
            );
          }
        });
      } else {
        setStatusMsg(
          "Auto-sync enabled. Please click 'Connect Google Drive' above to authorize.",
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
        }),
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
              `Codeforces: ${res.total_solved || res.synced_problems_count || 0} solved`,
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

  const handleSyncToDrive = async () => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      const [logs, focus, routines, stats] = await Promise.all([
        api.getRecentLogs(500),
        api.getTodayFocus(),
        api.getRoutines(),
        api.getUserStats(),
      ]);

      let localTasks = [];
      let localNotes = [];
      if (typeof window !== "undefined") {
        try {
          localTasks = JSON.parse(
            localStorage.getItem("kanso_tasks") ||
            localStorage.getItem("streakflow_tasks") ||
            "[]",
          );
          localNotes = JSON.parse(
            localStorage.getItem("kanso_notes") ||
            localStorage.getItem("streakflow_notes") ||
            "[]",
          );
        } catch {}
      }

      const payload = {
        synced_at: new Date().toISOString(),
        version: "2.1.0",
        data: {
          logs,
          focus,
          routines,
          stats,
          tasks: localTasks,
          notes: localNotes,
        },
      };

      await driveSync.uploadSnapshot(payload);
      setStatusMsg(
        "Successfully synced snapshot to Google Drive appDataFolder.",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatusMsg(`Sync failed: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      const snapshot = await driveSync.downloadSnapshot();
      if (!snapshot) {
        setStatusMsg("No existing backup found in Google Drive.");
        return;
      }
      if (typeof window !== "undefined" && snapshot.data) {
        // Restore all 6 data stores to eliminate data loss
        if (snapshot.data.tasks) {
          const serialized = JSON.stringify(snapshot.data.tasks);
          localStorage.setItem("kanso_tasks", serialized);
          localStorage.setItem("streakflow_tasks", serialized);
        }
        if (snapshot.data.notes) {
          const serialized = JSON.stringify(snapshot.data.notes);
          localStorage.setItem("kanso_notes", serialized);
          localStorage.setItem("streakflow_notes", serialized);
        }
        if (snapshot.data.logs) {
          const serialized = JSON.stringify(snapshot.data.logs);
          localStorage.setItem("kanso_logs", serialized);
          localStorage.setItem("streakflow_logs", serialized);
        }
        if (snapshot.data.focus) {
          const serialized = JSON.stringify(snapshot.data.focus);
          localStorage.setItem("kanso_focus", serialized);
          localStorage.setItem("streakflow_focus", serialized);
        }
        if (snapshot.data.focus_history) {
          const serialized = JSON.stringify(snapshot.data.focus_history);
          localStorage.setItem("kanso_focus_history", serialized);
          localStorage.setItem("streakflow_focus_history", serialized);
        }
        if (snapshot.data.routines) {
          const serialized = JSON.stringify(snapshot.data.routines);
          localStorage.setItem("kanso_routines", serialized);
          localStorage.setItem("streakflow_routines", serialized);
        }
        if (snapshot.data.stats) {
          const serialized = JSON.stringify(snapshot.data.stats);
          localStorage.setItem("kanso_user_stats", serialized);
          localStorage.setItem("streakflow_user_stats", serialized);
        }

        // Notify storage listeners and reload dashboard
        window.dispatchEvent(new Event("streakflow-stats-updated"));
        window.dispatchEvent(
          new CustomEvent("kanso-storage-updated", { detail: { key: "all" } }),
        );
        if (onResetComplete) {
          await onResetComplete();
        }
      }
      setStatusMsg(
        "Data successfully restored from Google Drive vault! All records loaded.",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatusMsg(`Restore failed: ${message}`);
    } finally {
      setSyncing(false);
    }
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
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold">
            Storage & Cloud Vault
          </h3>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-emerald-950/50 border border-emerald-800/80 text-emerald-400 rounded-xl shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Kanso Private Storage
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Your execution logs, routine blocks, and pomodoro records are
                stored locally with zero third-party tracking. Connect Google
                Drive to sync private encrypted snapshots directly to your
                personal cloud (
                <code className="text-emerald-400 font-mono">
                  appDataFolder
                </code>
                ).
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-cyan-400" /> Google Drive Cloud
                Vault
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded border ${
                  isSignedIn
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800"
                }`}
              >
                {isSignedIn ? "Connected" : "Disconnected"}
              </span>
            </div>

            {!isSignedIn ? (
              <button
                onClick={handleLogin}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs py-2.5 px-4 rounded-xl border border-zinc-700 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-cyan-400" /> Connect Google Drive
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleSyncToDrive}
                  disabled={syncing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  Backup to Drive
                </button>

                <button
                  onClick={handleRestoreFromDrive}
                  disabled={syncing}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs py-2.5 px-4 rounded-xl border border-zinc-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  Restore from Drive
                </button>
              </div>
            )}

            {lastSyncedAt && (
              <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 px-1">
                <span>Last Cloud Snapshot:</span>
                <span className="text-zinc-300 font-bold">
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
                Google OAuth Client ID is not yet configured in{" "}
                <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300">
                  .env.local
                </code>
                . Set{" "}
                <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300">
                  NEXT_PUBLIC_GOOGLE_CLIENT_ID
                </code>{" "}
                to enable one-click Drive sync.
              </div>
            )}

            {statusMsg && (
              <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{statusMsg}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: APPLICATION PREFERENCES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold">
            Preferences & Environment
          </h3>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-4 font-mono">
          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-200 block font-bold flex items-center gap-1.5">
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                )}
                Synthesizer Sound Effects
              </span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Chimes for start, pause, and focus session completions
              </span>
            </div>
            <button
              onClick={toggleSound}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                soundEnabled
                  ? "bg-accent-subtle border-accent text-accent"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {soundEnabled ? "Enabled" : "Muted"}
            </button>
          </div>

          {/* Default Focus Duration */}
          <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-zinc-200 block font-bold flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-accent" />
                Default Sprint Duration
              </span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Standard Pomodoro work block duration
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
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
                      ? "bg-zinc-800 text-accent font-bold border border-zinc-700"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Mode Selection */}
          <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-zinc-200 block font-bold flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-accent" />
                Theme Mode
              </span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Sumi (Dark), Washi (Light), or match System
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
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
                        ? "bg-zinc-800 text-accent font-semibold border border-zinc-700"
                        : "text-zinc-500 hover:text-zinc-300"
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
          <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-zinc-200 block font-bold flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-accent" />
                Calm Accent Palette
              </span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
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
                        ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110"
                        : "opacity-60 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drive Auto-Sync Toggle */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-200 block font-bold flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-accent" />
                Drive Snapshot Auto-Sync
              </span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">
                Automatically backup snapshot to Google Drive upon session
                completion
              </span>
            </div>
            <button
              onClick={toggleDriveAutoSync}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                driveAutoSync
                  ? "bg-accent-subtle border-accent text-accent"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {driveAutoSync ? "Auto-Sync On" : "Manual Only"}
            </button>
          </div>

          {/* Default CP Handles Manager */}
          <form
            onSubmit={handleSaveHandles}
            className="pt-3 border-t border-zinc-800 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-zinc-200 block font-bold flex items-center gap-1.5 text-xs">
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                Default Competitive Handles
              </span>
              {handlesSaved && (
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
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
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Codeforces handle (e.g. tourist)"
                value={prefCfHandle}
                onChange={(e) => setPrefCfHandle(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs outline-none focus:border-blue-500"
              />
            </div>
            {handlesSyncResult && (
              <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{handlesSyncResult}</span>
              </p>
            )}
            <button
              type="submit"
              disabled={syncingHandles}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
        <div className="flex items-center gap-2 pb-2 border-b border-rose-950/70">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs uppercase tracking-wider text-rose-400 font-bold">
            Danger Zone
          </h3>
        </div>

        <div className="bg-rose-950/15 border border-rose-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-400 rounded-xl shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-200">
                Wipe All Saved User Data
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Permanently deletes all logged coding submissions, focus sprint
                records, routine timetable items, and resets your Level, XP,
                and active streaks back to base values.
              </p>
            </div>
          </div>

          <div className="p-4 bg-zinc-950/80 border border-rose-950 rounded-xl space-y-3">
            <label className="block text-xs text-zinc-300">
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
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-rose-500 text-zinc-100 text-xs p-2.5 rounded-xl outline-none"
            />

            <button
              onClick={handleResetAllData}
              disabled={
                confirmText.trim() !== REQUIRED_CONFIRM_PHRASE || isDeleting
              }
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                confirmText.trim() === REQUIRED_CONFIRM_PHRASE && !isDeleting
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                  : "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-60"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting
                ? "Wiping Data..."
                : "Permanently Delete All Saved Data"}
            </button>

            {deleteSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 p-2.5 rounded-lg text-center">
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
