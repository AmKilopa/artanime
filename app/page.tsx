"use client";

import { useEffect, useRef, useState } from "react";

const COUNTDOWN_FROM = 5;
const VIDEO_SRC =
  "https://raw.githubusercontent.com/AmKilopa/artanime/main/public/videos/artanime.mp4";
const PHRASES_SRC = "/phrases.txt";

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

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function makePhrase(text: string): FlyingPhrase {
  const x =
    Math.random() > 0.5
      ? 68 + Math.random() * 24
      : 8 + Math.random() * 24;

  return {
    id: Date.now() + Math.random(),
    text,
    x,
    y: 5 + Math.random() * 84,
    size: 0.9 + Math.random() * 1.6,
    rotate: -14 + Math.random() * 28,
    duration: 3000 + Math.random() * 1000,
  };
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("ready");
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [flash, setFlash] = useState(false);
  const [phrases, setPhrases] = useState(FALLBACK_PHRASES);
  const [flyingPhrases, setFlyingPhrases] = useState<FlyingPhrase[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lockFullscreenRef = useRef(false);

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

  useEffect(() => {
    fetch(PHRASES_SRC, { cache: "no-store" })
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        const next = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (next.length > 0) setPhrases(next);
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

    const resumeVideo = () => {
      if (!video.ended) void video.play();
    };

    video.currentTime = 0;
    video.muted = false;
    video.volume = 1;
    void video.play();

    video.addEventListener("pause", resumeVideo);
    return () => {
      video.removeEventListener("pause", resumeVideo);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "playing") {
      setFlyingPhrases([]);
      return;
    }

    const spawn = () => {
      const batchSize = 2 + Math.floor(Math.random() * 3);
      const batch = Array.from({ length: batchSize }, () =>
        makePhrase(pick(phrases)),
      );
      setFlyingPhrases((current) => [...current.slice(-18), ...batch]);

      for (const item of batch) {
        window.setTimeout(() => {
          setFlyingPhrases((current) =>
            current.filter((phrase) => phrase.id !== item.id),
          );
        }, item.duration);
      }
    };

    spawn();
    const interval = window.setInterval(spawn, 900);
    return () => window.clearInterval(interval);
  }, [phrases, stage]);

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
      video.muted = false;
      video.volume = 0.08;
      video.currentTime = 0;
      void video.play().catch(() => {});
    }

    setCount(COUNTDOWN_FROM);
    setStage("counting");
  };

  const isVideoVisible = stage === "playing" || stage === "ended";

  return (
    <main className={`landing landing--${stage}`}>
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
    </main>
  );
}
