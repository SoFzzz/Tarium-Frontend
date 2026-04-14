# Tarium Frontend - Documentation for AI Agents

## Project Overview

Tarium is a music player web application built with Next.js, React, and TypeScript. It allows users to search for music via Spotify (primary) and YouTube/Deezer APIs, play music with a custom player manager supporting multiple audio sources, manage playlists, favorites, and import local music files.

## Technology Stack

- **Framework**: Next.js 16.2.3 (App Router)
- **UI Library**: React 19.2.4
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 4
- **Authentication**: Supabase (Auth UI + Supabase JS) + Spotify OAuth PKCE
- **Audio**: Howler.js 2.2.4 + Spotify Web Playback SDK
- **State Management**: React Context + Custom Hooks
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint 9
- **Package Manager**: npm

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@dnd-kit/core`, `@dnd-kit/sortable` | Drag and drop for playlists |
| `@radix-ui/react-dialog`, `@radix-ui/react-slider`, `@radix-ui/react-tooltip` | UI components |
| `lucide-react` | Icons |
| `music-metadata-browser` | Parse local audio file metadata |
| `react-dropzone` | File dropzone for local music |
| `next-themes` | Dark/light theme support |

## Project Structure

```
Tarium-Frontend/
├── app/
│   ├── api/
│   │   ├── deezer/search/route.ts    # Deezer API proxy (legacy)
│   │   └── spotify/                  # Spotify OAuth + API
│   │       ├── login/route.ts        # OAuth PKCE login
│   │       ├── callback/route.ts     # OAuth callback + token exchange
│   │       ├── search/route.ts       # Search tracks (server-side proxy)
│   │       ├── token/route.ts        # Get access token for SDK
│   │       ├── refresh/route.ts      # Refresh access token
│   │       └── me/route.ts           # Get user profile
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Home page (PlayerApp)
│   └── globals.css                  # Global styles
├── components/
│   ├── player/
│   │   ├── PlayerShell.tsx          # Main player UI
│   │   ├── PlayerApp.tsx           # Root player component
│   │   ├── PlaylistsView.tsx       # Playlists management
│   │   ├── FavoritesView.tsx       # Favorites view
│   │   └── LibraryView.tsx         # Local library view
│   ├── ui/                          # Reusable UI components
│   │   ├── button.tsx
│   │   ├── slider.tsx
│   │   ├── tooltip.tsx
│   │   └── scroll-area.tsx
│   ├── SearchPanel.tsx              # Search panel (Spotify)
│   ├── SearchResultList.tsx          # Search results
│   ├── LocalLibraryDropzone.tsx    # Local file dropzone
│   ├── auth/AuthModal.tsx           # Login/signup modal (Supabase)
│   ├── TariumDemo.tsx               # Demo component
│   └── providers.tsx                 # App providers wrapper
├── lib/
│   ├── player/
│   │   ├── player-manager.ts        # Core player logic (MAIN CLASS)
│   │   ├── howler-audio-adapter.ts # Howler.js audio adapter (local files)
│   │   ├── spotify-audio-adapter.ts # Spotify Web Playback SDK adapter
│   │   ├── multi-source-audio-adapter.ts # Routes to correct adapter
│   │   ├── media-adapter.ts       # Media adapter interface
│   │   ├── types.ts                # Player types
│   │   ├── mock-tracks.ts         # Mock data for testing
│   │   └── structures/
│   │       ├── doubly-linked-list.ts # Queue data structure
│   │       └── node.ts             # Node structure
│   ├── local-library/
│   │   ├── LocalTrackParserService.ts  # Parse local audio files
│   │   └── LocalLibraryStore.ts       # Local library persistence
│   ├── persistence/
│   │   ├── index.ts               # Persistence exports
│   │   ├── LocalStorageAdapter.ts # LocalStorage wrapper
│   │   └── types.ts               # Persistence types
│   ├── spotify.ts                # Spotify API client
│   ├── api.ts                     # Backend API helpers
│   ├── supabase.ts               # Supabase client
│   ├── deezer.ts                 # Deezer API client (legacy)
│   ├── youtube.ts                # YouTube API helpers
│   └── utils.ts                  # Utility functions
├── hooks/
│   ├── usePlayerManager.ts       # Player manager hook
│   ├── useSpotifySession.ts     # Spotify session management
│   ├── useFavorites.ts            # Favorites management
│   ├── usePlaylists.ts           # Playlists management
│   ├── useHistory.ts             # Playback history
│   └── useGuestMigration.ts      # Guest user migration
├── providers/
│   ├── AuthProvider.tsx          # Supabase authentication
│   ├── PlayerProvider.tsx        # Player context provider
│   └── PlayerHistoryProvider.tsx # History provider
├── tests/
│   ├── setup.ts                   # Test setup
│   ├── use-player-manager.test.tsx
│   └── player-manager.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
└── .env.example
```

## Core Classes and Components

### PlayerManager (`lib/player/player-manager.ts`)

Central player logic class. Key methods:

- `loadQueue(tracks)` / `setQueue(tracks)` - Load/replace queue
- `addTrack(track)` / `addTrackNext(track)` - Add tracks
- `removeTrack(id)` - Remove track from queue
- `play()` / `pause()` / `togglePlayPause()` - Playback control
- `playById(id)` / `playNext()` / `playPrevious()` - Navigation
- `seek(seconds)` - Seek to position
- `setVolume(volume)` - Volume control
- `shuffle()` - Shuffle queue
- `cycleRepeatMode()` - Toggle repeat off/all/one
- `subscribe(listener)` - Subscribe to state changes
- `onTrackPlay(listener)` - Listen for track plays

### DoublyLinkedList (`lib/player/structures/doubly-linked-list.ts`)

Custom data structure for queue management with O(1) insert/delete operations.

### HowlerAudioAdapter (`lib/player/howler-audio-adapter.ts`)

Bridge between PlayerManager and Howler.js audio library. Used for local file playback.

### SpotifyAudioAdapter (`lib/player/spotify-audio-adapter.ts`)

Bridge between PlayerManager and Spotify Web Playback SDK. Handles:
- `play(track)` - PUT to `/v1/me/player/play?device_id=...` with `uris: [track.audioUrl]`
- `pause()` / `resume()` / `seek(ms)` / `setVolume(v)`
- `onTimeUpdate(cb)` - Polls `getCurrentState()` every 500ms
- `onEnded(cb)` - Detects end when `paused===true` and `position===0`

### MultiSourceAudioAdapter (`lib/player/multi-source-audio-adapter.ts`)

Routes playback to the appropriate adapter:
- If `track.audioUrl` starts with `spotify:` → uses SpotifyAudioAdapter
- Otherwise → uses HowlerAudioAdapter (local files)

### Spotify Client (`lib/spotify.ts`)

Exports:
- `searchTracks(query, token)` - Search tracks via `/v1/search?type=track`
- `getTrack(id, token)` - Get single track via `/v1/tracks/{id}`
- `refreshAccessToken(refreshToken)` - Refresh access token
- `refreshAccessTokenWithExpiresIn(refreshToken)` - Returns `{ accessToken, expiresIn }`

## OAuth PKCE Flow

1. **Login** (`/api/spotify/login`): Generates `state` + `code_verifier`, creates `code_challenge (S256)`, redirects to Spotify authorize URL with scopes: `streaming user-read-email user-read-private user-modify-playback-state`.

2. **Callback** (`/api/spotify/callback`): Receives `code`, validates `state`, exchanges for `access_token` + `refresh_token`, stores in HTTP-only cookies (`spotify_access_token`, `spotify_refresh_token`, `spotify_expires_at`).

3. **Token Refresh** (`/api/spotify/refresh`): Uses `refresh_token` to get new `access_token`, updates cookies.

4. **Token Endpoint** (`/api/spotify/token`): Returns current access token (auto-refreshes if expiring).

5. **User Profile** (`/api/spotify/me`): Returns `{ displayName, avatarUrl, id, email }` from Spotify.

## Providers Architecture

```
AppProviders (components/providers.tsx)
└── ThemeProvider (next-themes)
    └── AuthProvider (Supabase)
        └── PlayerApp
            └── PlayerProvider
                └── PlayerHistoryProvider
