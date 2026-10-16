"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Flame,
  Music,
  X,
  Sliders,
  Radio,
} from "lucide-react";
import confetti from "canvas-confetti";
import { api } from "@/lib/api";

export interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  loadVideoById?: (
    videoId: string | { videoId: string; startSeconds?: number },
  ) => void;
  destroy: () => void;
  getPlayerState: () => number;
}

export interface YouTubePlayerOptions {
  height?: string | number;
  width?: string | number;
  videoId?: string;
  playerVars?: Record<string, unknown>;
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void;
    onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
    onError?: (event: unknown) => void;
  };
}

export interface YouTubeNamespace {
  Player: new (
    elementId: string | HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type TimerMode = "focus" | "short_break" | "long_break";

export interface MusicPreset {
  id: string;
  name: string;
  url: string;
  tag: string;
  type: "stream" | "brown_noise" | "binaural" | "rain";
}

const MUSIC_PRESETS: MusicPreset[] = [
  {
    id: "brown_noise",
    name: "Brownian Waterfall",
    url: "synth",
    tag: "Offline Synth",
    type: "brown_noise",
  },
  {
    id: "binaural",
    name: "Binaural Alpha Waves (10Hz)",
    url: "synth",
    tag: "Offline Synth",
    type: "binaural",
  },
  {
    id: "rain",
    name: "Rain & Thunderstorm",
    url: "synth",
    tag: "Offline Synth",
    type: "rain",
  },
];

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/))([\w-]{11})/,
  );
  return match ? match[1] : null;
}

interface PomodoroProps {
  onSessionComplete?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: (fullscreen: boolean) => void;
  showInline?: boolean;
  onTimerUpdate?: (info: {
    timeLeft: number;
    isRunning: boolean;
    mode: TimerMode;
  }) => void;
}

