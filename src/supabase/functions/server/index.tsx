import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as storage from "./storage.tsx";
import {
  requestIdMiddleware,
  requireAuth,
  requireWorkspace,
  requireRole,
  requireFeature,
  sanitizePath,
  validateUserPath,
  validateScenarioPath,
  validateFileType,
  validateFileSize,
  FILE_SIZE_LIMITS,
  ALLOWED_TYPES,
  formatError,
  logSuccess
} from "./middleware.tsx";
import { liveCoaching } from "./liveCoaching.tsx";
import { videosApp } from "./videos.tsx";

const app = new Hono();

// ============================================
// GLOBAL MIDDLEWARE
// ============================================

// 1. Request ID (must be first - enables tracing)
app.use('*', requestIdMiddleware);

// 2. Logger
app.use('*', logger(console.log));

// 3. CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize storage buckets on startup
console.log("🚀 Server starting... (v1.0.3 - Fixed imports)");
await storage.initializeBuckets();
console.log("✅ Server initialized");

// Health check endpoint
app.get("/make-server-b9a572ea/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================
// AUTH ROUTES
// ============================================

/**
 * Signup with workspace auto-provisioning
 * POST /make-server-b9a572ea/auth/signup
 * Body: { email, password, firstName?, lastName? }
 */
app.post("/make-server-b9a572ea/auth/signup", async (c) => {
  const requestId = c.get('requestId') || 'unknown';
  
  try {
    const body = await c.req.json();
    const { email, password, firstName, lastName } = body;
    
    if (!email || !password) {
      return formatError(c, 'Missing fields', 'email and password required', 'MISSING_FIELDS', 400);
    }
    
    console.log(`[${requestId}] 📝 Creating user: ${email}`);
    
    // Use SERVICE ROLE for auto-confirmed signups (no email verification needed)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log(`[${requestId}] 🔑 Creating user with admin API (auto-confirmed)...`);
    
    // Create user via admin API with email auto-confirmed
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email (no verification needed)
      user_metadata: {
        first_name: firstName || '',
        last_name: lastName || ''
      }
    });
    
    if (signUpError) {
      console.error(`[${requestId}] ❌ User creation failed:`, {
        message: signUpError.message,
        status: signUpError.status,
        name: signUpError.name
      });
      
      // Check for specific error types
      if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already been registered')) {
        return formatError(c, signUpError.message, 'Dit email adres is al geregistreerd. Probeer in te loggen.', 'EMAIL_EXISTS', 400);
      }
      
      if (signUpError.message?.includes('Password') || signUpError.message?.includes('password')) {
        return formatError(c, signUpError.message, 'Wachtwoord moet minimaal 6 karakters zijn', 'WEAK_PASSWORD', 400);
      }
      
      if (signUpError.message?.includes('invalid') || signUpError.message?.includes('Invalid')) {
        return formatError(c, signUpError.message, 'Email adres is ongeldig. Gebruik een geldig email adres (niet .test TLD).', 'INVALID_EMAIL', 400);
      }
      
      return formatError(c, signUpError.message, 'Failed to create user', 'USER_CREATION_FAILED', 500);
    }
    
    if (!signUpData.user) {
      return formatError(c, 'No user data returned', 'Failed to create user', 'USER_CREATION_FAILED', 500);
    }
    
    const userId = signUpData.user.id;
    console.log(`[${requestId}] ✅ User created: ${userId}`);
    
    // Now login to get a session (admin.createUser doesn't return session)
    console.log(`[${requestId}] 🔐 Logging in to get session...`);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (loginError || !loginData.session) {
      console.error(`[${requestId}] ⚠️ Login failed after signup:`, loginError?.message);
      // User is created but session failed - they can login manually
      return c.json({ 
        success: true,
        user: {
          id: userId,
          email: signUpData.user.email
        },
        session: null,
        message: 'Account created. Please login to continue.'
      }, 201);
    }
    
    console.log(`[${requestId}] ✅ Session created`);
    
    // Store session for return
    const session = loginData.session;
    
    // Generate workspace slug
    const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    const workspaceSlug = `${emailPrefix}-${userId.substring(0, 8)}`;
    const workspaceName = firstName ? `${firstName}'s Workspace` : 'Personal Workspace';
    
    try {
      console.log(`[${requestId}] 🏢 Creating workspace: ${workspaceName}`);
      
      // Create workspace
      const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from('workspaces')
        .insert({
          name: workspaceName,
          slug: workspaceSlug,
          owner_id: userId,
          plan_tier: 'starter',
          status: 'active'
        })
        .select()
        .single();
      
      if (workspaceError) {
        console.error(`[${requestId}] ⚠️ Workspace creation failed:`, workspaceError.message);
        // Don't fail signup if workspace creation fails - can be created later
      } else {
        console.log(`[${requestId}] ✅ Workspace created: ${workspace.id}`);
        
        // Create membership (owner)
        const { error: membershipError } = await supabaseAdmin
          .from('workspace_memberships')
          .insert({
            workspace_id: workspace.id,
            user_id: userId,
            role: 'owner',
            status: 'active'
          });
        
        if (membershipError) {
          console.error(`[${requestId}] ⚠️ Membership creation failed:`, membershipError.message);
        }
        
        // Create default features
        const { error: featuresError } = await supabaseAdmin
          .from('workspace_features')
          .insert({
            workspace_id: workspace.id,
            video_avatar_enabled: false,
            team_sessions_enabled: false,
            scenario_builder_enabled: true,
            live_coaching_enabled: false,
            analytics_enabled: false,
            max_monthly_minutes: 100,
            max_team_members: 1,
            max_scenarios: 10
          });
        
        if (featuresError) {
          console.error(`[${requestId}] ⚠️ Features creation failed:`, featuresError.message);
        }
        
        logSuccess(c, 'User and workspace created', { userId, workspaceId: workspace.id });
      }
    } catch (workspaceErr: any) {
      console.error(`[${requestId}] ⚠️ Workspace setup error:`, workspaceErr.message);
      // Don't fail signup - user is created, workspace can be created later
    }
    
    return c.json({ 
      success: true,
      user: {
        id: userId,
        email: signUpData.user.email
      },
      session
    }, 201);
    
  } catch (error: any) {
    console.error(`[${requestId}] ❌ SIGNUP_ERROR:`, error.message);
    return formatError(c, error.message, 'Signup error', 'SIGNUP_ERROR', 500);
  }
});