```

## API Configuration

- **Backend API**: `NEXT_PUBLIC_API_URL` (default: `http://localhost:3001`)
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **YouTube**: `NEXT_PUBLIC_YOUTUBE_API_KEY`
- **Spotify**: Uses OAuth PKCE (no client-side token exposure)

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint      # Run ESLint
npm run test     # Run Vitest tests
```

## Environment Variables (.env.local)

```
# Spotify OAuth (PKCE) - REQUIRED for Spotify integration
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback

# YouTube (optional)
NEXT_PUBLIC_YOUTUBE_API_KEY=your_key

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# App
NEXT_PUBLIC_APP_ENV=development

# Deezer (legacy - not used)
NEXT_PUBLIC_DEEZER_API_URL=https://api.deezer.com/...
```

## Design Patterns

1. **Context + Hooks**: Use React Context for global state, hooks for encapsulation
2. **Media Adapter**: Abstract audio playback behind `MediaAdapter` interface
3. **Custom Data Structures**: DoublyLinkedList for efficient queue operations
4. **Provider Injection**: Providers wrap components for dependency injection
5. **Multi-Source Routing**: `MultiSourceAudioAdapter` selects correct backend (Spotify SDK vs Howler) based on track's `audioUrl`

## Testing

- **Framework**: Vitest
- **Assertions**: @testing-library/jest-dom
- **Run tests**: `npm run test`

## Key Types (`lib/player/types.ts`)

```typescript
interface ITrack {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  durationInSeconds?: number;
  album?: string;
  // URI/URL for remote sources (Spotify uses spotify:track:...)
  audioUrl?: string;
  // For local files
  fileName?: string;
  objectUrl?: string;
  sourceType?: "local" | "remote";
  // Source identifier for UI/analytics/routing
  source?: "spotify" | "deezer" | "youtube" | "local";
}

type PlaybackState = {
  isPlaying: boolean;
  loading: boolean;
  volume: number;
  repeatMode: RepeatMode;
  currentTrack: ITrack | null;
  queue: ITrack[];
  progressSeconds: number;
  durationSeconds: number;
  error: string | null;
  canPlay: boolean;
};

type RepeatMode = "off" | "all" | "one";
```

## Spotify Integration Notes

- Search is performed server-side via `/api/spotify/search` to avoid exposing tokens
- Token refresh happens automatically on search if expiring (<60s)
- The Spotify Web Playback SDK script is loaded via `useEffect` in `PlayerApp.tsx`
- UI shows "Conectar con Spotify" button or user profile (name + avatar) when connected
- Spotify session state is managed via `useSpotifySession` hook