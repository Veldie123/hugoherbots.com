import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { entitlementsService, UserEntitlement, ContentAccessResult } from '@/services/entitlementsService';

export function useUserEntitlements() {
  const { user } = useUser();
  const [entitlements, setEntitlements] = useState<UserEntitlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setEntitlements([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    entitlementsService
      .getUserEntitlements(user.id)
      .then(setEntitlements)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [user?.id]);

  const hasFeature = useCallback(
    (featureCode: string): boolean => {
      return entitlements.some((e) => e.featureCode === featureCode);
    },
    [entitlements]
  );

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    entitlementsService.clearUserCache(user.id);
    const fresh = await entitlementsService.getUserEntitlements(user.id);
    setEntitlements(fresh);
  }, [user?.id]);

  return {
    entitlements,
    isLoading,
    error,
    hasFeature,
    refresh,
  };
}

export function useFeatureAccess(featureCode: string): {
  hasAccess: boolean;
  isLoading: boolean;
} {
  const { user } = useUser();
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    entitlementsService
      .hasFeature(user.id, featureCode)
      .then(setHasAccess)
      .finally(() => setIsLoading(false));
  }, [user?.id, featureCode]);

  return { hasAccess, isLoading };
}

export function useContentAccess(
  contentType: 'video' | 'webinar' | 'course' | 'technique',
  contentId: string
): {
  access: ContentAccessResult | null;
  isLoading: boolean;
} {
  const { user } = useUser();
  const [access, setAccess] = useState<ContentAccessResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !contentId) {
      setAccess({ hasAccess: true, isPreview: false, reason: 'No user' });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    entitlementsService
      .checkContentAccess(user.id, contentType, contentId)
      .then(setAccess)
      .finally(() => setIsLoading(false));
  }, [user?.id, contentType, contentId]);

  return { access, isLoading };
}

export function useCanAccessVideo(videoId: string) {
  return useContentAccess('video', videoId);
}

export function useCanAccessWebinar(webinarId: string) {
  return useContentAccess('webinar', webinarId);
}

export function useCanUseAiChat() {
  return useFeatureAccess('ai_chat');
}

export function useCanUploadRoleplay() {
  return useFeatureAccess('roleplay_upload');
}