/**
 * Login
 * POST /make-server-b9a572ea/auth/login
 * Body: { email, password }
 */
app.post("/make-server-b9a572ea/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return formatError(c, 'Missing fields', 'email and password required', 'MISSING_FIELDS', 400);
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error || !data.session) {
      return formatError(c, error?.message || 'Login failed', 'Invalid credentials', 'LOGIN_FAILED', 401);
    }
    
    logSuccess(c, 'User logged in', { userId: data.user.id });
    
    return c.json({
      success: true,
      session: data.session,
      user: data.user
    });
    
  } catch (error: any) {
    return formatError(c, error.message, 'Login error', 'LOGIN_ERROR', 500);
  }
});

// ============================================
// WORKSPACE ROUTES
// ============================================

/**
 * Get user's workspaces
 * GET /make-server-b9a572ea/workspaces
 */
app.get("/make-server-b9a572ea/workspaces", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Get all workspaces user is member of
    const { data: memberships, error } = await supabase
      .from('workspace_memberships')
      .select(`
        role,
        workspace:workspaces (
          id,
          name,
          slug,
          plan_tier,
          status,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active');
    
    if (error) {
      return formatError(c, error.message, 'Failed to fetch workspaces', 'FETCH_WORKSPACES_ERROR', 500);
    }
    
    const workspaces = memberships?.map(m => ({
      ...m.workspace,
      role: m.role
    })) || [];
    
    logSuccess(c, 'Workspaces fetched', { count: workspaces.length });
    
    return c.json({ workspaces });
    
  } catch (error: any) {
    return formatError(c, error.message, 'Workspace fetch error', 'WORKSPACE_ERROR', 500);
  }
});

/**
 * Get workspace details
 * GET /make-server-b9a572ea/workspaces/:id
 */
app.get("/make-server-b9a572ea/workspaces/:id", requireAuth, requireWorkspace, async (c) => {
  try {
    const workspace = c.get('workspace');
    const workspaceRole = c.get('workspaceRole');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Get member count
    const { count } = await supabase
      .from('workspace_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('status', 'active');
    
    // Get features
    const { data: features } = await supabase
      .from('workspace_features')
      .select('*')
      .eq('workspace_id', workspace.id)
      .single();
    
    logSuccess(c, 'Workspace details fetched');
    
    return c.json({
      ...workspace,
      role: workspaceRole,
      memberCount: count || 0,
      features: features || {}
    });
    
  } catch (error: any) {
    return formatError(c, error.message, 'Workspace details error', 'WORKSPACE_DETAILS_ERROR', 500);
  }
});

/**
 * Get workspace members
 * GET /make-server-b9a572ea/workspaces/:id/members
 */
app.get("/make-server-b9a572ea/workspaces/:id/members", requireAuth, requireWorkspace, async (c) => {
  try {
    const workspaceId = c.get('workspaceId');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: members, error } = await supabase
      .from('workspace_memberships')
      .select(`
        id,
        role,
        status,
        created_at,
        user:user_id (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');
    
    if (error) {
      return formatError(c, error.message, 'Failed to fetch members', 'FETCH_MEMBERS_ERROR', 500);
    }
    
    logSuccess(c, 'Members fetched', { count: members?.length || 0 });
    
    return c.json({ members: members || [] });
    
  } catch (error: any) {
    return formatError(c, error.message, 'Members fetch error', 'MEMBERS_ERROR', 500);
  }
});

