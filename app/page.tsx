"use client";

import { useEffect, useRef, useState } from "react";

const COUNTDOWN_FROM = 5;
const VIDEO_SRC =
  "https://raw.githubusercontent.com/AmKilopa/artanime/main/public/videos/artanime.mp4";
const VIDEO_PHRASES_SRC = "/phrases-video.txt";
const AFTER_PHRASES_SRC = "/phrases-after.txt";
const RED_PHRASES_AT_SECONDS = 195;
const PHRASE_SLOTS = [
  { x: 12, y: 12 },
  { x: 86, y: 16 },
  { x: 18, y: 34 },
  { x: 82, y: 38 },
  { x: 14, y: 58 },
  { x: 88, y: 62 },
  { x: 22, y: 82 },
  { x: 78, y: 84 },
];

type Stage = "ready" | "counting" | "playing" | "ended";
type FlyingPhrase = {
  id: number;
  text: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
  duration: number;
};

const FALLBACK_PHRASES = [
  "НЕ ОТВОДИ ГЛАЗА",
  "СМОТРИ ДО КОНЦА",
  "ТЫ УЖЕ ЗДЕСЬ",
  "НЕ ВЫХОДИ",
  "ОНО СМОТРИТ",
  "ТИШЕ",
  "ЕЩЕ НЕМНОГО",
  "НЕ МОРГАЙ",
];

const FALLBACK_AFTER_PHRASES = [
  "ВИДЕО ЗАКОНЧИЛОСЬ",
  "ТЫ ДОСМОТРЕЛ",
  "ЭТО ОСТАЛОСЬ С ТОБОЙ",
  "ТЕПЕРЬ ТИШЕ",
];

