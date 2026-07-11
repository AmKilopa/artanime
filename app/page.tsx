"use client";

import { useEffect, useRef, useState } from "react";

const COUNTDOWN_FROM = 5;
const VIDEO_SRC =
  "https://raw.githubusercontent.com/AmKilopa/artanime/main/public/videos/artanime.mp4";

type Stage = "ready" | "counting" | "playing" | "ended";

export default function Home() {
  const [stage, setStage] = useState<Stage>("ready");
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

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

  useEffect(() => {
    if (stage !== "counting") {
      return;
    }

    if (count === 0) {
      playTone(880, 0.24, 0.28);
      const timer = window.setTimeout(() => setStage("playing"), 650);
      return () => window.clearTimeout(timer);
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

    const resumeVideo = () => {
      if (!video.ended) void video.play();
    };

    video.currentTime = 0;
    video.muted = false;
    video.volume = 1;
    void video.play();

    video.addEventListener("pause", resumeVideo);
    return () => video.removeEventListener("pause", resumeVideo);
  }, [stage]);

  const startCountdown = () => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    void audioRef.current.resume();
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
            onEnded={() => setStage("ended")}
            tabIndex={-1}
          />
          {stage === "ended" && <p className="final-note">Video ended</p>}
        </div>
      </section>
    </main>
  );
}
