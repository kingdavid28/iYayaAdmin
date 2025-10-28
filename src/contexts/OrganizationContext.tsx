// src/contexts/OrganizationContext.tsx
import React, {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {supabase} from '../config/supabase';

interface OrganizationContextValue {
  organizationId: string | null;
  setOrganizationId: (id: string | null) => void;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({children}) => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const {data} = await supabase.auth.getSession();
        if (isMounted) {
          setOrganizationId(data.session?.user?.user_metadata?.organization_id ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('[OrganizationProvider] Failed to load session', error);
        if (isMounted) {
          setOrganizationId(null);
          setLoading(false);
        }
      }
    };

    const {data: authListener} = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setOrganizationId(session?.user?.user_metadata?.organization_id ?? null);
        setLoading(false);
      }
    });

    loadSession();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<OrganizationContextValue>(
    () => ({organizationId, setOrganizationId, loading}),
    [loading, organizationId]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};

export const useOrganization = (): OrganizationContextValue => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};