/**
 * Create workspace (for team plan upgrades)
 * POST /make-server-b9a572ea/workspaces
 */
app.post("/make-server-b9a572ea/workspaces", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { name, slug } = body;
    
    if (!name || !slug) {
      return formatError(c, 'Missing fields', 'name and slug required', 'MISSING_FIELDS', 400);
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Create workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name,
        slug,
        owner_id: userId,
        plan_tier: 'starter'
      })
      .select()
      .single();
    
    if (workspaceError) {
      return formatError(c, workspaceError.message, 'Failed to create workspace', 'CREATE_WORKSPACE_ERROR', 500);
    }
    
    // Create membership (owner)
    await supabase
      .from('workspace_memberships')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
        status: 'active'
      });
    
    // Create default features
    await supabase
      .from('workspace_features')
      .insert({
        workspace_id: workspace.id,
        scenario_builder_enabled: true,
        max_monthly_minutes: 100,
        max_team_members: 1,
        max_scenarios: 10
      });
    
    logSuccess(c, 'Workspace created', { workspaceId: workspace.id });
    
    return c.json({ workspace }, 201);
    
  } catch (error: any) {
    return formatError(c, error.message, 'Workspace creation error', 'CREATE_ERROR', 500);
  }
});

// ============================================
// STORAGE ROUTES (Protected with middleware)
// ============================================

/**
 * Upload user avatar
 * POST /make-server-b9a572ea/storage/avatar
 */
app.post("/make-server-b9a572ea/storage/avatar", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const requestId = c.get('requestId');

    // Get file from request body
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return formatError(c, 'No file provided', 'File is required', 'FILE_REQUIRED', 400);
    }

    // Validate file type
    if (!validateFileType(file.type, ALLOWED_TYPES.AVATAR)) {
      return formatError(
        c, 
        `Invalid file type: ${file.type}`, 
        'Only JPEG, PNG, and WebP images allowed', 
        'INVALID_FILE_TYPE', 
        400
      );
    }

    // Validate file size (max 5MB)
    if (!validateFileSize(file.size, FILE_SIZE_LIMITS.AVATAR)) {
      return formatError(
        c, 
        `File too large: ${file.size} bytes`, 
        'File too large (max 5MB)', 
        'FILE_TOO_LARGE', 
        400
      );
    }

    // Upload avatar
    const fileBuffer = await file.arrayBuffer();
    const result = await storage.uploadUserAvatar(
      userId,
      new Uint8Array(fileBuffer),
      file.type
    );

    if ("error" in result) {
      return formatError(c, result.error, 'Failed to upload avatar', 'UPLOAD_FAILED', 500);
    }

    logSuccess(c, 'Avatar uploaded', { size: file.size, type: file.type });

    return c.json({ 
      success: true, 
      avatarUrl: result.signedUrl 
    });

  } catch (error: any) {
    return formatError(c, error.message, 'Avatar upload error', 'UPLOAD_ERROR', 500);
  }
});

