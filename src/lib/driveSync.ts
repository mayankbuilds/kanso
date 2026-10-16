import {
  KansoSnapshot,
  createKansoSnapshot,
  validateSnapshot,
  STORAGE_KEYS,
  getLocal,
  setLocal,
} from "./storage";

export interface GoogleOAuthTokenResponse {
  access_token: string;
  error?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface GoogleOAuthTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

export interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (resp: GoogleOAuthTokenResponse) => void;
  }) => GoogleOAuthTokenClient;
}

export interface GoogleNamespace {
  accounts: {
    oauth2: GoogleAccountsOAuth2;
  };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

const CANONICAL_BACKUP_FILENAME = "kanso_snapshot.json";
const LEGACY_BACKUP_FILENAME = "streakflow_snapshot.json";

export interface SyncState {
  isSignedIn: boolean;
  lastSyncedAt: string | null;
}

class GoogleDriveSync {
  private tokenClient: GoogleOAuthTokenClient | null = null;
  private accessToken: string | null = null;
  private autoSyncTimer: NodeJS.Timeout | null = null;

  initTokenClient(onSuccess: (token: string) => void) {
    if (typeof window === "undefined" || !window.google) return;

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      // Strict Option B: Drive appDataFolder only. No email or profile identity scopes.
      scope: "https://www.googleapis.com/auth/drive.appdata",
      callback: (resp: GoogleOAuthTokenResponse) => {
        if (resp.error) {
          console.error("Google Drive Auth error:", resp.error);
          return;
        }
        this.accessToken = resp.access_token;
        onSuccess(resp.access_token);
      },
    });
  }

  requestLogin() {
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken({ prompt: "" });
    } else {
      console.warn("Google Drive token client not initialized");
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.accessToken);
  }

  /**
   * Search for backup files in the private appDataFolder.
   * Checks canonical kanso_snapshot.json first, then falls back to legacy streakflow_snapshot.json.
   */
  private async findBackupFile(): Promise<{ id: string; name: string } | null> {
    if (!this.accessToken) throw new Error("Not authenticated with Google Drive");

    // 1. Try canonical kanso_snapshot.json
    const queryCanonical = encodeURIComponent(
      `name = '${CANONICAL_BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed = false`
    );
    const resCanonical = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${queryCanonical}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );

    if (resCanonical.ok) {
      const data = await resCanonical.json();
      if (data.files && data.files.length > 0) {
        return { id: data.files[0].id, name: data.files[0].name };
      }
    }

    // 2. Fall back to legacy streakflow_snapshot.json
    const queryLegacy = encodeURIComponent(
      `name = '${LEGACY_BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed = false`
    );
    const resLegacy = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${queryLegacy}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );

    if (resLegacy.ok) {
      const data = await resLegacy.json();
      if (data.files && data.files.length > 0) {
        return { id: data.files[0].id, name: data.files[0].name };
      }
    }

    return null;
  }

  /**
   * Upload or overwrite backup JSON in appDataFolder.
   * Always names newly created files kanso_snapshot.json.
   */
  async uploadSnapshot(customSnapshot?: KansoSnapshot): Promise<KansoSnapshot> {
    if (!this.accessToken) throw new Error("Not authenticated with Google Drive");

    const payload = customSnapshot || createKansoSnapshot();
    const existingFile = await this.findBackupFile();
    const fileContent = JSON.stringify(payload, null, 2);
    const blob = new Blob([fileContent], { type: "application/json" });

    if (existingFile) {
      // Overwrite existing file
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: blob,
        }
      );

      if (!updateRes.ok) {
        throw new Error(`Drive upload failed with status ${updateRes.status}`);
      }
    } else {
      // Create new file in appDataFolder
      const metadata = {
        name: CANONICAL_BACKUP_FILENAME,
        parents: ["appDataFolder"],
      };

      const formData = new FormData();
      formData.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      formData.append("file", blob);

      const createRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: formData,
        }
      );

      if (!createRes.ok) {
        throw new Error(`Drive create failed with status ${createRes.status}`);
      }
    }

    // Update local last sync timestamp and dispatch events
    const now = payload.synced_at;
    setLocal(STORAGE_KEYS.DRIVE_LAST_SYNC, now);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("kanso-drive-synced", { detail: { timestamp: now } })
      );
      window.dispatchEvent(
        new CustomEvent("streakflow-drive-synced", { detail: { timestamp: now } })
      );
    }

    return payload;
  }

  /**
   * Downloads and validates the backup snapshot from Google Drive without applying it.
   */
  async downloadSnapshot(): Promise<KansoSnapshot | null> {
    if (!this.accessToken) throw new Error("Not authenticated with Google Drive");

    const file = await this.findBackupFile();
    if (!file) return null;

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to download backup file (${res.status})`);
    }

    const raw = await res.json();
    const validated = validateSnapshot(raw);
    if (!validated.valid || !validated.snapshot) {
      throw new Error(validated.error || "Corrupted snapshot file downloaded from Drive");
    }

    return validated.snapshot;
  }

  /**
   * Triggers background auto-sync if authenticated and enabled.
   * Includes conflict prevention: will not overwrite if remote snapshot has a newer timestamp.
   */
  async triggerAutoSync(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const isAutoSync = getLocal<boolean>(STORAGE_KEYS.DRIVE_AUTOSYNC, false);
    if (!isAutoSync || !this.accessToken) return false;

    try {
      // Check if remote exists and has newer data
      const remote = await this.downloadSnapshot();
      if (remote) {
        const localLastModified = getLocal<string | null>(STORAGE_KEYS.LAST_MODIFIED, null);
        const localLastSync = getLocal<string | null>(STORAGE_KEYS.DRIVE_LAST_SYNC, null);
        const localEffectiveTime = localLastModified || localLastSync;

        const remoteTime = new Date(remote.synced_at).getTime();
        const localTime = localEffectiveTime ? new Date(localEffectiveTime).getTime() : 0;

        // If remote is noticeably newer (e.g. edited on another machine), avoid clobbering
        if (remoteTime > localTime + 5000) {
          window.dispatchEvent(
            new CustomEvent("kanso-sync-conflict", {
              detail: {
                remoteSyncedAt: remote.synced_at,
                localLastModified: localEffectiveTime,
              },
            })
          );
          return false;
        }
      }

      await this.uploadSnapshot();
      return true;
    } catch (err) {
      console.warn("Kanso Google Drive auto-sync error:", err);
      return false;
    }
  }

  /**
   * Debounced auto-sync scheduler.
   */
  scheduleAutoSync(delayMs: number = 3000) {
    if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = setTimeout(() => {
      this.triggerAutoSync();
    }, delayMs);
  }
}

export const driveSync = new GoogleDriveSync();