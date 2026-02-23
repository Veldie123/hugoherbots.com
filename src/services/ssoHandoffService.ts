import { supabase } from '@/utils/supabase/client';
import type { HandoffResult } from '@/types/crossPlatform';

export type { HandoffResult };

const AI_PLATFORM_URL = import.meta.env.VITE_HUGO_AI_URL || 'https://hugoherbots-ai-chat.replit.app';

export const ssoHandoffService = {
  /**
   * Generate a handoff URL to navigate to the .ai platform
   * The URL includes a one-time token that the .ai platform can exchange for a session
   */
  async generateHandoffUrl(targetPath?: string): Promise<HandoffResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Generate handoff token via RPC
      const { data: token, error } = await supabase.rpc('generate_sso_handoff_token', {
        p_user_id: user.id,
        p_source_platform: 'com',
        p_target_platform: 'ai',
        p_target_path: targetPath || '/',
        p_ttl_seconds: 60, // Token valid for 60 seconds
      });

      if (error) {
        console.error('[SSO] Failed to generate handoff token:', error);
        return { success: false, error: 'Failed to generate handoff token' };
      }

      // Build the handoff URL
      const handoffUrl = new URL('/auth/handoff', AI_PLATFORM_URL);
      handoffUrl.searchParams.set('token', token);
      if (targetPath) {
        handoffUrl.searchParams.set('redirect', targetPath);
      }

      return { success: true, url: handoffUrl.toString() };
    } catch (error) {
      console.error('[SSO] Handoff error:', error);
      return { success: false, error: 'Handoff failed' };
    }
  },

  /**
   * Validate a handoff token received from another platform
   * Returns the user_id if valid
   */
  async validateHandoffToken(token: string, expectedPlatform: string = 'com'): Promise<{ valid: boolean; userId?: string; targetPath?: string }> {
    try {
      const { data, error } = await supabase.rpc('validate_sso_handoff_token', {
        p_token: token,
        p_expected_target_platform: expectedPlatform,
      });

      if (error || !data || data.length === 0 || !data[0].valid) {
        return { valid: false };
      }

      return {
        valid: true,
        userId: data[0].user_id,
        targetPath: data[0].target_path,
      };
    } catch (error) {
      console.error('[SSO] Token validation error:', error);
      return { valid: false };
    }
  },

  /**
   * Navigate to the .ai platform with SSO handoff
   */
  async navigateToAiPlatform(targetPath?: string): Promise<void> {
    const result = await this.generateHandoffUrl(targetPath);
    
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      // Fallback: navigate without SSO (user will need to log in)
      console.warn('[SSO] Handoff failed, navigating without SSO');
      window.location.href = `${AI_PLATFORM_URL}${targetPath || ''}`;
    }
  },

  /**
   * Open the .ai platform in a new tab with SSO handoff
   */
  async openAiPlatformInNewTab(targetPath?: string): Promise<void> {
    const result = await this.generateHandoffUrl(targetPath);
    
    if (result.success && result.url) {
      window.open(result.url, '_blank');
    } else {
      // Fallback
      window.open(`${AI_PLATFORM_URL}${targetPath || ''}`, '_blank');
    }
  },

  /**
   * Build a link component props for cross-platform navigation
   */
  async getCrossPlatformLink(targetPath?: string): Promise<{ href: string; onClick?: () => Promise<void> }> {
    // For SSO, we need to generate the token on click (tokens expire quickly)
    return {
      href: `${AI_PLATFORM_URL}${targetPath || ''}`,
      onClick: async () => {
        await this.navigateToAiPlatform(targetPath);
      },
    };
  },
};

/**
 * Hook for handling incoming SSO handoff tokens
 * Use this on pages that might receive handoff tokens
 */
export async function handleIncomingHandoff(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('sso_token') || params.get('token');
  
  if (!token) {
    return false;
  }

  const result = await ssoHandoffService.validateHandoffToken(token);
  
  if (!result.valid) {
    console.warn('[SSO] Invalid or expired handoff token');
    return false;
  }

  // Token is valid - the user should now be authenticated
  // Clean up the URL
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('sso_token');
  cleanUrl.searchParams.delete('token');
  window.history.replaceState({}, '', cleanUrl.toString());

  // Redirect to target path if specified
  if (result.targetPath && result.targetPath !== window.location.pathname) {
    window.location.href = result.targetPath;
  }

  return true;
}