function parsePhrases(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}`;
}

function makePhrase(text: string, slotIndex: number): FlyingPhrase {
  const slot = PHRASE_SLOTS[slotIndex % PHRASE_SLOTS.length];

  return {
    id: Date.now() + Math.random(),
    text,
    x: slot.x + (Math.random() * 6 - 3),
    y: slot.y + (Math.random() * 7 - 3.5),
    size: 0.95 + Math.random() * 0.55,
    rotate: -8 + Math.random() * 16,
    duration: 3000 + Math.random() * 500,
  };
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("ready");
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [flash, setFlash] = useState(false);
  const [phraseMode, setPhraseMode] = useState<"video" | "after">("video");
  const [videoPhrases, setVideoPhrases] = useState(FALLBACK_PHRASES);
  const [afterPhrases, setAfterPhrases] = useState(FALLBACK_AFTER_PHRASES);
  const [flyingPhrases, setFlyingPhrases] = useState<FlyingPhrase[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lockFullscreenRef = useRef(false);
  const phraseSlotRef = useRef(0);
  const redSwitchDoneRef = useRef(false);

  const playTone = (frequency: number, duration = 0.16, volume = 0.18) => {
    const context = audioRef.current;
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  };

  const requestFullscreen = () => {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      void root.requestFullscreen().catch(() => {});
    }
  };

  const triggerAfterPhrases = () => {
    if (redSwitchDoneRef.current) {
      return;
    }

    redSwitchDoneRef.current = true;
    setPhraseMode("after");
    setFlyingPhrases([]);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 720);
  };

  const syncPhraseModeForTime = (seconds: number) => {
    if (seconds >= RED_PHRASES_AT_SECONDS) {
      triggerAfterPhrases();
      return;
    }

    if (redSwitchDoneRef.current || phraseMode !== "video") {
      redSwitchDoneRef.current = false;
      setPhraseMode("video");
      setFlyingPhrases([]);
    }
  };

  const seekVideo = (seconds: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const duration = Number.isFinite(video.duration)
      ? video.duration
      : videoDuration;
    const nextTime = Math.max(
      0,
      duration > 0 ? Math.min(seconds, duration) : seconds,
    );

    video.currentTime = nextTime;
    setVideoTime(nextTime);
    syncPhraseModeForTime(nextTime);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdmin(params.get("admin") === "1" || window.location.hash === "#admin");
  }, []);

  useEffect(() => {
    fetch(VIDEO_PHRASES_SRC, { cache: "no-store" })
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        const next = parsePhrases(text);
        if (next.length > 0) setVideoPhrases(next);
      })
      .catch(() => {});

    fetch(AFTER_PHRASES_SRC, { cache: "no-store" })
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        const next = parsePhrases(text);
        if (next.length > 0) setAfterPhrases(next);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (lockFullscreenRef.current && !document.fullscreenElement) {
        requestFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (stage !== "counting") {
      return;
    }

    if (count === 0) {
      playTone(880, 0.24, 0.28);
      setFlash(true);
      const flashTimer = window.setTimeout(() => setFlash(false), 720);
      const playTimer = window.setTimeout(() => setStage("playing"), 260);
      return () => {
        window.clearTimeout(flashTimer);
        window.clearTimeout(playTimer);
      };
    }

    playTone(420 + count * 45);
    const timer = window.setTimeout(() => setCount((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [count, stage]);

  useEffect(() => {
    if (stage !== "playing") {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    lockFullscreenRef.current = true;
    requestFullscreen();
    setPhraseMode("video");
    redSwitchDoneRef.current = false;

    const resumeVideo = () => {
      if (!video.ended) {
        video.muted = true;
        void video.play().then(() => {
          video.muted = false;
          video.volume = 1;
        }).catch(() => {});
      }
    };

    video.currentTime = 0;
    video.muted = true;
    video.volume = 1;
    void video.play().then(() => {
      video.muted = false;
      video.volume = 1;
    }).catch(() => {});

    video.addEventListener("pause", resumeVideo);
    return () => {
      video.removeEventListener("pause", resumeVideo);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "playing") {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const handleTimeUpdate = () => {
      setVideoTime(video.currentTime);
      if (Number.isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
      syncPhraseModeForTime(video.currentTime);
    };

    const handleDurationChange = () => {
      if (Number.isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("loadedmetadata", handleDurationChange);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("loadedmetadata", handleDurationChange);
    };
  }, [phraseMode, stage, videoDuration]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" || stage === "ready") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      event.preventDefault();
      seekVideo(video.currentTime - 5);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stage, videoDuration]);

  useEffect(() => {
    if (stage !== "playing") {
      setFlyingPhrases([]);
      return;
    }

    const activePhrases = phraseMode === "video" ? videoPhrases : afterPhrases;

    const spawn = () => {
      const batchSize =
        phraseMode === "after" ? 2 + Math.floor(Math.random() * 2) : 1;
      const maxVisible = phraseMode === "after" ? 14 : 6;
      const batch = Array.from({ length: batchSize }, () => {
        const item = makePhrase(pick(activePhrases), phraseSlotRef.current);
        phraseSlotRef.current += 1;
        return item;
      });

      setFlyingPhrases((current) => [
        ...current.slice(-(maxVisible - batch.length)),
        ...batch,
      ]);

      for (const item of batch) {
        window.setTimeout(() => {
          setFlyingPhrases((current) =>
            current.filter((phrase) => phrase.id !== item.id),
          );
        }, item.duration);
      }
    };

    spawn();
    const interval = window.setInterval(
      spawn,
      phraseMode === "after" ? 620 : 1450,
    );
    return () => window.clearInterval(interval);
  }, [afterPhrases, phraseMode, stage, videoPhrases]);
  const startCountdown = () => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    void audioRef.current.resume();
    lockFullscreenRef.current = true;
    requestFullscreen();
    playTone(520, 0.18, 0.22);

    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.volume = 1;
      video.currentTime = 0;
      void video.play().catch(() => {});
    }

    setPhraseMode("video");
    setFlyingPhrases([]);
    phraseSlotRef.current = 0;
    redSwitchDoneRef.current = false;
    setCount(COUNTDOWN_FROM);
    setStage("counting");
  };

  const isVideoVisible = stage === "playing" || stage === "ended";

  return (
    <main className={`landing landing--${stage} landing--phrases-${phraseMode}`}>
      <div className={`flash${flash ? " flash--active" : ""}`} />
      <div className="phrase-layer" aria-hidden="true">
        {flyingPhrases.map((phrase) => (
          <span
            className="flying-phrase"
            key={phrase.id}
            style={{
              "--x": `${phrase.x}%`,
              "--y": `${phrase.y}%`,
              "--size": `${phrase.size}rem`,
              "--rotate": `${phrase.rotate}deg`,
              "--duration": `${phrase.duration}ms`,
            } as React.CSSProperties}
          >
            {phrase.text}
          </span>
        ))}
      </div>

      <section className="focus-area" aria-live="polite">
        {stage === "ready" && (
          <button className="start-button" type="button" onClick={startCountdown}>
            Start
          </button>
        )}

        {stage === "counting" && (
          <div className="countdown" aria-label={`Video starts in ${count}`}>
            {count}
          </div>
        )}

        <div
          className={`video-shell${isVideoVisible ? "" : " video-shell--hidden"}`}
          aria-hidden={!isVideoVisible}
        >
          <video
            ref={videoRef}
            className="locked-video"
            src={VIDEO_SRC}
            crossOrigin="anonymous"
            playsInline
            preload="auto"
            controls={false}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            onEnded={() => {
              lockFullscreenRef.current = false;
              setStage("ended");
            }}
            tabIndex={-1}
          />
          {stage === "ended" && <p className="final-note">Video ended</p>}
        </div>
      </section>

      {isAdmin && (
        <aside className="admin-panel" aria-label="Admin video controls">
          <div className="admin-panel__top">
            <span>ADMIN</span>
            <strong>
              {formatTime(videoTime)} / {formatTime(videoDuration)}
            </strong>
          </div>
          <input
            className="admin-panel__range"
            type="range"
            min="0"
            max={videoDuration || 240}
            step="0.1"
            value={Math.min(videoTime, videoDuration || videoTime || 0)}
            onChange={(event) => seekVideo(Number(event.currentTarget.value))}
          />
          <div className="admin-panel__buttons">
            <button type="button" onClick={() => seekVideo(videoTime - 5)}>
              -5s
            </button>
            <button type="button" onClick={() => seekVideo(190)}>
              03:10
            </button>
            <button type="button" onClick={() => seekVideo(195)}>
              03:15
            </button>
            <button type="button" onClick={() => seekVideo(videoTime + 5)}>
              +5s
            </button>
          </div>
        </aside>
      )}
    </main>
  );
}
