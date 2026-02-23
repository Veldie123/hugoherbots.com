import { useEffect, useState } from "react";

interface SSOValidateProps {
  navigate: (page: string) => void;
  onSSOLogin?: (userId: string, user: any) => void;
}

export function SSOValidate({ navigate, onSSOLogin }: SSOValidateProps) {
  const [status, setStatus] = useState<"validating" | "success" | "error">("validating");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const validateToken = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");

        if (!token) {
          setStatus("error");
          setErrorMessage("Geen token gevonden");
          return;
        }

        console.log("[SSO] Validating token:", token.substring(0, 10) + "...");
        console.log("[SSO] Full URL:", window.location.href);

        const response = await fetch(`/api/sso/validate?token=${token}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          setStatus("error");
          setErrorMessage(data.error || "Token is ongeldig of verlopen");
          return;
        }

        console.log("[SSO] Token valid for user:", data.userId);

        localStorage.setItem('sso_user_id', data.userId);
        localStorage.setItem('sso_user', JSON.stringify(data.user || {}));
        localStorage.setItem('sso_authenticated', 'true');
        
        if (onSSOLogin && data.user) {
          onSSOLogin(data.userId, data.user);
        }

        setStatus("success");

        setTimeout(() => {
          const targetPath = data.targetPath || "/talk-to-hugo";
          const pageName = targetPath.replace("/", "") || "talk-to-hugo";
          navigate(pageName);
        }, 1000);

      } catch (error: any) {
        console.error("[SSO] Validation error:", error);
        setStatus("error");
        setErrorMessage(error.message || "Er is een fout opgetreden");
      }
    };

    validateToken();
  }, [navigate, onSSOLogin]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {status === "validating" && (
          <>
            <div className="w-16 h-16 border-4 border-hh-ocean-blue border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h1 className="text-xl font-semibold text-hh-ink mb-2">Bezig met inloggen...</h1>
            <p className="text-hh-muted">Even geduld, je wordt doorgestuurd.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-hh-ink mb-2">Ingelogd!</h1>
            <p className="text-hh-muted">Je wordt doorgestuurd naar Hugo...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-hh-ink mb-2">Inloggen mislukt</h1>
            <p className="text-hh-muted mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate("login")}
              className="px-6 py-3 bg-hh-ink text-white rounded-lg hover:bg-hh-ink/90 transition-colors"
            >
              Naar login pagina
            </button>
          </>
        )}
      </div>
    </div>
  );
}
