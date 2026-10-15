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

const BACKUP_FILENAME = "streakflow_snapshot.json";

export interface SyncState {
  isSignedIn: boolean;
  userEmail: string | null;
  lastSyncedAt: string | null;
}

export interface SnapshotPayload {
  synced_at: string;
  version: string;
  data: {
    logs: unknown[];
    focus: unknown[];
    routines: unknown[];
    stats: unknown;
    tasks: unknown[];
    notes: unknown[];
    focus_history?: unknown[];
  };
}

class GoogleDriveSync {
  private tokenClient: GoogleOAuthTokenClient | null = null;
  private accessToken: string | null = null;

  initTokenClient(onSuccess: (token: string) => void) {
    if (typeof window === "undefined" || !window.google) return;

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      scope: "https://www.googleapis.com/auth/drive.appdata",
      callback: (resp: GoogleOAuthTokenResponse) => {
        if (resp.error) {
          console.error("Auth error:", resp);
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
      console.error("Token client not initialized");
    }
  }

  // Find file in appDataFolder
  private async findBackupFileId(): Promise<string | null> {
    if (!this.accessToken) throw new Error("Not authenticated");

    const query = encodeURIComponent(
      `name = '${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed = false`
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  }

  // Upload or overwrite backup JSON in appDataFolder
  async uploadSnapshot(payload: SnapshotPayload): Promise<void> {
    if (!this.accessToken) throw new Error("Not authenticated");

    const existingFileId = await this.findBackupFileId();
    const fileContent = JSON.stringify(payload, null, 2);
    const blob = new Blob([fileContent], { type: "application/json" });

    if (existingFileId) {
      // Overwrite existing file
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: blob,
        }
      );
    } else {
      // Create new file in appDataFolder
      const metadata = {
        name: BACKUP_FILENAME,
        parents: ["appDataFolder"],
      };

      const formData = new FormData();
      formData.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      formData.append("file", blob);

      await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: formData,
        }
      );
    }
  }

  // Restore payload from Google Drive
  async downloadSnapshot(): Promise<SnapshotPayload | null> {
    if (!this.accessToken) throw new Error("Not authenticated");

    const fileId = await this.findBackupFileId();
    if (!fileId) return null;

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );

    return (await res.json()) as SnapshotPayload;
  }

  // Check if active access token is present
  isAuthenticated(): boolean {
    return Boolean(this.accessToken);
  }

  // Fetch connected user info
  async getUserEmail(): Promise<string | null> {
    if (!this.accessToken) return null;
    try {
      const res = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        return data.email || null;
      }
    } catch {
      // Fallback
    }
    return null;
  }

  // Collect full snapshot from local state
  async createSnapshotPayload(): Promise<SnapshotPayload> {
    let localLogs = [];
    let localFocus = [];
    let localRoutines = [];
    let localStats = null;
    let localTasks = [];
    let localNotes = [];
    let localFocusHistory = [];

    if (typeof window !== "undefined") {
      try {
        localLogs = JSON.parse(
          localStorage.getItem("kanso_logs") ||
          localStorage.getItem("streakflow_logs") ||
          "[]"
        );
        localFocus = JSON.parse(
          localStorage.getItem("kanso_focus") ||
          localStorage.getItem("streakflow_focus") ||
          "[]"
        );
        localFocusHistory = JSON.parse(
          localStorage.getItem("kanso_focus_history") ||
          localStorage.getItem("streakflow_focus_history") ||
          "[]"
        );
        localRoutines = JSON.parse(
          localStorage.getItem("kanso_routines") ||
          localStorage.getItem("streakflow_routines") ||
          "[]"
        );
        localStats = JSON.parse(
          localStorage.getItem("kanso_user_stats") ||
          localStorage.getItem("streakflow_user_stats") ||
          "null"
        );
        localTasks = JSON.parse(
          localStorage.getItem("kanso_tasks") ||
          localStorage.getItem("streakflow_tasks") ||
          "[]"
        );
        localNotes = JSON.parse(
          localStorage.getItem("kanso_notes") ||
          localStorage.getItem("streakflow_notes") ||
          "[]"
        );
      } catch (err) {
        console.warn("Error reading local snapshot data:", err);
      }
    }

    return {
      synced_at: new Date().toISOString(),
      version: "2.2.0",
      data: {
        logs: localLogs,
        focus: localFocus,
        focus_history: localFocusHistory,
        routines: localRoutines,
        stats: localStats,
        tasks: localTasks,
        notes: localNotes,
      },
    };
  }

  // Trigger background auto-sync if authenticated and enabled
  async triggerAutoSync(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const isAutoSync =
      localStorage.getItem("streakflow_drive_autosync") === "true";
    if (!isAutoSync || !this.accessToken) return false;

    try {
      const payload = await this.createSnapshotPayload();
      await this.uploadSnapshot(payload);
      const now = new Date().toISOString();
      localStorage.setItem("streakflow_drive_last_sync", now);
      window.dispatchEvent(
        new CustomEvent("streakflow-drive-synced", {
          detail: { timestamp: now },
        })
      );
      return true;
    } catch (err) {
      console.warn("Google Drive auto-sync error:", err);
      return false;
    }
  }

  // Debounced auto-sync scheduler
  private autoSyncTimer: NodeJS.Timeout | null = null;
  scheduleAutoSync(delayMs: number = 3000) {
    if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = setTimeout(() => {
      this.triggerAutoSync();
    }, delayMs);
  }
}

export const driveSync = new GoogleDriveSync();