export default function PomodoroTimer({
  onSessionComplete,
  isFullscreen: externalIsFullscreen,
  onToggleFullscreen,
  showInline = true,
  onTimerUpdate,
}: PomodoroProps) {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen =
    externalIsFullscreen !== undefined
      ? externalIsFullscreen
      : internalFullscreen;

  // Timer States
  const [mode, setMode] = useState<TimerMode>("focus");
  const [customFocusMins, setCustomFocusMins] = useState(25);
  const [showCustomMinsInput, setShowCustomMinsInput] = useState(false);
  const [customMinsInputValue, setCustomMinsInputValue] = useState("25");

  const getModeTime = useCallback(
    (m: TimerMode) => {
      if (m === "focus") return customFocusMins * 60;
      if (m === "short_break") return 5 * 60;
      return 15 * 60;
    },
    [customFocusMins],
  );

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Zen Mode Idle Detection for Fullscreen
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Background Focus Audio State
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [selectedMusicPreset, setSelectedMusicPreset] = useState("brown_noise");
  const [customMusicUrl, setCustomMusicUrl] = useState("");
  const [recentMusicUrls, setRecentMusicUrls] = useState<string[]>([]);
  const [useCustomMusic, setUseCustomMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  const [audioStatusMsg, setAudioStatusMsg] = useState<string | null>(null);
  const [activeYtId, setActiveYtId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YouTubePlayer | null>(null);
  const prevVolumeRef = useRef<number>(0.4);
  const targetEndTimeRef = useRef<number | null>(null);
  const isCompletingRef = useRef<boolean>(false);

  // Web Audio Context & Nodes for offline sound generator
  const synthCtxRef = useRef<AudioContext | null>(null);
  const synthNodesRef = useRef<{
    source?: AudioBufferSourceNode | OscillatorNode;
    rightOsc?: OscillatorNode;
    gainNode?: GainNode;
  } | null>(null);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) return;
    if (document.getElementById("streakflow-yt-script")) return;

    const tag = document.createElement("script");
    tag.id = "streakflow-yt-script";
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    if (firstScriptTag?.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.head.appendChild(tag);
    }
  }, []);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("streakflow_custom_music_url");
      if (savedUrl) {
        setCustomMusicUrl(savedUrl);
      }
      try {
        const savedRecents = JSON.parse(
          localStorage.getItem("streakflow_recent_music_urls") || "[]",
        );
        if (Array.isArray(savedRecents)) {
          setRecentMusicUrls(savedRecents.slice(0, 3));
        }
      } catch {}
      const savedSound = localStorage.getItem("streakflow_sound_enabled");
      if (savedSound !== null) {
        setSoundEnabled(savedSound === "true");
      }
      const savedFocusMins = localStorage.getItem(
        "streakflow_custom_focus_mins",
      );
      if (savedFocusMins) {
        const parsed = parseInt(savedFocusMins, 10);
        if (parsed > 0 && parsed <= 300) {
          setCustomFocusMins(parsed);
          setCustomMinsInputValue(parsed.toString());
          setTimeLeft(parsed * 60);
        }
      }
    }
  }, []);

  const setIsFullscreen = useCallback(
    (val: boolean) => {
      if (onToggleFullscreen) {
        onToggleFullscreen(val);
      } else {
        setInternalFullscreen(val);
      }
    },
    [onToggleFullscreen],
  );

  // Report timer status to parent
  useEffect(() => {
    if (onTimerUpdate) {
      onTimerUpdate({ timeLeft, isRunning, mode });
    }
  }, [timeLeft, isRunning, mode, onTimerUpdate]);

  // Handle Fullscreen Idle State
  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    if (isFullscreen && isRunning) {
      idleTimeoutRef.current = setTimeout(() => {
        setIsIdle(true);
      }, 2500);
    }
  }, [isFullscreen, isRunning]);

  useEffect(() => {
    if (!isFullscreen || !isRunning) {
      setIsIdle(false);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      return;
    }

    const handleActivity = () => resetIdleTimer();
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    resetIdleTimer();

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [isFullscreen, isRunning, resetIdleTimer]);

  // Fullscreen toggle
  const enterFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    try {
      if (typeof document !== "undefined" && !document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      }
    } catch {}
  }, [setIsFullscreen]);

  const exitFullscreen = useCallback(async () => {
    setIsFullscreen(false);
    try {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {}
  }, [setIsFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Sound chime toggler
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("streakflow_sound_enabled", String(next));
    }
  };

  // Smart volume / mute toggler for focus audio and timer chimes
  const handleVolumeButtonClick = () => {
    if (musicPlaying) {
      if (musicVolume > 0) {
        prevVolumeRef.current = musicVolume;
        setMusicVolume(0);
      } else {
        setMusicVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.4);
      }
    } else {
      toggleSound();
    }
  };

  // Synthesizer Audio Chimes
  const playStartSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch {}
  }, [soundEnabled]);

  const playPauseSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const notes = [554.37, 440];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.2);
      });
    } catch {}
  }, [soundEnabled]);

  const playEndChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.start(now);
      osc1.stop(now + 0.5);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(880, now + 0.15);
      gain2.gain.setValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.8);
    } catch {}
  }, [soundEnabled]);

  // Offline Web Audio Synthesizers
  const stopSynth = useCallback(() => {
    if (synthNodesRef.current) {
      try {
        if (synthNodesRef.current.source) {
          synthNodesRef.current.source.stop();
          synthNodesRef.current.source.disconnect();
        }
        if (synthNodesRef.current.rightOsc) {
          synthNodesRef.current.rightOsc.stop();
          synthNodesRef.current.rightOsc.disconnect();
        }
      } catch {}
      synthNodesRef.current = null;
    }
  }, []);

  const startBrownNoise = useCallback(
    (ctx: AudioContext, vol: number) => {
      stopSynth();
      const bufferSize = ctx.sampleRate * 5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(650, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.7, ctx.currentTime);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start();
      synthNodesRef.current = { source, gainNode: gain };
    },
    [stopSynth],
  );

  const startRainSynth = useCallback(
    (ctx: AudioContext, vol: number) => {
      stopSynth();
      const bufferSize = ctx.sampleRate * 5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
        b6 = white * 0.115926;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1200, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.8, ctx.currentTime);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start();
      synthNodesRef.current = { source, gainNode: gain };
    },
    [stopSynth],
  );

  const startBinaural = useCallback(
    (ctx: AudioContext, vol: number) => {
      stopSynth();
      const oscLeft = ctx.createOscillator();
      const oscRight = ctx.createOscillator();
      oscLeft.type = "sine";
      oscRight.type = "sine";
      oscLeft.frequency.setValueAtTime(200, ctx.currentTime);
      oscRight.frequency.setValueAtTime(210, ctx.currentTime);

      const pannerLeft = ctx.createStereoPanner
        ? ctx.createStereoPanner()
        : null;
      const pannerRight = ctx.createStereoPanner
        ? ctx.createStereoPanner()
        : null;
      if (pannerLeft) pannerLeft.pan.setValueAtTime(-0.8, ctx.currentTime);
      if (pannerRight) pannerRight.pan.setValueAtTime(0.8, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.25, ctx.currentTime);

      if (pannerLeft && pannerRight) {
        oscLeft.connect(pannerLeft);
        pannerLeft.connect(gain);
        oscRight.connect(pannerRight);
        pannerRight.connect(gain);
      } else {
        oscLeft.connect(gain);
        oscRight.connect(gain);
      }

      gain.connect(ctx.destination);
      oscLeft.start();
      oscRight.start();

      synthNodesRef.current = {
        source: oscLeft,
        rightOsc: oscRight,
        gainNode: gain,
      };
    },
    [stopSynth],
  );

  // Audio Playback Coordination
  const activePreset =
    MUSIC_PRESETS.find((p) => p.id === selectedMusicPreset) || MUSIC_PRESETS[0];
  const currentMusicUrl = useCustomMusic ? customMusicUrl : activePreset.url;
  const safeAudioSrc = activeYtId ? undefined : currentMusicUrl;

  // Direct start audio function to guarantee user-gesture acceptance
  // Audio stream & YouTube player controller
  const createOrLoadYTPlayer = useCallback(
    (videoId: string) => {
      const initPlayer = () => {
        if (!window.YT || !window.YT.Player) return;
        const container = document.getElementById("streakflow-yt-player");
        if (!container) return;

        if (
          ytPlayerRef.current &&
          typeof ytPlayerRef.current.loadVideoById === "function"
        ) {
          try {
            ytPlayerRef.current.loadVideoById(videoId);
            ytPlayerRef.current.setVolume(Math.round(musicVolume * 100));
            if (musicVolume === 0) {
              ytPlayerRef.current.mute();
            } else {
              ytPlayerRef.current.unMute();
            }
            ytPlayerRef.current.playVideo();
            return;
          } catch {
            // Re-create if player was destroyed or invalidated
          }
        }

        try {
          ytPlayerRef.current = new window.YT.Player("streakflow-yt-player", {
            height: "100",
            width: "100",
            videoId: videoId,
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              playsinline: 1,
              rel: 0,
              origin:
                typeof window !== "undefined"
                  ? window.location.origin
                  : undefined,
            },
            events: {
              onReady: (event: { target: YouTubePlayer }) => {
                try {
                  event.target.setVolume(Math.round(musicVolume * 100));
                  if (musicVolume === 0) {
                    event.target.mute();
                  } else {
                    event.target.unMute();
                  }
                  event.target.playVideo();
                } catch {}
              },
              onStateChange: (event: {
                data: number;
                target: YouTubePlayer;
              }) => {
                // 0 = YT.PlayerState.ENDED: Immediately loop without stopping
                if (event.data === 0) {
                  try {
                    event.target.seekTo(0, true);
                    event.target.playVideo();
                  } catch {}
                } else if (event.data === 1) {
                  // 1 = YT.PlayerState.PLAYING
                  setMusicPlaying(true);
                  setAudioStatusMsg(`Streaming YouTube Audio (${videoId})`);
                }
              },
              onError: (err: unknown) => {
                console.warn("YouTube player error:", err);
                setAudioStatusMsg("YouTube playback error. Try another video.");
              },
            },
          });
        } catch (e) {
          console.warn("Error creating YouTube player:", e);
        }
      };

      if (typeof window !== "undefined") {
        if (window.YT && window.YT.Player) {
          initPlayer();
        } else {
          const prevReady = window.onYouTubeIframeAPIReady;
          window.onYouTubeIframeAPIReady = () => {
            if (typeof prevReady === "function") prevReady();
            initPlayer();
          };
          const interval = setInterval(() => {
            if (window.YT && window.YT.Player) {
              clearInterval(interval);
              initPlayer();
            }
          }, 200);
          setTimeout(() => clearInterval(interval), 4000);
        }
      }
    },
    [musicVolume],
  );

  const playAudioStream = useCallback(
    (url: string) => {
      stopSynth();
      const ytId = extractYouTubeId(url);
      if (ytId) {
        if (audioRef.current) audioRef.current.pause();
        setActiveYtId(ytId);
        setMusicPlaying(true);
        setAudioStatusMsg(`Streaming YouTube Audio (${ytId})`);
        createOrLoadYTPlayer(ytId);
        return;
      }

      // If switching to direct audio stream, stop YouTube player if active
      if (
        ytPlayerRef.current &&
        typeof ytPlayerRef.current.stopVideo === "function"
      ) {
        try {
          ytPlayerRef.current.stopVideo();
        } catch {}
      }
      setActiveYtId(null);
      if (!audioRef.current) return;

      setAudioStatusMsg("Connecting direct stream...");
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.src = url;
      audioRef.current.volume = musicVolume;
      audioRef.current.load();

      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setMusicPlaying(true);
            setAudioStatusMsg("Playing Direct Stream");
          })
          .catch((err) => {
            console.warn("Direct stream play error:", err);
            setAudioStatusMsg(
              "Direct stream unreachable. Paste direct .mp3 / icecast URL or YouTube link.",
            );
            setMusicPlaying(false);
          });
      }
    },
    [musicVolume, stopSynth, createOrLoadYTPlayer],
  );

  const startOfflineSynth = useCallback(
    (type: "brown_noise" | "binaural" | "rain") => {
      if (
        ytPlayerRef.current &&
        typeof ytPlayerRef.current.stopVideo === "function"
      ) {
        try {
          ytPlayerRef.current.stopVideo();
        } catch {}
      }
      setActiveYtId(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          if (!synthCtxRef.current || synthCtxRef.current.state === "closed") {
            synthCtxRef.current = new AudioCtx();
          }
          if (synthCtxRef.current.state === "suspended") {
            synthCtxRef.current.resume();
          }
          if (type === "brown_noise") {
            startBrownNoise(synthCtxRef.current, musicVolume);
            setAudioStatusMsg("Synthesizing Brownian Waterfall (Offline)");
          } else if (type === "binaural") {
            startBinaural(synthCtxRef.current, musicVolume);
            setAudioStatusMsg("Synthesizing 10Hz Alpha Waves (Offline)");
          } else if (type === "rain") {
            startRainSynth(synthCtxRef.current, musicVolume);
            setAudioStatusMsg("Synthesizing Rain & Storm (Offline)");
          }
          setMusicPlaying(true);
        }
      } catch (err) {
        console.warn("Offline synth error:", err);
      }
    },
    [musicVolume, startBinaural, startBrownNoise, startRainSynth],
  );

  const toggleMusic = () => {
    if (musicPlaying) {
      if (audioRef.current) audioRef.current.pause();
      stopSynth();
      if (
        activeYtId &&
        ytPlayerRef.current &&
        typeof ytPlayerRef.current.pauseVideo === "function"
      ) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      }
      setMusicPlaying(false);
      setAudioStatusMsg("Paused");
    } else {
      if (
        activeYtId &&
        ytPlayerRef.current &&
        typeof ytPlayerRef.current.playVideo === "function"
      ) {
        try {
          ytPlayerRef.current.playVideo();
          setMusicPlaying(true);
          setAudioStatusMsg(`Streaming YouTube Audio (${activeYtId})`);
          return;
        } catch {}
      }
      if (useCustomMusic && customMusicUrl) {
        playAudioStream(customMusicUrl);
      } else if (activePreset.type === "stream") {
        playAudioStream(activePreset.url);
      } else {
        startOfflineSynth(activePreset.type);
      }
    }
  };

  const stopYouTubeAudio = () => {
    if (
      ytPlayerRef.current &&
      typeof ytPlayerRef.current.stopVideo === "function"
    ) {
      try {
        ytPlayerRef.current.stopVideo();
      } catch {}
    }
    setActiveYtId(null);
    setMusicPlaying(false);
    setAudioStatusMsg("Audio stopped");
  };

  const handleSelectPreset = (preset: MusicPreset) => {
    setSelectedMusicPreset(preset.id);
    setUseCustomMusic(false);
    if (
      ytPlayerRef.current &&
      typeof ytPlayerRef.current.stopVideo === "function"
    ) {
      try {
        ytPlayerRef.current.stopVideo();
      } catch {}
    }
    setActiveYtId(null);
    if (preset.type === "stream") {
      playAudioStream(preset.url);
    } else {
      startOfflineSynth(preset.type);
    }
  };

  const handleSetCustomUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed) {
      setCustomMusicUrl(trimmed);
      setUseCustomMusic(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("streakflow_custom_music_url", trimmed);
        setRecentMusicUrls((prev) => {
          const filtered = prev.filter((u) => u !== trimmed);
          const updated = [trimmed, ...filtered].slice(0, 3);
          localStorage.setItem(
            "streakflow_recent_music_urls",
            JSON.stringify(updated),
          );
          return updated;
        });
      }
      playAudioStream(trimmed);
    }
  };

  // Adjust volume across HTML5 audio, Web Audio synths, and YouTube player
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
    if (synthNodesRef.current?.gainNode && synthCtxRef.current) {
      const targetGain =
        activePreset.type === "binaural"
          ? musicVolume * 0.25
          : musicVolume * 0.7;
      synthNodesRef.current.gainNode.gain.setValueAtTime(
        targetGain,
        synthCtxRef.current.currentTime,
      );
    }
    if (ytPlayerRef.current) {
      try {
        if (musicVolume === 0) {
          if (typeof ytPlayerRef.current.mute === "function") {
            ytPlayerRef.current.mute();
          }
        } else {
          if (typeof ytPlayerRef.current.unMute === "function") {
            ytPlayerRef.current.unMute();
          }
          if (typeof ytPlayerRef.current.setVolume === "function") {
            ytPlayerRef.current.setVolume(Math.round(musicVolume * 100));
          }
        }
      } catch {}
    }
  }, [musicVolume, activePreset.type]);

  // Clean up synth on unmount
  useEffect(() => {
    return () => {
      stopSynth();
      if (synthCtxRef.current && synthCtxRef.current.state !== "closed") {
        synthCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopSynth]);

  // Timer mode toggle sound
  const handleToggleTimer = () => {
    if (!isRunning) {
      isCompletingRef.current = false;
      playStartSound();
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
      setIsRunning(true);
    } else {
      playPauseSound();
      targetEndTimeRef.current = null;
      setIsRunning(false);
    }
  };

  // Automatic Sprint Completion handler (Triggered strictly when timer reaches 00:00)
  const handleLogAndCompleteSprint = (customMins?: number) => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    targetEndTimeRef.current = null;
    setIsRunning(false);
    playEndChime();

    if (mode === "focus") {
      const minutesToRecord =
        customMins !== undefined
          ? customMins
          : Math.max(1, Math.round(getModeTime("focus") / 60));

      // Log to API & Local storage
      api
        .logFocusSession({
          duration_seconds: minutesToRecord * 60,
          session_type: "focus",
          xp_earned: minutesToRecord >= 25 ? 50 : 25,
        })
        .then(() => {
          // Broadcast custom event so Statistics immediately updates
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("focus-session-completed", {
                detail: { minutes: minutesToRecord },
              }),
            );
          }
        })
        .catch(() => {});

      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      setCompletedSessions((prev) => prev + 1);

      if (onSessionComplete) onSessionComplete();
    }

    // Advance to next cycle
    const nextMode: TimerMode =
      mode === "focus"
        ? (completedSessions + 1) % 4 === 0
          ? "long_break"
          : "short_break"
        : "focus";
    setMode(nextMode);
    setTimeLeft(getModeTime(nextMode));
  };

  // Precision Wall-Clock Timer Tick Engine
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning) {
      if (!targetEndTimeRef.current) {
        targetEndTimeRef.current = Date.now() + timeLeft * 1000;
      }
      timer = setInterval(() => {
        if (!targetEndTimeRef.current) return;
        const now = Date.now();
        const remaining = Math.max(
          0,
          Math.round((targetEndTimeRef.current - now) / 1000),
        );
        setTimeLeft(remaining);
        if (remaining <= 0) {
          targetEndTimeRef.current = null;
          handleLogAndCompleteSprint(customFocusMins);
        }
      }, 500);
    } else {
      targetEndTimeRef.current = null;
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, customFocusMins, mode, completedSessions]);

  // Sync remaining seconds on tab visibility change or window focus to prevent background drift
  useEffect(() => {
    const handleSyncOnResume = () => {
      if (
        document.visibilityState === "visible" &&
        isRunning &&
        targetEndTimeRef.current
      ) {
        const now = Date.now();
        const remaining = Math.max(
          0,
          Math.round((targetEndTimeRef.current - now) / 1000),
        );
        setTimeLeft(remaining);
        if (remaining <= 0) {
          targetEndTimeRef.current = null;
          handleLogAndCompleteSprint(customFocusMins);
        }
      }
    };

    document.addEventListener("visibilitychange", handleSyncOnResume);
    window.addEventListener("focus", handleSyncOnResume);
    return () => {
      document.removeEventListener("visibilitychange", handleSyncOnResume);
      window.removeEventListener("focus", handleSyncOnResume);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, customFocusMins, mode, completedSessions]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const switchMode = (newMode: TimerMode) => {
    isCompletingRef.current = false;
    targetEndTimeRef.current = null;
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(getModeTime(newMode));
  };

  const resetTimer = (targetMode: TimerMode = mode) => {
    isCompletingRef.current = false;
    targetEndTimeRef.current = null;
    setIsRunning(false);
    setTimeLeft(getModeTime(targetMode));
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleToggleTimer();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMusic();
      } else if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        exitFullscreen();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetTimer(mode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, toggleFullscreen, exitFullscreen, mode, isRunning]);

  const handleApplyCustomMinutes = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMinsInputValue, 10);
    if (!isNaN(val) && val > 0 && val <= 300) {
      setCustomFocusMins(val);
      if (typeof window !== "undefined") {
        localStorage.setItem("streakflow_custom_focus_mins", val.toString());
      }
      setShowCustomMinsInput(false);
      if (mode === "focus") {
        setIsRunning(false);
        setTimeLeft(val * 60);
      }
    }
  };

  // Focus Audio Modal
  const renderMusicModal = () => {
    if (!showMusicMenu) return null;
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
        <div className="w-full max-w-sm bg-surface border border-border-subtle rounded-2xl p-5 shadow-2xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <span className="font-bold text-foreground flex items-center gap-2">
              <Music className="w-4 h-4 text-accent" /> Focus Audio
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMusic}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  musicPlaying
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20"
                    : "bg-accent text-accent-foreground hover:bg-accent-hover font-medium"
                }`}
              >
                {musicPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" /> PAUSE
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> PLAY
                  </>
                )}
              </button>
              <button
                onClick={() => setShowMusicMenu(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {audioStatusMsg && (
            <div className="text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-muted border border-border-subtle flex items-center gap-1.5 text-foreground">
              <Radio
                className={`w-3 h-3 ${musicPlaying ? "text-accent animate-pulse" : "text-muted-foreground"}`}
              />
              <span className="truncate">{audioStatusMsg}</span>
            </div>
          )}

          {/* Volume Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>Volume</span>
              <span className="text-accent font-medium font-mono">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-bold">
              Curated Streams & Offline Audio
            </span>
            {MUSIC_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                  !useCustomMusic &&
                  selectedMusicPreset === p.id &&
                  musicPlaying
                    ? "bg-accent-subtle border border-accent/40 text-accent font-semibold"
                    : "bg-surface-muted hover:bg-surface-hover border border-border-subtle text-foreground"
                }`}
              >
                <span>{p.name}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {p.tag}
                </span>
              </button>
            ))}
          </div>

          {/* Custom Audio Stream & YouTube URL */}
          <div className="pt-3 border-t border-border-subtle space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-bold">
              Direct Audio or YouTube Stream URL
            </span>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Paste YouTube link or .mp3 / icecast URL..."
                value={customMusicUrl}
                onChange={(e) => setCustomMusicUrl(e.target.value)}
                className="flex-1 bg-surface-muted border border-border-subtle rounded-xl px-2.5 py-1.5 text-foreground text-xs focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => handleSetCustomUrl(customMusicUrl)}
                className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-xl text-xs font-medium transition cursor-pointer"
              >
                Play
              </button>
            </div>

            {/* Last 3 Stream URLs Record */}
            {recentMusicUrls.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-bold">
                  Recent Stream URLs (Last 3)
                </span>
                <div className="flex flex-col gap-1.5">
                  {recentMusicUrls.map((url, idx) => {
                    const ytId = extractYouTubeId(url);
                    const label = ytId
                      ? `YouTube Stream (${ytId})`
                      : url.replace(/^https?:\/\//, "").slice(0, 36);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomMusicUrl(url);
                          handleSetCustomUrl(url);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-[11px] text-foreground border border-border-subtle flex items-center justify-between gap-2 transition cursor-pointer"
                        title={url}
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <Play className="w-3 h-3 text-accent shrink-0" />
                          <span className="truncate">{label}</span>
                        </span>
                        <span className="text-[9px] text-muted-foreground shrink-0 font-mono uppercase">
                          {ytId ? "YouTube" : "Audio"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeYtId && musicPlaying && (
              <div className="mt-2 p-2.5 rounded-xl border border-accent/40 bg-accent-subtle text-accent flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-accent" />{" "}
                  YouTube Audio Active
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Plays in background
                </span>
              </div>
            )}

            {useCustomMusic && customMusicUrl && !activeYtId && (
              <span className="text-[10px] text-accent flex items-center gap-1 font-medium">
                ✓ Playing direct stream (saved)
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Custom Minutes Modal
  const renderCustomMinsModal = () => {
    if (!showCustomMinsInput) return null;
    return (
      <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
        <form
          onSubmit={handleApplyCustomMinutes}
          className="w-full max-w-xs bg-surface border border-border-subtle rounded-2xl p-5 shadow-2xl space-y-4 font-mono text-xs"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-accent" /> Custom Sprint
              Time
            </span>
            <button
              type="button"
              onClick={() => setShowCustomMinsInput(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">
              Sprint Duration (in minutes, 1 - 180):
            </label>
            <input
              type="number"
              min="1"
              max="180"
              value={customMinsInputValue}
              onChange={(e) => setCustomMinsInputValue(e.target.value)}
              className="w-full bg-surface-muted border border-border-subtle rounded-xl p-2 text-foreground text-base font-bold outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCustomMinsInputValue(m.toString())}
                className="py-1 rounded-lg bg-surface-muted border border-border-subtle text-muted-foreground hover:text-foreground text-[11px]"
              >
                {m}m
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground font-medium rounded-xl transition cursor-pointer"
          >
            Apply Sprint Time
          </button>
        </form>
      </div>
    );
  };

  // Persistent audio engine keeping streams and YouTube playing across modal close & fullscreen
  const renderPersistentAudio = () => {
    return (
      <>
        <audio
          ref={audioRef}
          src={safeAudioSrc}
          crossOrigin="anonymous"
          loop
          preload="none"
        />

        {/* Persistent offscreen YouTube container — keeps video alive without unmounting */}
        <div
          className="fixed -top-[9999px] -left-[9999px] w-24 h-24 overflow-hidden pointer-events-none opacity-0"
          aria-hidden="true"
        >
          <div id="streakflow-yt-player" />
        </div>

        {/* Persistent YouTube Stream Status Pill */}
        {activeYtId && musicPlaying && !showMusicMenu && (
          <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 bg-surface/95 border border-border-subtle p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 font-mono text-xs backdrop-blur-md animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                  <Radio className="w-3 h-3 text-accent" /> YouTube Stream
                </span>
                <span className="text-[9px] text-muted-foreground max-w-[100px] truncate">
                  {activeYtId}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleMusic}
              className="px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground text-[10px] font-bold transition cursor-pointer"
            >
              {musicPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={stopYouTubeAudio}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition cursor-pointer"
              title="Stop YouTube Stream"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </>
    );
  };

  // FULLSCREEN MODE
  if (isFullscreen) {
    return (
      <>
        {renderPersistentAudio()}
        <div
          className="fixed inset-0 z-[100] w-screen h-[100dvh] min-h-[100dvh] bg-black text-white flex flex-col justify-between p-4 sm:p-8 md:p-12 select-none overflow-hidden"
          style={{ cursor: isIdle && isRunning ? "none" : "default" }}
        >
          {/* Ambient Radial Glow */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${
              mode === "focus"
                ? "bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0,transparent_75%)]"
                : mode === "short_break"
                  ? "bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.08)_0,transparent_75%)]"
                  : "bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.08)_0,transparent_75%)]"
            }`}
          />

          {/* TOP BAR */}
          <div
            className={`relative z-10 flex items-center justify-between w-full max-w-6xl mx-auto transition-all duration-700 ${
              isIdle && isRunning
                ? "opacity-0 pointer-events-none -translate-y-4"
                : "opacity-100 translate-y-0"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? "animate-pulse" : ""
                } bg-accent`}
              />
              <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider uppercase text-foreground">
                {mode === "focus"
                  ? `Focus (${customFocusMins}m)`
                  : mode === "short_break"
                    ? "Short Break"
                    : "Long Break"}
              </span>

              {completedSessions > 0 && (
                <span className="hidden sm:flex items-center gap-1 font-mono text-xs bg-surface-muted border border-border-subtle text-foreground px-2 py-0.5 rounded-md">
                  <Flame className="w-3 h-3 text-accent" />
                  {completedSessions}{" "}
                  {completedSessions === 1 ? "Session" : "Sessions"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowMusicMenu(!showMusicMenu)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono transition cursor-pointer ${
                  musicPlaying
                    ? "bg-accent-subtle border-accent text-accent font-semibold"
                    : "bg-surface-muted border-border-subtle text-muted-foreground hover:text-foreground"
                }`}
                title="Focus Audio (M)"
              >
                <Music
                  className={`w-3.5 h-3.5 ${musicPlaying ? "animate-spin" : ""}`}
                />
                <span className="hidden md:inline">
                  {musicPlaying ? "Audio Playing" : "Focus Audio"}
                </span>
              </button>

              <button
                onClick={handleVolumeButtonClick}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  musicPlaying
                    ? musicVolume === 0
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                      : "bg-accent-subtle border-accent-border text-accent"
                    : "bg-surface-muted hover:bg-surface-hover border-border-subtle text-muted-foreground hover:text-foreground"
                }`}
                title={
                  musicPlaying
                    ? musicVolume === 0
                      ? "Unmute Focus Audio"
                      : `Focus Audio: ${Math.round(musicVolume * 100)}% (Click to Mute)`
                    : soundEnabled
                      ? "Mute Timer Chimes"
                      : "Enable Timer Chimes"
                }
              >
                {musicPlaying ? (
                  musicVolume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-500" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-accent" />
                  )
                ) : soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={exitFullscreen}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-surface-muted hover:bg-surface-hover border border-border-subtle text-foreground font-mono text-xs transition cursor-pointer"
                title="Exit Fullscreen (ESC)"
              >
                <Minimize2 className="w-4 h-4 text-muted-foreground" />
                <span className="hidden sm:inline">Exit</span>
                <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] bg-surface border border-border-subtle rounded text-muted-foreground">
                  ESC
                </kbd>
              </button>
            </div>
          </div>

          {/* MAIN STAGE */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto w-full max-w-4xl mx-auto text-center px-2">
            {/* Mode Switcher */}
            <div
              className={`grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2 mb-6 sm:mb-10 bg-surface-muted p-2 sm:p-1.5 rounded-2xl border border-border-subtle w-full max-w-xs sm:max-w-none transition-all duration-700 ${
                isIdle && isRunning
                  ? "opacity-0 pointer-events-none -translate-y-4"
                  : "opacity-100 translate-y-0"
              }`}
            >
              <button
                onClick={() => switchMode("focus")}
                className={`text-xs sm:text-sm font-mono px-3 sm:px-5 py-2.5 sm:py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap text-center ${
                  mode === "focus"
                    ? "bg-surface-elevated text-accent font-semibold shadow-xs border border-border-subtle"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                FOCUS ({customFocusMins}M)
              </button>
              <button
                onClick={() => switchMode("short_break")}
                className={`text-xs sm:text-sm font-mono px-3 sm:px-5 py-2.5 sm:py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap text-center ${
                  mode === "short_break"
                    ? "bg-surface-elevated text-accent font-semibold shadow-xs border border-border-subtle"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                SHORT (5M)
              </button>
              <button
                onClick={() => switchMode("long_break")}
                className={`text-xs sm:text-sm font-mono px-3 sm:px-5 py-2.5 sm:py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap text-center ${
                  mode === "long_break"
                    ? "bg-surface-elevated text-accent font-semibold shadow-xs border border-border-subtle"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                LONG (15M)
              </button>
              <button
                onClick={() => setShowCustomMinsInput(true)}
                className="text-xs sm:text-sm font-mono px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl border border-dashed border-border-subtle text-muted-foreground hover:text-foreground whitespace-nowrap text-center flex items-center justify-center gap-1"
                title="Set Custom Focus Time"
              >
                ⚙ CUSTOM
              </button>
            </div>

            {/* GIANT DIGITAL CLOCK */}
            <div className="my-2 sm:my-6 select-none transition-transform duration-700">
              <div
                className={`text-7xl xs:text-8xl sm:text-9xl md:text-[14vw] lg:text-[17vw] font-black font-mono tracking-tighter tabular-nums leading-none select-none ${
                  isIdle && isRunning ? "scale-105" : "scale-100"
                } transition-transform duration-700 text-foreground`}
              >
                {formatTime(timeLeft)}
              </div>

              <p
                className={`text-xs sm:text-sm font-mono tracking-widest text-muted-foreground uppercase mt-4 sm:mt-8 transition-opacity duration-700 ${
                  isIdle && isRunning ? "opacity-40" : "opacity-100"
                }`}
              >
                {isRunning
                  ? mode === "focus"
                    ? "Deep Work Sprint • In The Flow"
                    : "Recharge & Hydrate • Rest Your Eyes"
                  : "Timer Paused"}
              </p>
            </div>

            {/* CONTROLS */}
            <div
              className={`flex items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-10 transition-all duration-700 flex-wrap ${
                isIdle && isRunning
                  ? "opacity-0 pointer-events-none translate-y-4"
                  : "opacity-100 translate-y-0"
              }`}
            >
              <button
                onClick={handleToggleTimer}
                className={`h-14 sm:h-16 px-8 sm:px-12 rounded-2xl font-mono text-xs sm:text-sm font-bold tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
                  isRunning
                    ? "bg-surface-elevated border border-border-subtle text-foreground hover:bg-surface-hover"
                    : "bg-accent text-accent-foreground hover:bg-accent-hover shadow-xs"
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 fill-current" /> PAUSE
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" /> START SPRINT
                  </>
                )}
              </button>

              <button
                onClick={() => resetTimer(mode)}
                className="h-14 sm:h-16 w-14 sm:w-16 rounded-2xl bg-surface-muted border border-border-subtle hover:border-border-strong text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
                title="Reset Timer (R)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* BOTTOM HELPER BAR */}
          <div
            className={`relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-4 border-t border-border-subtle transition-all duration-700 ${
              isIdle && isRunning
                ? "opacity-0 pointer-events-none translate-y-4"
                : "opacity-100 translate-y-0"
            }`}
          >
            <div className="hidden sm:flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
                  Space
                </kbd>{" "}
                Play/Pause
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
                  F
                </kbd>{" "}
                Fullscreen
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
                  M
                </kbd>{" "}
                Focus Audio
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
                  R
                </kbd>{" "}
                Reset
              </span>
            </div>

            <div className="hidden sm:block text-muted-foreground font-semibold tracking-wider">Kanso</div>
          </div>

          {renderMusicModal()}
          {renderCustomMinsModal()}
        </div>
      </>
    );
  }

  // If not inline and not fullscreen, just render audio
  if (!showInline) {
    return renderPersistentAudio();
  }

  // STANDARD INLINE CARD MODE
  return (
    <>
      {renderPersistentAudio()}
      <div className="relative overflow-hidden bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center">
        {/* Ambience */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
            mode === "focus"
              ? "bg-[radial-gradient(circle_at_center,var(--theme-accent-subtle)_0,transparent_70%)]"
              : mode === "short_break"
                ? "bg-[radial-gradient(circle_at_center,var(--theme-accent-subtle)_0,transparent_70%)]"
                : "bg-[radial-gradient(circle_at_center,var(--theme-accent-subtle)_0,transparent_70%)]"
          }`}
        />

        {/* Card Header */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 z-10">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-1 bg-surface-muted p-1.5 sm:p-1 rounded-xl border border-border-subtle w-full sm:w-auto">
            <button
              onClick={() => switchMode("focus")}
              className={`text-xs font-mono px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer text-center ${
                mode === "focus"
                  ? "bg-surface-elevated text-accent font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              FOCUS ({customFocusMins}M)
            </button>
            <button
              onClick={() => switchMode("short_break")}
              className={`text-xs font-mono px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer text-center ${
                mode === "short_break"
                  ? "bg-surface-elevated text-accent font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SHORT (5M)
            </button>
            <button
              onClick={() => switchMode("long_break")}
              className={`text-xs font-mono px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer text-center ${
                mode === "long_break"
                  ? "bg-surface-elevated text-accent font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              LONG (15M)
            </button>
            <button
              onClick={() => setShowCustomMinsInput(true)}
              className="text-xs font-mono px-2 py-2 sm:py-1.5 rounded-lg border border-dashed border-border-subtle text-muted-foreground hover:text-accent whitespace-nowrap transition cursor-pointer text-center flex items-center justify-center gap-1"
              title="Custom duration"
            >
              ⚙ CUSTOM
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowMusicMenu(true)}
              className={`p-2 rounded-xl border text-xs font-mono transition cursor-pointer ${
                musicPlaying
                  ? "bg-accent-subtle border-accent text-accent shadow-xs"
                  : "bg-surface-muted border border-border-subtle text-muted-foreground hover:text-foreground"
              }`}
              title="Focus Audio (M)"
            >
              <Music
                className={`w-3.5 h-3.5 ${musicPlaying ? "animate-spin" : ""}`}
              />
            </button>

            <button
              onClick={handleVolumeButtonClick}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                musicPlaying
                  ? musicVolume === 0
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                    : "bg-accent-subtle border-accent text-accent"
                  : "bg-surface-muted border border-border-subtle hover:border-border-strong text-muted-foreground hover:text-foreground"
              }`}
              title={
                musicPlaying
                  ? musicVolume === 0
                    ? "Unmute Focus Audio"
                    : `Focus Audio: ${Math.round(musicVolume * 100)}% (Click to Mute)`
                  : soundEnabled
                    ? "Mute Timer Chimes"
                    : "Enable Timer Chimes"
              }
            >
              {musicPlaying ? (
                musicVolume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-accent" />
                )
              ) : soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={enterFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-subtle hover:opacity-90 border border-accent text-accent text-xs font-mono font-semibold transition cursor-pointer shadow-xs"
              title="Enter Fullscreen (F)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fullscreen</span>
            </button>
          </div>
        </div>

        {/* Clock Display */}
        <div
          onClick={enterFullscreen}
          className="my-2 z-10 text-center cursor-pointer group"
          title="Click for Fullscreen Zen Mode"
        >
          <div className="text-6xl sm:text-7xl md:text-8xl font-black font-mono tracking-tighter text-foreground tabular-nums select-none group-hover:scale-[1.01] transition-transform">
            {formatTime(timeLeft)}
          </div>
          <p className="text-[11px] font-mono tracking-widest text-muted-foreground uppercase mt-2 group-hover:text-accent transition-colors">
            {isRunning
              ? mode === "focus"
                ? "Deep Work Sprint • In The Flow"
                : "Resting & Hydrating"
              : "Paused • Click for Fullscreen"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-6 z-10 flex-wrap justify-center">
          <button
            onClick={handleToggleTimer}
            className={`h-12 px-6 rounded-xl font-mono text-xs font-bold tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              isRunning
                ? "bg-surface-elevated border border-border-subtle text-foreground hover:bg-surface-hover"
                : "bg-accent text-accent-foreground hover:bg-accent-hover shadow-xs"
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" /> PAUSE
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> START SPRINT
              </>
            )}
          </button>

          <button
            onClick={() => resetTimer(mode)}
            className="h-12 w-12 rounded-xl bg-surface-muted border border-border-subtle hover:border-border-strong text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Helper */}
        <div className="mt-4 text-[10px] font-mono text-muted-foreground hidden sm:flex items-center gap-2">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
              Space
            </kbd>{" "}
            play/pause
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
              F
            </kbd>{" "}
            fullscreen
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
              M
            </kbd>{" "}
            focus audio
          </span>
        </div>

        {renderMusicModal()}
        {renderCustomMinsModal()}
      </div>
    </>
  );
}