/**
 * Get user avatar URL
 * GET /make-server-b9a572ea/storage/avatar
 */
app.get("/make-server-b9a572ea/storage/avatar", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');

    const avatarUrl = await storage.getUserAvatarUrl(userId);
    
    logSuccess(c, 'Avatar retrieved');

    return c.json({ avatarUrl });

  } catch (error: any) {
    return formatError(c, error.message, 'Failed to get avatar', 'GET_AVATAR_ERROR', 500);
  }
});

/**
 * Upload conversation file (audio/video for analysis)
 * POST /make-server-b9a572ea/storage/conversation
 */
app.post("/make-server-b9a572ea/storage/conversation", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const requestId = c.get('requestId');

    // Get file from request body
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return formatError(c, 'No file provided', 'File is required', 'FILE_REQUIRED', 400);
    }

    console.log(`[${requestId}] 📤 Conversation upload: ${file.name} (${file.size} bytes, ${file.type})`);

    // Validate file size (max 50MB)
    if (!validateFileSize(file.size, FILE_SIZE_LIMITS.CONVERSATION)) {
      return formatError(
        c, 
        `File too large: ${file.size} bytes`, 
        'File too large (max 50MB)', 
        'FILE_TOO_LARGE', 
        400
      );
    }

    // Normalize MIME type (M4A -> audio/mp4)
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    let contentType = file.type;
    
    if (fileExt === 'm4a' || file.type === 'audio/x-m4a' || file.type === 'audio/m4a') {
      contentType = 'audio/mp4';
      console.log(`[${requestId}] 🔄 Normalized M4A MIME type: ${file.type} -> ${contentType}`);
    }
    
    if (fileExt === 'mp3' && (!file.type || file.type === 'audio/mp3')) {
      contentType = 'audio/mpeg';
    }
    
    if (fileExt === 'mov' && (!file.type || file.type !== 'video/quicktime')) {
      contentType = 'video/quicktime';
    }
    
    if (fileExt === 'wav' && (!file.type || file.type === 'audio/x-wav')) {
      contentType = 'audio/wav';
    }

    // Sanitize filename
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}-${sanitizedFileName}`;
    const filePath = `${userId}/${fileName}`;

    console.log(`[${requestId}] 📦 Uploading: ${filePath} (${contentType})`);

    // Upload file
    const fileBuffer = await file.arrayBuffer();
    const result = await storage.uploadFile(
      storage.BUCKETS.CONVERSATION_UPLOADS,
      filePath,
      new Uint8Array(fileBuffer),
      contentType,
      userId
    );

    if ("error" in result) {
      console.error(`[${requestId}] ❌ Upload failed:`, result.error);
      return formatError(c, result.error, 'Failed to upload conversation file', 'UPLOAD_FAILED', 500);
    }

    console.log(`[${requestId}] ✅ Upload successful: ${result.path}`);
    logSuccess(c, 'Conversation uploaded', { size: file.size, type: contentType });

    return c.json({ 
      success: true, 
      path: result.path,
      signedUrl: result.signedUrl
    });

  } catch (error: any) {
    console.error(`[${c.get('requestId')}] ❌ Conversation upload error:`, error);
    return formatError(c, error.message, 'Conversation upload error', 'UPLOAD_ERROR', 500);
  }
});

/**
 * Upload scenario asset
 * POST /make-server-b9a572ea/storage/scenario/:scenarioId
 */
app.post("/make-server-b9a572ea/storage/scenario/:scenarioId", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const scenarioId = c.req.param("scenarioId");
    
    // Get file from request body
    const formData = await c.req.formData();
    const file = formData.get("file");
    const fileName = formData.get("fileName") as string;

    if (!file || !(file instanceof File)) {
      return formatError(c, 'No file provided', 'File is required', 'FILE_REQUIRED', 400);
    }

    if (!fileName) {
      return formatError(c, 'No fileName provided', 'fileName is required', 'FILENAME_REQUIRED', 400);
    }

    // Sanitize fileName to prevent path traversal
    let sanitizedFileName: string;
    try {
      sanitizedFileName = sanitizePath(fileName);
    } catch (error: any) {
      return formatError(c, error.message, 'Invalid file name', 'INVALID_FILENAME', 400);
    }

    // Validate file size (max 10MB)
    if (!validateFileSize(file.size, FILE_SIZE_LIMITS.SCENARIO)) {
      return formatError(
        c, 
        `File too large: ${file.size} bytes`, 
        'File too large (max 10MB)', 
        'FILE_TOO_LARGE', 
        400
      );
    }

    // Build and validate file path
    const filePath = `${userId}/${scenarioId}/${sanitizedFileName}`;
    
    if (!validateScenarioPath(userId, scenarioId, filePath)) {
      return formatError(
        c, 
        `Invalid path: ${filePath}`, 
        'Path validation failed', 
        'INVALID_PATH', 
        403
      );
    }

    // Upload to scenarios bucket
    const fileBuffer = await file.arrayBuffer();
    
    const result = await storage.uploadFile(
      storage.BUCKETS.SCENARIOS,
      filePath,
      new Uint8Array(fileBuffer),
      file.type,
      userId
    );

    if ("error" in result) {
      return formatError(c, result.error, 'Failed to upload scenario asset', 'UPLOAD_FAILED', 500);
    }

    logSuccess(c, 'Scenario asset uploaded', { 
      scenarioId, 
      fileName: sanitizedFileName, 
      size: file.size 
    });

    return c.json({ 
      success: true, 
      path: result.path,
      url: result.signedUrl 
    });

  } catch (error: any) {
    return formatError(c, error.message, 'Scenario upload error', 'UPLOAD_ERROR', 500);
  }
});

/**
 * Get signed URL for a file
 * POST /make-server-b9a572ea/storage/url
 * Body: { bucket: string, path: string, expiresIn?: number }
 */
app.post("/make-server-b9a572ea/storage/url", requireAuth, async (c) => {
  try {
    const userId = c.get('userId');

    const body = await c.req.json();
    const { bucket, path, expiresIn = 3600 } = body;

    if (!bucket || !path) {
      return formatError(c, 'Missing parameters', 'bucket and path required', 'PARAMS_REQUIRED', 400);
    }

    // Sanitize and validate path
    let sanitizedPath: string;
    try {
      sanitizedPath = sanitizePath(path);
    } catch (error: any) {
      return formatError(c, error.message, 'Invalid path', 'INVALID_PATH', 400);
    }

    // Validate user can access this path
    if (!validateUserPath(userId, sanitizedPath)) {
      return formatError(
        c, 
        `Access denied to path: ${sanitizedPath}`, 
        'You can only access your own files', 
        'ACCESS_DENIED', 
        403
      );
    }

    const result = await storage.getSignedUrl(bucket, sanitizedPath, expiresIn);

    if ("error" in result) {
      return formatError(c, result.error, 'Failed to generate signed URL', 'SIGNED_URL_FAILED', 500);
    }

    logSuccess(c, 'Signed URL generated', { bucket, path: sanitizedPath });

    return c.json({ url: result.signedUrl });

  } catch (error: any) {
    return formatError(c, error.message, 'Get signed URL error', 'SIGNED_URL_ERROR', 500);
  }
});

// ============================================
// LIVE COACHING API ROUTES
// ============================================
app.route('/make-server-b9a572ea/api/live', liveCoaching);

// ============================================
// VIDEO PLATFORM API ROUTES
// ============================================
app.route('/make-server-b9a572ea/api/videos', videosApp);

// ============================================
// ERROR HANDLER
// ============================================
app.onError((err, c) => {
  const requestId = c.get('requestId') || 'unknown';
  console.error(`[${requestId}] ❌ Unhandled error:`, err);
  
  return c.json({
    error: 'Internal server error',
    message: err.message,
    code: 'INTERNAL_ERROR',
    requestId
  }, 500);
});

Deno.serve(app.fetch);