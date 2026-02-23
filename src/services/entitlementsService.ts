import { supabase } from '@/utils/supabase/client';

export interface Feature {
  code: string;
  name: string;
  description?: string;
  category: string;
}

export interface Plan {
  code: string;
  name: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
}

export interface UserEntitlement {
  featureCode: string;
  featureName: string;
  source: 'plan' | 'direct';
  limitValue?: number;
  expiresAt?: string;
}

export interface ContentAccessResult {
  hasAccess: boolean;
  isPreview: boolean;
  reason: string;
}

class EntitlementsService {
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, expires: Date.now() + this.CACHE_TTL });
  }

  async getAvailablePlans(): Promise<Plan[]> {
    const cached = this.getCached<Plan[]>('plans');
    if (cached) return cached;

    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('[Entitlements] Failed to fetch plans:', error);
      return [];
    }

    const plans = data.map(p => ({
      code: p.code,
      name: p.name,
      description: p.description,
      priceMonthly: p.price_monthly,
      priceYearly: p.price_yearly,
    }));

    this.setCache('plans', plans);
    return plans;
  }

  async getAvailableFeatures(): Promise<Feature[]> {
    const cached = this.getCached<Feature[]>('features');
    if (cached) return cached;

    const { data, error } = await supabase
      .from('features')
      .select('*')
      .order('category, name');

    if (error) {
      console.error('[Entitlements] Failed to fetch features:', error);
      return [];
    }

    const features = data.map(f => ({
      code: f.code,
      name: f.name,
      description: f.description,
      category: f.category,
    }));

    this.setCache('features', features);
    return features;
  }

  async getUserEntitlements(userId: string): Promise<UserEntitlement[]> {
    const cacheKey = `entitlements:${userId}`;
    const cached = this.getCached<UserEntitlement[]>(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase.rpc('get_user_entitlements', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[Entitlements] Failed to fetch user entitlements:', error);
      return [];
    }

    const entitlements = data.map((e: any) => ({
      featureCode: e.feature_code,
      featureName: e.feature_name,
      source: e.source as 'plan' | 'direct',
      limitValue: e.limit_value,
      expiresAt: e.expires_at,
    }));

    this.setCache(cacheKey, entitlements);
    return entitlements;
  }

  async hasFeature(userId: string, featureCode: string): Promise<boolean> {
    const entitlements = await this.getUserEntitlements(userId);
    return entitlements.some(e => e.featureCode === featureCode);
  }

  async checkContentAccess(
    userId: string,
    contentType: 'video' | 'webinar' | 'course' | 'technique',
    contentId: string
  ): Promise<ContentAccessResult> {
    const { data, error } = await supabase.rpc('user_has_content_access', {
      p_user_id: userId,
      p_content_type: contentType,
      p_content_id: contentId,
    });

    if (error) {
      console.error('[Entitlements] Content access check failed:', error);
      return { hasAccess: true, isPreview: false, reason: 'Error - allowing access' };
    }

    if (!data || data.length === 0) {
      return { hasAccess: true, isPreview: false, reason: 'No restrictions' };
    }

    return {
      hasAccess: data[0].has_access,
      isPreview: data[0].is_preview,
      reason: data[0].reason,
    };
  }

  async canAccessVideo(userId: string, videoId: string): Promise<boolean> {
    const result = await this.checkContentAccess(userId, 'video', videoId);
    return result.hasAccess;
  }

  async canAccessWebinar(userId: string, webinarId: string): Promise<boolean> {
    const result = await this.checkContentAccess(userId, 'webinar', webinarId);
    return result.hasAccess;
  }

  async canUseAiChat(userId: string): Promise<boolean> {
    return this.hasFeature(userId, 'ai_chat');
  }

  async canUploadRoleplay(userId: string): Promise<boolean> {
    return this.hasFeature(userId, 'roleplay_upload');
  }

  async canAccessTechniqueLibrary(userId: string): Promise<boolean> {
    return this.hasFeature(userId, 'technique_library');
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearUserCache(userId: string): void {
    this.cache.delete(`entitlements:${userId}`);
  }
}

export const entitlementsService = new EntitlementsService();

export function useEntitlements() {
  return entitlementsService;
}
