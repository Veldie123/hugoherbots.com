import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { auth } from "../../utils/supabase/client";
import { Logo } from "./Logo";

interface AuthCallbackProps {
  navigate?: (page: string) => void;
}

/**
 * OAuth Callback Handler
 * 
 * Handles OAuth redirects from Google/Microsoft
 * - Checks for auth session
 * - Navigates to onboarding (new users) or dashboard (existing users)
 * - Shows loading state during processing
 */
export function AuthCallback({ navigate }: AuthCallbackProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log("🔐 Processing OAuth callback...");

      // Get session from URL hash - DEFENSIVE CODE
      let sessionResult;
      try {
        sessionResult = await auth.getSession();
      } catch (err) {
        console.error("❌ auth.getSession() threw error:", err);
        setError("Fout bij ophalen sessie");
        setStatus("error");
        return;
      }

      if (!sessionResult) {
        console.error("❌ auth.getSession() returned undefined");
        setError("Geen sessie gevonden. Probeer opnieuw in te loggen.");
        setStatus("error");
        return;
      }

      const session = sessionResult.session;
      const sessionError = sessionResult.error;

      if (sessionError) {
        console.error("❌ Session error:", sessionError);
        setError(sessionError.message);
        setStatus("error");
        return;
      }

      if (!session) {
        console.error("❌ No session found");
        setError("Geen sessie gevonden. Probeer opnieuw in te loggen.");
        setStatus("error");
        return;
      }

      console.log("✅ OAuth login successful:", session.user.email);
      setStatus("success");

      // Check if this is a new user (created_at is recent)
      const createdAt = new Date(session.user.created_at || "");
      const now = new Date();
      const isNewUser = (now.getTime() - createdAt.getTime()) < 60000; // Less than 1 minute old

      // Navigate to onboarding for new users, dashboard for existing
      setTimeout(() => {
        if (isNewUser) {
          console.log("🆕 New user - redirecting to onboarding");
          navigate?.("onboarding");
        } else {
          console.log("👤 Existing user - redirecting to dashboard");
          navigate?.("dashboard");
        }
      }, 1000);

    } catch (err: any) {
      console.error("❌ Callback error:", err);
      setError(err.message || "Er ging iets mis");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-hh-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo variant="vertical" className="text-hh-ink" />
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-hh-primary mx-auto" />
            <div>
              <h2 className="text-[24px] leading-[32px] text-hh-text mb-2">
                Bezig met inloggen...
              </h2>
              <p className="text-[16px] leading-[24px] text-hh-muted">
                Een moment geduld terwijl we je account verifiëren
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-hh-success/10 flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-hh-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[24px] leading-[32px] text-hh-text mb-2">
                Welkom bij Hugo!
              </h2>
              <p className="text-[16px] leading-[24px] text-hh-muted">
                Je wordt doorgestuurd...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-hh-error/10 flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-hh-error"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[24px] leading-[32px] text-hh-text mb-2">
                Er ging iets mis
              </h2>
              <p className="text-[16px] leading-[24px] text-hh-muted mb-4">
                {error}
              </p>
              <button
                onClick={() => navigate?.("login")}
                className="text-[16px] leading-[24px] text-hh-primary hover:underline"
              >
                Terug naar inloggen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}