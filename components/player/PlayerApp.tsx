"use client";

import { useEffect } from "react";
import { PlayerProvider } from "@/providers/PlayerProvider";
import { PlayerShell } from "./PlayerShell";
import { PlayerHistoryProvider } from "@/providers/PlayerHistoryProvider";

export function PlayerApp() {
  // Fix 3: Clean OAuth query params from URL after redirect
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("spotify") || url.searchParams.has("spotify_error")) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    const id = "spotify-player-sdk";
    if (document.getElementById(id)) return;

    // Define the callback BEFORE loading the script so it's available
    // when the SDK finishes loading. If a previous callback exists, chain it.
    if (!window.onSpotifyWebPlaybackSDKReady) {
      window.onSpotifyWebPlaybackSDKReady = () => {
        // Noop — the actual initialization happens in SpotifyAudioAdapter.
        // This prevents "onSpotifyWebPlaybackSDKReady is not defined" console errors.
      };
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  return (
    <PlayerProvider>
      <PlayerHistoryProvider>
        <PlayerShell />
      </PlayerHistoryProvider>
    </PlayerProvider>
  );
}
