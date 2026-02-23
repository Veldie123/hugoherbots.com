import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Separator } from "../ui/separator";
import { Checkbox } from "../ui/checkbox";
import { Logo } from "./Logo";
import { StickyHeader } from "./StickyHeader";
import { Mail, Lock, User, Building, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { auth } from "../../utils/supabase/client";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
const hugoImage = "/images/Hugo-Herbots-WEB-0444.JPG";

type Page = "landing" | "pricing" | "about" | "login" | "signup" | "onboarding" | "dashboard" | "roleplay" | "library" | "builder" | "sessions" | "analytics" | "settings";

interface SignupProps {
  onLoginClick?: () => void;
  onSignupSuccess?: () => void;
  navigate?: (page: Page) => void;
}

export function Signup({ onLoginClick, onSignupSuccess, navigate }: SignupProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    console.log('🚀 Starting signup process...');

    try {
      // 1. Call backend signup route
      const signupResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            email,
            password,
            firstName,
            lastName
          })
        }
      );

      console.log(`📡 Signup response status: ${signupResponse.status}`);
      const signupData = await signupResponse.json();
      console.log('📡 Signup response data:', signupData);

      if (!signupResponse.ok) {
        throw new Error(signupData.message || 'Signup failed');
      }

      console.log('✅ Signup success:', signupData);

      // 2. Use session from signup response (no separate login needed!)
      if (!signupData.session) {
        throw new Error('No session returned from signup');
      }

      console.log('✅ Session received from signup');

      // 3. Fetch workspaces
      console.log('📁 Fetching workspaces...');
      const workspacesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/workspaces`,
        {
          headers: {
            'Authorization': `Bearer ${signupData.session.access_token}`
          }
        }
      );

      if (!workspacesResponse.ok) {
        throw new Error('Failed to fetch workspaces');
      }

      const workspacesData = await workspacesResponse.json();
      console.log('✅ Workspaces fetched:', workspacesData.workspaces);

      // 4. Store workspace in localStorage
      if (workspacesData.workspaces && workspacesData.workspaces.length > 0) {
        localStorage.setItem('hh_workspace', JSON.stringify(workspacesData.workspaces[0]));
        console.log('📦 Workspace stored:', workspacesData.workspaces[0]);
      }

      // 5. Navigate based on user type (admin or regular)
      const isAdmin = email.endsWith('@hugoherbots.com');
      if (isAdmin) {
        console.log('🎉 Signup complete! Admin user - navigating to admin-dashboard...');
        navigate('admin-dashboard');
      } else {
        console.log('🎉 Signup complete! Navigating to onboarding...');
        navigate('onboarding');
      }

    } catch (err: any) {
      console.error('❌ Signup error:', err);
      setError(err.message || 'Er ging iets mis tijdens het aanmelden');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSignup = async (provider: 'google' | 'azure') => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: oauthError } = await auth.signInWithOAuth(provider);

      if (oauthError) {
        setError(oauthError.message);
        setIsLoading(false);
      }
      // User will be redirected to OAuth provider
    } catch (err: any) {
      setError(err.message || "Er ging iets mis bij het aanmelden");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hh-bg">
      {/* Navigation Header */}
      {navigate && <StickyHeader currentPage="signup" navigate={navigate} />}
      
      <div className="min-h-screen flex pt-16 sm:pt-20">
        {/* Left side - Signup Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="mb-3 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
                Start gratis met Hugo
              </h1>
              <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
                Maak je account in 30 seconden
              </p>
            </div>

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Error message */}
              {error && (
                <div className="p-4 bg-hh-error/10 border border-hh-error rounded-lg">
                  <p className="text-[14px] leading-[20px] text-hh-error">{error}</p>
                </div>
              )}

              {/* Name fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Voornaam</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hh-muted" />
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Jan"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10 bg-hh-ui-50"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Achternaam</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="de Vries"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-hh-ui-50"
                    required
                  />
                </div>
              </div>

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

              {/* Company (optional) */}
              <div className="space-y-2">
                <Label htmlFor="company">Bedrijf (optioneel)</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hh-muted" />
                  <Input
                    id="company"
                    type="text"
                    placeholder="TechCorp"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="pl-10 bg-hh-ui-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
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

              {/* Terms */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                  className="mt-0.5"
                  required
                />
                <Label htmlFor="terms" className="text-[14px] leading-[20px] text-hh-muted cursor-pointer">
                  Ik ga akkoord met de{" "}
                  <a href="#" className="text-hh-primary hover:underline">
                    voorwaarden
                  </a>{" "}
                  en{" "}
                  <a href="#" className="text-hh-primary hover:underline">
                    privacy policy
                  </a>
                </Label>
              </div>

              {/* Submit */}
              <Button type="submit" variant="ink" className="w-full gap-2" size="lg" disabled={isLoading}>
                {isLoading ? "Account aanmaken..." : "Start gratis met Hugo"} {!isLoading && <ArrowRight className="w-4 h-4" />}
              </Button>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 text-[12px] leading-[16px] text-hh-muted">
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-hh-success" />
                  14 dagen gratis
                </div>
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-hh-success" />
                  Geen creditcard
                </div>
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-hh-success" />
                  Altijd opzegbaar
                </div>
              </div>
            </form>

            {/* Divider */}
            <div className="my-6 sm:my-8 flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-[12px] leading-[18px] sm:text-[14px] sm:leading-[20px] text-hh-muted">of</span>
              <Separator className="flex-1" />
            </div>

            {/* Social Signup */}
            <div className="space-y-3">
              <Button variant="outline" className="w-full gap-2" size="lg" onClick={() => handleSocialSignup('google')}>
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
              <Button variant="outline" className="w-full gap-2" size="lg" onClick={() => handleSocialSignup('azure')}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V8h11.4v16zM21.6 8H24v16h-2.4V8zM0 3.6C0 1.612 1.612 0 3.6 0h16.8C22.388 0 24 1.612 24 3.6v.8H0v-.8z" />
                </svg>
                Doorgaan met Microsoft
              </Button>
            </div>

            {/* Login Link */}
            <div className="mt-6 sm:mt-8 text-center">
              <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
                Al een account?{" "}
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="text-hh-primary hover:underline"
                >
                  Log in
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Hugo Photo */}
        <div className="hidden lg:flex lg:w-1/2 bg-hh-ink text-white items-center justify-center relative overflow-hidden">
          {/* Hugo Photo - Full bleed with darker overlay for better text contrast */}
          <div className="absolute inset-0">
            <img
              src={hugoImage}
              alt="Hugo Herbots"
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-hh-ink/80 via-hh-ink/60 to-hh-ink/80" />
          </div>

          {/* Content overlay - Simplified */}
          <div className="relative z-10 max-w-lg px-12 text-center">
            <h2 className="text-[40px] leading-[48px] mb-4">
              40 jaar kennis.<br/>Nu jouw coach.
            </h2>
            
            {/* Stats Grid - Prominent */}
            <div className="grid grid-cols-3 gap-8 mt-12 mb-12">
              <div>
                <p className="text-[36px] leading-[44px] mb-1">40+</p>
                <p className="text-[13px] text-hh-ui-300">Jaar training</p>
              </div>
              <div>
                <p className="text-[36px] leading-[44px] mb-1">20K+</p>
                <p className="text-[13px] text-hh-ui-300">Getraind</p>
              </div>
              <div>
                <p className="text-[36px] leading-[44px] mb-1">€1.5K</p>
                <p className="text-[13px] text-hh-ui-300">Live halve dag</p>
              </div>
            </div>

            {/* Simple value prop */}
            <p className="text-[18px] leading-[28px] text-white">
              Train elke dag.<br/>Win elke week.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}