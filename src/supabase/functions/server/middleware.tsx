/**
 * Security Middleware - Phase 1 Implementation
 * HugoHerbots.ai Backend Security Layer
 */

import { Context, Next } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// REQUEST ID MIDDLEWARE
// ============================================

/**
 * Generate and attach unique request ID to every request
 * Enables tracing across logs and error reporting
 */
export async function requestIdMiddleware(c: Context, next: Next) {
  const requestId = crypto.randomUUID();
  
  // Store in context
  c.set('requestId', requestId);
  
  // Return in response headers
  c.header('X-Request-Id', requestId);
  
  // Log request start
  const startTime = Date.now();
  console.log(`[${requestId}] → ${c.req.method} ${c.req.url}`);
  
  await next();
  
  // Log request completion
  const duration = Date.now() - startTime;
  console.log(`[${requestId}] ← ${c.res.status} (${duration}ms)`);
}

// ============================================
// JWT VERIFICATION MIDDLEWARE
// ============================================

/**
 * Extract and verify JWT from Authorization header
 * Validates signature, issuer, and audience
 * Attaches authenticated user to context
 */
export async function requireAuth(c: Context, next: Next) {
  const requestId = c.get('requestId') || 'unknown';
  
  try {
    // Extract token from Authorization header
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error(`[${requestId}] ❌ Missing or invalid Authorization header`);
      return c.json({ 
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
        code: 'AUTH_HEADER_MISSING'
      }, 401);
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Verify JWT and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error(`[${requestId}] ❌ JWT verification failed:`, error?.message);
      return c.json({ 
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        code: 'JWT_VERIFICATION_FAILED',
        details: error?.message
      }, 401);
    }
    
    // Attach user to context
    c.set('user', user);
    c.set('userId', user.id);
    
    console.log(`[${requestId}] ✅ Authenticated user: ${user.email} (${user.id})`);
    
    await next();
    
  } catch (error: any) {
    console.error(`[${requestId}] ❌ Auth middleware error:`, error.message);
    return c.json({ 
      error: 'Internal server error',
      message: 'Authentication check failed',
      code: 'AUTH_MIDDLEWARE_ERROR'
    }, 500);
  }
}

/**
 * Optional auth - attaches user if present, but doesn't require it
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (user) {
      c.set('user', user);
      c.set('userId', user.id);
    }
  }
  
  await next();
}

// ============================================
// WORKSPACE MIDDLEWARE
// ============================================

/**
 * Require workspace membership
 * Validates that user is a member of the specified workspace
 * Attaches workspace context to request
 */
