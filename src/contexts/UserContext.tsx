import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_tier: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface UserContextType {
  user: User | null;
  workspace: Workspace | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = async () => {
    console.log('👤 [START] Loading user data from session...');
    
    try {
      // 1. Get session from Supabase - NO destructuring yet
      let sessionResult = null;
      
      try {
        console.log('📞 Calling auth.getSession()...');
        sessionResult = await auth.getSession();
        console.log('📦 Raw session result type:', typeof sessionResult);
        console.log('📦 Raw session result:', JSON.stringify(sessionResult, null, 2));
      } catch (err) {
        console.error('❌ auth.getSession() threw error:', err);
        setUser(null);
        setWorkspace(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      if (sessionResult === null || sessionResult === undefined) {
        console.error('❌ auth.getSession() returned null/undefined');
        setUser(null);
        setWorkspace(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      // Check what properties exist
      console.log('🔍 sessionResult keys:', Object.keys(sessionResult));

      // NOW access properties safely
      const currentSession = sessionResult.session ?? null;
      const sessionError = sessionResult.error ?? null;
      
      console.log('📦 Extracted session:', currentSession ? 'EXISTS' : 'NULL');
      console.log('📦 Extracted error:', sessionError);
      
      if (sessionError) {
        console.log('❌ Session error:', sessionError);
        setUser(null);
        setWorkspace(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      if (!currentSession) {
        console.log('❌ No active session (session is null)');
        setUser(null);
        setWorkspace(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      console.log('✅ Session found:', currentSession.user?.email);
      setSession(currentSession);

      // 2. Extract user from session
      const userData: User = {
        id: currentSession.user.id,
        email: currentSession.user.email || '',
        first_name: currentSession.user.user_metadata?.first_name || '',
        last_name: currentSession.user.user_metadata?.last_name || '',
        full_name: `${currentSession.user.user_metadata?.first_name || ''} ${currentSession.user.user_metadata?.last_name || ''}`.trim() || currentSession.user.email?.split('@')[0] || 'User',
        avatar_url: currentSession.user.user_metadata?.avatar_url
      };
      
      setUser(userData);
      console.log('✅ User data loaded:', userData.full_name);

      // 3. Get workspace from localStorage (set during signup/login)
      const storedWorkspace = localStorage.getItem('hh_workspace');
      if (storedWorkspace) {
        const workspaceData = JSON.parse(storedWorkspace);
        setWorkspace(workspaceData);
        console.log('✅ Workspace loaded from localStorage:', workspaceData.name);
      } else {
        // Fetch from backend if not in localStorage
        console.log('📁 Fetching workspace from backend...');
        const workspacesResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/workspaces`,
          {
            headers: {
              'Authorization': `Bearer ${currentSession.access_token}`
            }
          }
        );

        if (workspacesResponse.ok) {
          const workspacesData = await workspacesResponse.json();
          if (workspacesData.workspaces && workspacesData.workspaces.length > 0) {
            const firstWorkspace = workspacesData.workspaces[0];
            setWorkspace(firstWorkspace);
            localStorage.setItem('hh_workspace', JSON.stringify(firstWorkspace));
            console.log('✅ Workspace fetched and stored:', firstWorkspace.name);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    await loadUserData();
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out...');
      await auth.signOut();
      localStorage.removeItem('hh_workspace');
      setUser(null);
      setWorkspace(null);
      setSession(null);
      console.log('✅ Logged out');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  useEffect(() => {
    loadUserData();

    // Listen for auth state changes
    const subscription = auth.onAuthStateChange((event, newSession) => {
      console.log('🔄 Auth state changed:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadUserData();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setWorkspace(null);
        setSession(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        workspace,
        session,
        isLoading,
        isAuthenticated: !!session,
        refreshUser,
        logout
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}