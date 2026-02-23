import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from './info'

// Supabase configuration - using Figma Make's auto-generated values
const supabaseUrl = `https://${projectId}.supabase.co`
const supabaseAnonKey = publicAnonKey

// Create Supabase client with optimized auth settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'hh-auth-token',
    flowType: 'pkce'
  }
})

// Auth helpers
export const auth = {
  // Sign up with email/password
  signUp: async (email: string, password: string, metadata?: any) => {
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata, // first_name, last_name, company, etc.
        },
      })
      return { data: result?.data || null, error: result?.error || null }
    } catch (error) {
      console.error('🔐 Supabase signUp error:', error)
      return { data: null, error }
    }
  },

  // Sign in with email/password
  signIn: async (email: string, password: string) => {
    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { data: result?.data || null, error: result?.error || null }
    } catch (error) {
      console.error('🔐 Supabase signIn error:', error)
      return { data: null, error }
    }
  },

  // Sign in with OAuth (Google, Microsoft, etc.)
  signInWithOAuth: async (provider: 'google' | 'azure') => {
    try {
      const result = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            // Preserve the auth state in the URL
            next: '/auth-callback'
          }
        },
      })
      return { data: result?.data || null, error: result?.error || null }
    } catch (error) {
      console.error('🔐 Supabase signInWithOAuth error:', error)
      return { data: null, error }
    }
  },

  // Sign out
  signOut: async () => {
    try {
      const result = await supabase.auth.signOut()
      return { error: result?.error || null }
    } catch (error) {
      console.error('🔐 Supabase signOut error:', error)
      return { error }
    }
  },

  // Get current session
  getSession: async () => {
    try {
      const result = await supabase.auth.getSession()
      console.log('🔐 Supabase getSession result:', result)
      return { session: result?.data?.session || null, error: result?.error || null }
    } catch (error) {
      console.error('🔐 Supabase getSession error:', error)
      return { session: null, error }
    }
  },

  // Get current user
  getUser: async () => {
    try {
      const result = await supabase.auth.getUser()
      console.log('🔐 Supabase getUser result:', result)
      return { user: result?.data?.user || null, error: result?.error || null }
    } catch (error) {
      console.error('🔐 Supabase getUser error:', error)
      return { user: null, error }
    }
  },

  // Reset password
  resetPassword: async (email: string) => {
    try {
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      return { data: result?.data || null, error: result?.error || null }
    } catch (error) {
      console.error('🔐 Supabase resetPassword error:', error)
      return { data: null, error }
    }
  },

  // Update user metadata
  updateUser: async (updates: any) => {
    try {
      const result = await supabase.auth.updateUser({
        data: updates,
      })
      return { data: result?.data || null, error: result?.error || null }
    } catch (error) {
      console.error('🔐 Supabase updateUser error:', error)
      return { data: null, error }
    }
  },

  // Listen to auth state changes
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    const { data } = supabase.auth.onAuthStateChange(callback)
    return data.subscription
  },
}

// Export types
export type User = {
  id: string
  email: string
  user_metadata: {
    first_name?: string
    last_name?: string
    avatar_url?: string
    company?: string
    role?: string
  }
}

export type Session = {
  access_token: string
  refresh_token: string
  user: User
}