export async function requireWorkspace(c: Context, next: Next) {
  const requestId = c.get('requestId') || 'unknown';
  const userId = c.get('userId');
  
  if (!userId) {
    console.error(`[${requestId}] ❌ requireWorkspace called without auth`);
    return c.json({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    }, 401);
  }
  
  try {
    // Get workspace ID from header
    const workspaceId = c.req.header('X-Workspace-Id');
    
    if (!workspaceId) {
      console.error(`[${requestId}] ❌ Missing X-Workspace-Id header`);
      return c.json({
        error: 'Bad Request',
        message: 'X-Workspace-Id header required',
        code: 'WORKSPACE_ID_REQUIRED'
      }, 400);
    }
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Check if user is member of workspace
    const { data: membership, error } = await supabase
      .from('workspace_memberships')
      .select(`
        id,
        role,
        status,
        workspace:workspaces (
          id,
          name,
          slug,
          plan_tier,
          status
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (error || !membership) {
      console.error(`[${requestId}] ❌ User ${userId} not member of workspace ${workspaceId}`);
      return c.json({
        error: 'Forbidden',
        message: 'You are not a member of this workspace',
        code: 'NOT_WORKSPACE_MEMBER'
      }, 403);
    }
    
    // Check workspace is active
    if (membership.workspace.status !== 'active') {
      console.error(`[${requestId}] ❌ Workspace ${workspaceId} is ${membership.workspace.status}`);
      return c.json({
        error: 'Forbidden',
        message: 'Workspace is not active',
        code: 'WORKSPACE_INACTIVE'
      }, 403);
    }
    
    // Attach workspace context
    c.set('workspace', {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      planTier: membership.workspace.plan_tier
    });
    c.set('workspaceId', membership.workspace.id);
    c.set('workspaceRole', membership.role);
    
    console.log(`[${requestId}] ✅ Workspace: ${membership.workspace.name} | Role: ${membership.role}`);
    
    await next();
    
  } catch (error: any) {
    console.error(`[${requestId}] ❌ Workspace middleware error:`, error.message);
    return c.json({
      error: 'Internal server error',
      message: 'Workspace verification failed',
      code: 'WORKSPACE_MIDDLEWARE_ERROR'
    }, 500);
  }
}

/**
 * Require specific workspace role (owner, admin, or member)
 */
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const requestId = c.get('requestId') || 'unknown';
    const userRole = c.get('workspaceRole');
    
    if (!userRole) {
      console.error(`[${requestId}] ❌ requireRole called without workspace context`);
      return c.json({
        error: 'Forbidden',
        message: 'Workspace context required',
        code: 'WORKSPACE_REQUIRED'
      }, 403);
    }
    
    if (!allowedRoles.includes(userRole)) {
      console.error(`[${requestId}] ❌ Role ${userRole} not in allowed roles: ${allowedRoles.join(', ')}`);
      return c.json({
        error: 'Forbidden',
        message: `Requires role: ${allowedRoles.join(' or ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      }, 403);
    }
    
    console.log(`[${requestId}] ✅ Role check passed: ${userRole}`);
    await next();
  };
}

/**
 * Check if workspace has access to a feature
 */
export function requireFeature(featureName: string) {
  return async (c: Context, next: Next) => {
    const requestId = c.get('requestId') || 'unknown';
    const workspaceId = c.get('workspaceId');
    
    if (!workspaceId) {
      console.error(`[${requestId}] ❌ requireFeature called without workspace context`);
      return c.json({
        error: 'Forbidden',
        message: 'Workspace context required',
        code: 'WORKSPACE_REQUIRED'
      }, 403);
    }
    
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // Check feature access
      const { data: features, error } = await supabase
        .from('workspace_features')
        .select(featureName)
        .eq('workspace_id', workspaceId)
        .single();
      
      if (error || !features || !features[featureName]) {
        console.error(`[${requestId}] ❌ Feature ${featureName} not enabled for workspace ${workspaceId}`);
        return c.json({
          error: 'Payment Required',
          message: `Feature '${featureName}' not available on your plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          upgradeUrl: '/pricing'
        }, 402);
      }
      
      console.log(`[${requestId}] ✅ Feature check passed: ${featureName}`);
      await next();
      
    } catch (error: any) {
      console.error(`[${requestId}] ❌ Feature check error:`, error.message);
      return c.json({
        error: 'Internal server error',
        message: 'Feature check failed',
        code: 'FEATURE_CHECK_ERROR'
      }, 500);
    }
  };
}

// ============================================
// PATH VALIDATION & SECURITY
// ============================================

/**
 * Sanitize file paths to prevent path traversal attacks
 * Blocks: ../, ..\, encoded variants, null bytes
 */
export function sanitizePath(path: string): string {
  if (!path) {
    throw new Error('Path cannot be empty');
  }
  
  // Decode URL encoding (prevent encoded path traversal)
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    throw new Error('Invalid path encoding');
  }
  
  // Check for path traversal patterns
  const dangerousPatterns = [
    '../',
    '..\\',
    '..',
    '%2e%2e',
    '%252e%252e',
    '..%2f',
    '..%5c',
    '%00', // null byte
    '\0'   // null character
  ];
  
  const lowerPath = decoded.toLowerCase();
  for (const pattern of dangerousPatterns) {
    if (lowerPath.includes(pattern)) {
      throw new Error(`Path contains dangerous pattern: ${pattern}`);
    }
  }
  
  // Only allow safe characters: alphanumeric, dash, underscore, slash, dot
  const sanitized = decoded.replace(/[^a-zA-Z0-9._/-]/g, '');
  
  // Remove leading/trailing slashes
  return sanitized.replace(/^\/+|\/+$/g, '');
}

/**
 * Validate that a file path belongs to a specific user
 * Prevents users from accessing other users' files
 */
export function validateUserPath(userId: string, filePath: string): boolean {
  const sanitized = sanitizePath(filePath);
  
  // Path must start with userId/
  if (!sanitized.startsWith(`${userId}/`)) {
    console.error(`❌ Path validation failed: ${sanitized} does not start with ${userId}/`);
    return false;
  }
  
  return true;
}

/**
 * Validate that a file path belongs to user's scenario
 * Format: userId/scenarioId/filename
 */
export function validateScenarioPath(
  userId: string, 
  scenarioId: string, 
  filePath: string
): boolean {
  const sanitized = sanitizePath(filePath);
  
  // Path must start with userId/scenarioId/
  const expectedPrefix = `${userId}/${scenarioId}/`;
  if (!sanitized.startsWith(expectedPrefix)) {
    console.error(`❌ Scenario path validation failed: ${sanitized} does not start with ${expectedPrefix}`);
    return false;
  }
  
  return true;
}

/**
 * Validate file type against whitelist
 */
export function validateFileType(contentType: string, allowedTypes: string[]): boolean {
  if (!contentType) {
    return false;
  }
  
  return allowedTypes.some(allowed => contentType.startsWith(allowed));
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxBytes: number): boolean {
  return size > 0 && size <= maxBytes;
}

// ============================================
// FILE SIZE CONSTANTS
// ============================================

export const FILE_SIZE_LIMITS = {
  AVATAR: 5 * 1024 * 1024,      // 5MB
  SCENARIO: 10 * 1024 * 1024,   // 10MB
  RECORDING: 100 * 1024 * 1024, // 100MB
  RESOURCE: 20 * 1024 * 1024,   // 20MB
  CONVERSATION: 50 * 1024 * 1024 // 50MB (for ConversationAnalysis feature)
};

export const ALLOWED_TYPES = {
  AVATAR: ['image/jpeg', 'image/png', 'image/webp'],
  SCENARIO: ['application/pdf', 'application/json', 'text/plain'],
  RECORDING: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'],
  RESOURCE: ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'],
  CONVERSATION: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4', 'video/mp4', 'video/quicktime']
};

// ============================================
// ERROR HANDLING HELPERS
// ============================================

/**
 * Format error response with request ID
 */
export function formatError(
  c: Context,
  error: string,
  message: string,
  code: string,
  status: number = 500
) {
  const requestId = c.get('requestId') || 'unknown';
  
  console.error(`[${requestId}] ❌ ${code}: ${message}`, error);
  
  return c.json({
    error,
    message,
    code,
    requestId
  }, status);
}

/**
 * Log successful operation
 */
export function logSuccess(c: Context, operation: string, details?: any) {
  const requestId = c.get('requestId') || 'unknown';
  const userId = c.get('userId') || 'anonymous';
  
  console.log(`[${requestId}] ✅ ${operation} | User: ${userId}`, details || '');
}

/**
 * Log error operation
 */
export function logError(c: Context, message: string, code?: string) {
  const requestId = c.get('requestId') || 'unknown';
  const userId = c.get('userId') || 'anonymous';
  
  console.error(`[${requestId}] ❌ ${code || 'ERROR'}: ${message} | User: ${userId}`);
}