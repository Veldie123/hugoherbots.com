import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Separator } from "../ui/separator";
import { Logo } from "./Logo";
import { StickyHeader } from "./StickyHeader";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { auth } from "../../utils/supabase/client";
const hugoImage = "/images/Hugo-Herbots-WEB-0444.JPG";

type Page = "landing" | "pricing" | "about" | "login" | "signup" | "onboarding" | "dashboard" | "roleplay" | "library" | "builder" | "sessions" | "analytics" | "settings" | "admin-dashboard";

interface LoginProps {
  onSignupClick?: () => void;
  onLoginSuccess?: () => void;
  navigate?: (page: Page) => void;
}

export function Login({ onSignupClick, onLoginSuccess, navigate }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Sign in with Supabase
      const { data, error: signInError } = await auth.signIn(email, password);
      
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Check if email is admin (@hugoherbots.com)
      const isAdmin = email.toLowerCase().endsWith("@hugoherbots.com");
      
      // Navigate based on user role
      if (navigate) {
        if (isAdmin) {
          navigate("admin-dashboard" as Page);
        } else {
          navigate("dashboard");
        }
      }
      
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Er ging iets mis bij het inloggen");
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'azure') => {
    setLoading(true);
    setError(null);

    try {
      const { error: oauthError } = await auth.signInWithOAuth(provider);
      
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
      // User will be redirected to OAuth provider
    } catch (err: any) {
      setError(err.message || "Er ging iets mis bij het inloggen");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hh-bg" data-theme="light">
      {/* Navigation Header */}
      {navigate && <StickyHeader currentPage="login" navigate={navigate} />}
      
      <div className="min-h-screen flex pt-16 sm:pt-20">
        {/* Left side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="mb-3 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
                Welkom terug
              </h1>
              <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
                Log in om verder te gaan met je training
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Error message */}
              {error && (
                <div className="p-4 bg-hh-error/10 border border-hh-error rounded-lg">
                  <p className="text-[14px] leading-[20px] text-hh-error">{error}</p>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hh-muted" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="jan@techcorp.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-hh-ui-50"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Wachtwoord</Label>
                  <button
                    type="button"
                    className="text-[14px] leading-[20px] text-hh-primary hover:underline"
                  >
                    Vergeten?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hh-muted" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-hh-ui-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-hh-muted hover:text-hh-text"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button type="submit" variant="ink" className="w-full gap-2" size="lg" disabled={loading}>
                {loading ? "Bezig met inloggen..." : "Inloggen"} {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-6 sm:my-8 flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-[12px] leading-[18px] sm:text-[14px] sm:leading-[20px] text-hh-muted">of</span>
              <Separator className="flex-1" />
            </div>

            {/* Social Login */}
            <div className="space-y-3">
              <Button variant="outline" className="w-full gap-2" size="lg" onClick={() => handleSocialLogin('google')}>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Doorgaan met Google
              </Button>
              <Button variant="outline" className="w-full gap-2" size="lg" onClick={() => handleSocialLogin('azure')}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V8h11.4v16zM21.6 8H24v16h-2.4V8zM0 3.6C0 1.612 1.612 0 3.6 0h16.8C22.388 0 24 1.612 24 3.6v.8H0v-.8z" />
                </svg>
                Doorgaan met Microsoft
              </Button>
            </div>

            {/* Signup Link */}
            <div className="mt-6 sm:mt-8 text-center">
              <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
                Nog geen account?{" "}
                <button
                  type="button"
                  onClick={onSignupClick}
                  className="text-hh-primary hover:underline"
                >
                  Start gratis met Hugo
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Hugo Photo Only */}
        <div className="hidden lg:flex lg:w-1/2 bg-hh-ink text-white items-center justify-center relative overflow-hidden">
          {/* Hugo Photo - Full bleed with lighter overlay */}
          <div className="absolute inset-0">
            <img
              src={hugoImage}
              alt="Hugo Herbots"
              className="w-full h-full object-cover object-top opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-hh-ink/50 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}