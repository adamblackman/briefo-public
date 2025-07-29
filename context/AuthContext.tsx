import React,
{ createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isNewUser: boolean;
  userCategories: string[] | null;
  userCompanies: string[] | null;
  logout: () => Promise<void>;
  setSigningUp: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userCategories, setUserCategories] = useState<string[] | null>(null);
  const [userCompanies, setUserCompanies] = useState<string[] | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Check if user has completed onboarding
  const checkUserOnboarding = async (userId: string) => {
    try {
      // Skip profile check during signup flow
      if (isSigningUp) {
        setIsNewUser(true);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('news_categories, favorite_companies')
        .eq('user_id', userId);

      // Handle the case where no rows are returned
      if (error || !data || data.length === 0) {
        console.error('Error checking user profile:', error || { message: 'No profile found' });
        // Set as new user if profile not found
        setIsNewUser(true);
        return;
      }

      // Get the first profile found
      const profile = data[0];
      
      // Store the user's preferences
      setUserCategories(profile.news_categories);
      setUserCompanies(profile.favorite_companies);

      // Determine if user needs to complete onboarding
      setIsNewUser(!profile.news_categories || !profile.favorite_companies);
    } catch (error) {
      console.error('Error in checkUserOnboarding:', error);
      // Set as new user on error
      setIsNewUser(true);
    }
  };

  useEffect(() => {
    const getSession = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('AuthContext: Error getting session:', error.message);
      }
      setSession(data.session);
      setUser(data.session?.user ?? null);
      
      if (data.session?.user && !isSigningUp) {
        await checkUserOnboarding(data.session.user.id);
      } else if (!data.session?.user) {
      } else if (isSigningUp) {
      }
      
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (_event === 'SIGNED_IN' && newSession?.user && !isSigningUp) {
          setLoading(true); 
          await checkUserOnboarding(newSession.user.id);
          setLoading(false); 
        } else if (_event === 'SIGNED_OUT') {
            setIsNewUser(false); 
            setUserCategories(null); 
            setUserCompanies(null); 
        }
        
        if (_event === 'INITIAL_SESSION') {
        } else {
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [isSigningUp]);

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    }
    // The onAuthStateChange listener will handle setting session and user to null
    setLoading(false);
    // Reset signup flag
    setIsSigningUp(false);
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      loading, 
      isNewUser, 
      userCategories, 
      userCompanies, 
      logout,
      setSigningUp: setIsSigningUp
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
