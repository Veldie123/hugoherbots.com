import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn, ChildProcess } from "child_process";
import path from "path";

let agentProcess: ChildProcess | null = null;

function startLiveKitAgent() {
  if (agentProcess) {
    console.log('[LiveKit Agent Launcher] Agent already running');
    return;
  }
  
  const agentPath = path.join(process.cwd(), 'server', 'livekit-agent.ts');
  console.log('[LiveKit Agent Launcher] Starting agent:', agentPath);
  
  agentProcess = spawn('npx', ['tsx', agentPath, 'dev'], {
    stdio: 'inherit',
    env: { ...process.env },
    detached: false,
  });
  
  agentProcess.on('error', (err) => {
    console.error('[LiveKit Agent Launcher] Failed to start:', err);
    agentProcess = null;
  });
  
  agentProcess.on('exit', (code, signal) => {
    console.log(`[LiveKit Agent Launcher] Agent exited (code: ${code}, signal: ${signal})`);
    agentProcess = null;
    // Auto-restart after 5 seconds
    setTimeout(() => {
      console.log('[LiveKit Agent Launcher] Restarting agent...');
      startLiveKitAgent();
    }, 5000);
  });
}

function stopLiveKitAgent() {
  if (agentProcess) {
    console.log('[LiveKit Agent Launcher] Stopping agent');
    agentProcess.kill('SIGTERM');
    agentProcess = null;
  }
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
  stopLiveKitAgent();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopLiveKitAgent();
  process.exit(0);
});

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    // Start LiveKit agent after server is ready
    startLiveKitAgent();
  });
})();
