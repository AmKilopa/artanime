"use client";

import { useEffect, useRef, useState } from "react";

const COUNTDOWN_FROM = 5;
const VIDEO_SRC =
  "https://github.com/AmKilopa/artanime/raw/refs/heads/main/public/videos/artanime.mp4";

type Stage = "ready" | "counting" | "playing" | "ended";

export default function Home() {
  const [stage, setStage] = useState<Stage>("ready");
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stage !== "counting") {
      return;
    }

    if (count === 0) {
      const timer = window.setTimeout(() => setStage("playing"), 650);
      return () => window.clearTimeout(timer);
    }

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
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = 0;
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
