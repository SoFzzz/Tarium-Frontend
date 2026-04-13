// Configuración de la API del Backend
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Headers por defecto para las requests
export function getAuthHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Función helper para hacer requests autenticadas
export async function authenticatedFetch(
  url: string,
  token: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(token),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API Error');
  }

  // 204 No Content - retorna null
  if (response.status === 204) {
    return null;
  }

  return response.json();
}
