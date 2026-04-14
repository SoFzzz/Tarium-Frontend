Tarea 1 — Eliminar el Historial completamente
Eliminar la sección de Historial del proyecto:

Borrar el componente de vista Historial (HistoryView.tsx, RecentlyPlayed.tsx o similar)
Eliminar el ícono/enlace de Historial en la barra de navegación lateral
Eliminar cualquier lógica que registre canciones en el historial (el push o add al array de historial en el store/context)
Borrar el estado de historial del store global si existe (history: [] o similar)
Eliminar cualquier endpoint /api/history o llamada relacionada
Confirmar que no queden imports rotos después de borrar

El resto del plan anterior se mantiene igual.
Bug 2 — Cola y Biblioteca no muestran botón de eliminar
En la vista de cola y en la biblioteca local, cada ítem debe mostrar un ícono de eliminar (basura o X). Si el ícono no aparece, probablemente el botón existe en el JSX pero está oculto con opacity-0 o solo visible en hover sin que el hover funcione correctamente.
Solución: Hacer el botón de eliminar siempre visible en móvil/desktop, no solo en hover:
tsx// Cambiar de esto:
<button className="opacity-0 group-hover:opacity-100">...</button>

// A esto:
<button className="opacity-100">...</button>
Verificar que el handler de eliminar esté conectado correctamente a actions.removeFromQueue(track.id) o equivalente en la biblioteca.

Bug 3 — Importar playlists de Spotify no funciona (0 tracks)
La imagen muestra "No pudimos importar Touhou Jazz & Ballads. Intenta de nuevo" y 0 tracks. El problema es que el endpoint que trae las canciones de una playlist de Spotify falla silenciosamente.
Solución: En el endpoint /api/spotify/playlists/[id]/tracks, verificar:
ts// La URL correcta es:
const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`

// Si falla, devolver array vacío con mensaje claro:
if (!res.ok) return NextResponse.json({ items: [], error: res.status })
También confirmar que el token tiene el scope playlist-read-private (del plan anterior). Sin ese scope, Spotify rechaza la llamada aunque la playlist sea del propio usuario.

Tarea 4 — Eliminar la sección Albums completamente
La sección Albums no tiene funcionalidad y genera confusión. Eliminarla del proyecto:

Borrar el componente de vista Albums (algo como AlbumsView.tsx o AlbumView.tsx)
Borrar la ruta correspondiente en el router
Eliminar el ícono/enlace de Albums en la barra de navegación lateral
Si hay un endpoint /api/spotify/albums o similar, eliminarlo también
Confirmar que no queden imports rotos después de borrar


Validación final
Confirmar que:

Hacer clic en el historial no lanza ningún error en consola
El historial sigue mostrándose visualmente como antes
Los ítems de cola y biblioteca muestran el botón de eliminar sin necesidad de hover
Importar una playlist de Spotify trae las canciones correctamente
La sección Albums ya no existe en navegación ni en el router
npm run build pasa limpio sin imports rotos