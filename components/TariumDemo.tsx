'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useFavorites } from '@/hooks/useFavorites';
import { Button } from '@heroui/react';
import { useState } from 'react';

export function AuthSection() {
  const { user, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (loading) {
    return <div>Cargando autenticación...</div>;
  }

  if (!user) {
    return (
      <div className="p-4 border rounded">
        <h2 className="text-lg font-bold mb-4">Iniciar Sesión</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full p-2 mb-2 border rounded"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full p-2 mb-4 border rounded"
        />
        <Button
          onClick={() => signIn(email, password)}
          className="w-full"
        >
          Iniciar Sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded">
      <p>Bienvenido, {user.email}</p>
      <Button onClick={signOut} className="mt-4">
        Cerrar Sesión
      </Button>
    </div>
  );
}

export function PlaylistsSection() {
  const { user } = useAuth();
  const { playlists, loading, createPlaylist } = usePlaylists();
  const [newPlaylistName, setNewPlaylistName] = useState('');

  if (!user) {
    return <div>Debes estar autenticado para ver playlists</div>;
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await createPlaylist(newPlaylistName);
      setNewPlaylistName('');
    } catch (err) {
      console.error('Error creating playlist:', err);
    }
  };

  return (
    <div className="p-4 border rounded mt-4">
      <h2 className="text-lg font-bold mb-4">Mis Playlists</h2>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Nombre de la playlist"
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <Button
          onClick={handleCreatePlaylist}
        >
          Crear
        </Button>
      </div>

      {playlists.length === 0 ? (
        <p>No tienes playlists aún</p>
      ) : (
        <ul className="space-y-2">
          {playlists.map((playlist) => (
            <li key={playlist.id} className="p-2 bg-gray-100 rounded">
              <p className="font-semibold">{playlist.name}</p>
              <p className="text-sm text-gray-600">
                Creado: {new Date(playlist.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FavoritesSection() {
  const { user } = useAuth();
  const { favorites, loading } = useFavorites();

  if (!user) {
    return <div>Debes estar autenticado para ver favoritos</div>;
  }

  return (
    <div className="p-4 border rounded mt-4">
      <h2 className="text-lg font-bold mb-4">Mis Favoritos</h2>

      {favorites.length === 0 ? (
        <p>No tienes favoritos aún</p>
      ) : (
        <ul className="space-y-2">
          {favorites.map((favorite) => (
            <li key={favorite.id} className="p-2 bg-gray-100 rounded">
              <p className="font-semibold">{favorite.title}</p>
              <p className="text-sm text-gray-600">{favorite.artist}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
