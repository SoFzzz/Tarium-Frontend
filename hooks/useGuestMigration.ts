'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { usePersistenceAdapter } from '@/lib/persistence';

interface UseGuestMigration {
  migrating: boolean;
  error: string | null;
}

export function useGuestMigration(): UseGuestMigration {
  const { session } = useAuth();
  const persistence = usePersistenceAdapter();
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const migrate = useCallback(async () => {
    // BUGS.txt: No hay backend REST ni migracion remota en este proyecto.
    return;

    setMigrating(true);
    setError(null);

    // (intencionalmente no-op)
  }, [persistence, session]);

  // Ejecutar migración una vez cuando aparece una sesión autenticada.
  useEffect(() => {
    if (session && !migrating) {
      void migrate();
    }
  }, [migrate, migrating, session]);

  return { migrating, error };
}
