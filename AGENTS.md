# Tarium Frontend - Documentation for AI Agents

## Project Overview

Tarium is a music player web application built with Next.js, React, and TypeScript. It allows users to search for music via YouTube and Deezer APIs, play music with a custom player manager, manage playlists, favorites, and import local music files.

## Technology Stack

- **Framework**: Next.js 16.2.3 (App Router)
- **UI Library**: React 19.2.4
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 4, CSS Modules
- **Authentication**: Supabase (Auth UI + Supabase JS)
- **Audio**: Howler.js 2.2.4
- **State Management**: React Context + Custom Hooks
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint 9

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
│   │   └── deezer/search/route.ts    # Deezer API proxy
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
│   ├── SearchPanel.tsx              # Search panel
│   ├── SearchResultList.tsx          # Search results
│   ├── LocalLibraryDropzone.tsx    # Local file dropzone
│   ├── auth/AuthModal.tsx           # Login/signup modal
│   ├── TariumDemo.tsx               # Demo component
│   └── providers.tsx                 # App providers wrapper
├── lib/
│   ├── player/
│   │   ├── player-manager.ts        # Core player logic (MAIN CLASS)
│   │   ├── howler-audio-adapter.ts # Howler.js audio adapter
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
│   ├── api.ts                     # Backend API helpers
│   ├── supabase.ts               # Supabase client
│   ├── deezer.ts                 # Deezer API client
│   ├── youtube.ts                # YouTube API helpers
├── utils.ts                  # Utility functions
├── hooks/
│   ├── usePlayerManager.ts       # Player manager hook
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

Bridge between PlayerManager and Howler.js audio library.

## Providers Architecture

```
AppProviders (components/providers.tsx)
└── ThemeProvider (next-themes)
    └── AuthProvider
        └── PlayerApp
            └── PlayerProvider
                └── PlayerHistoryProvider
```

## API Configuration

- **Backend API**: `NEXT_PUBLIC_API_URL` (default: `http://localhost:3001`)
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **YouTube**: `NEXT_PUBLIC_YOUTUBE_API_KEY`
- **Deezer**: Proxied via `/api/deezer/search`

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
NEXT_PUBLIC_YOUTUBE_API_KEY=your_key
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_DEEZER_API_URL=https://api.deezer.com/...
```

## Design Patterns

1. **Context + Hooks**: Use React Context for global state, hooks for encapsulation
2. **Media Adapter**: Abstract audio playback behind `MediaAdapter` interface
3. **Custom Data Structures**: DoublyLinkedList for efficient queue operations
4. **Provider Injection**: Providers wrap components for dependency injection

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
  album?: string;
  duration?: number;
  coverUrl?: string;
  audioUrl: string;
  source: 'youtube' | 'deezer' | 'local';
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

type RepeatMode = 'off' | 'all' | 'one';
```