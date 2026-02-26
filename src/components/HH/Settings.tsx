import { useState, useEffect, useRef } from "react";
import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Textarea } from "../ui/textarea";
import {
  User,
  Bell,
  CreditCard,
  Users,
  Settings as SettingsIcon,
  Shield,
  Upload,
  Save,
  LogOut,
  Check,
  ChevronRight,
  X,
  Plus,
  Loader2,
  Crown,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { auth } from "../../utils/supabase/client";
import { uploadAvatar } from "../../utils/supabase/storage";
import { useUser } from "../../contexts/UserContext";

interface NotificationPreferences {
  email_notifications: boolean;
  weekly_summary: boolean;
  new_scenarios: boolean;
  team_updates: boolean;
  marketing_emails: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  email_notifications: true,
  weekly_summary: true,
  new_scenarios: true,
  team_updates: false,
  marketing_emails: false,
};

interface SettingsProps {
  navigate?: (page: string) => void;
  initialSection?: "profile" | "notifications" | "subscription" | "team" | "danger";
  isAdmin?: boolean;
  onboardingMode?: boolean;
}

export function Settings({ navigate, initialSection = "profile", isAdmin }: SettingsProps) {
  const { user, workspace, session, logout, refreshUser } = useUser();
  const [activeSection, setActiveSection] = useState(initialSection);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [bio, setBio] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [notifSaving, setNotifSaving] = useState(false);

  const isTeamPlan = workspace?.plan_tier === "team" || workspace?.plan_tier === "enterprise";

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const result = await auth.getUser();
        if (result?.user) {
          const meta = result.user.user_metadata || {};
          setRole(meta.role || "");
          setCompany(meta.company || workspace?.name || "");
          setBio(meta.bio || "");

          const savedNotifs = meta.notification_preferences;
          if (savedNotifs) {
            setNotifications({ ...DEFAULT_NOTIFICATIONS, ...savedNotifs });
          }
        }
      } catch (err) {
        console.error("Failed to load user metadata:", err);
      }
    }
    loadMetadata();
  }, [workspace]);

  useEffect(() => {
    if (initialSection) {
      const element = document.getElementById(`section-${initialSection}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [initialSection]);

  const sections = [
    { id: "profile", label: "Profiel", icon: User },
    { id: "notifications", label: "Notificaties", icon: Bell },
    { id: "subscription", label: "Abonnement", icon: CreditCard },
    ...(isTeamPlan ? [{ id: "team", label: "Team", icon: Users }] : []),
    { id: "danger", label: "Account", icon: SettingsIcon },
  ];

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const avatarRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async () => {
    const file = avatarRef.current?.files?.[0];
    if (file) {
      let userResult;
      try {
        userResult = await auth.getUser();
      } catch (err) {
        console.error("Error getting user:", err);
        return;
      }

      if (!userResult || !userResult.user) {
        console.error("No user logged in");
        return;
      }

      const u = userResult.user;
      const { url, error } = await uploadAvatar(u.id, file);
      if (url) {
        await auth.updateUser({ avatar_url: url });
        await refreshUser();
      } else if (error) {
        console.error("Error uploading avatar:", error);
      }
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const { error } = await auth.updateUser({
        first_name: firstName,
        last_name: lastName,
        role: role,
        company: company,
        bio: bio,
      });
      if (error) {
        console.error("Error saving profile:", error);
      } else {
        setProfileSaved(true);
        await refreshUser();
        setTimeout(() => setProfileSaved(false), 3000);
      }
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleResetProfile = () => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setEmail(user.email || "");
    }
    setRole("");
    setBio("");
    setCompany(workspace?.name || "");
  };

  const updateNotification = async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    setNotifSaving(true);
    try {
      const { error } = await auth.updateUser({
        notification_preferences: updated,
      });
      if (error) {
        console.error("Error saving notification preferences:", error);
        setNotifications(notifications);
      }
    } catch (err) {
      console.error("Error saving notification preferences:", err);
      setNotifications(notifications);
    } finally {
      setNotifSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate?.("landing");
  };

  return (
    <AppLayout currentPage="settings" navigate={navigate} isAdmin={isAdmin}>
      <div className="flex h-full">
        <aside className="hidden lg:block w-64 border-r border-hh-border bg-hh-ui-50 p-4 overflow-y-auto">
          <div className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeSection === section.id
                      ? "bg-hh-primary text-white"
                      : "text-hh-text hover:bg-hh-ui-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[14px] leading-[20px]">{section.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
            <div>
              <h1 className="mb-2 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
                Instellingen
              </h1>
              <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
                Beheer je account, notificaties en voorkeuren
              </p>
            </div>

            {/* Profile Settings */}
            <Card
              className="p-4 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-border"
              id="section-profile"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-hh-primary" />
                </div>
                <div>
                  <h2 className="mb-0">Profiel</h2>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Jouw persoonlijke gegevens en avatar
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="bg-hh-primary text-white text-[24px]">
                      {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}{user?.last_name?.[0] || ""}
                    </AvatarFallback>
                    <AvatarImage src={user?.avatar_url} />
                  </Avatar>
                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      ref={avatarRef}
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 mb-2"
                      onClick={() => avatarRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" /> Upload foto
                    </Button>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      JPG of PNG, max 2MB
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Voornaam</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Voornaam"
                      className="bg-hh-ui-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Achternaam</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Achternaam"
                      className="bg-hh-ui-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-hh-ui-50 opacity-60"
                  />
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    Email kan niet gewijzigd worden
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Functie</Label>
                    <Input
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Bijv. Senior Sales Rep"
                      className="bg-hh-ui-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Bedrijf</Label>
                    <Input
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Bedrijfsnaam"
                      className="bg-hh-ui-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (optioneel)</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Vertel iets over jezelf en je sales ervaring..."
                    className="bg-hh-ui-50"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleResetProfile}
                  >
                    Annuleer
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                  >
                    {profileSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : profileSaved ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {profileSaved ? "Opgeslagen" : "Opslaan"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Notifications */}
            <Card
              className="p-6 rounded-[16px] shadow-hh-sm border-hh-border"
              id="section-notifications"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-hh-warn" />
                </div>
                <div>
                  <h2 className="mb-0">Notificaties</h2>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Kies welke updates je wilt ontvangen
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text">
                      Email notificaties
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Ontvang updates over je voortgang en tips van Hugo
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email_notifications}
                    onCheckedChange={(v) => updateNotification("email_notifications", v)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text">
                      Wekelijkse samenvatting
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Elke maandag een overzicht van je voortgang
                    </p>
                  </div>
                  <Switch
                    checked={notifications.weekly_summary}
                    onCheckedChange={(v) => updateNotification("weekly_summary", v)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text">
                      Nieuwe scenario's
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Krijg een melding als er nieuwe scenarios beschikbaar zijn
                    </p>
                  </div>
                  <Switch
                    checked={notifications.new_scenarios}
                    onCheckedChange={(v) => updateNotification("new_scenarios", v)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text">
                      Team updates
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Updates over je teamleden en prestaties
                    </p>
                  </div>
                  <Switch
                    checked={notifications.team_updates}
                    onCheckedChange={(v) => updateNotification("team_updates", v)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text">
                      Marketing emails
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Productnieuws en speciale aanbiedingen
                    </p>
                  </div>
                  <Switch
                    checked={notifications.marketing_emails}
                    onCheckedChange={(v) => updateNotification("marketing_emails", v)}
                  />
                </div>

                {notifSaving && (
                  <p className="text-[12px] text-hh-muted flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Opslaan...
                  </p>
                )}
              </div>
            </Card>

            {/* Subscription */}
            <Card
              className="p-6 rounded-[16px] shadow-hh-sm border-hh-border"
              id="section-subscription"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-hh-primary" />
                </div>
                <div>
                  <h2 className="mb-0">Abonnement & Betaling</h2>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Beheer je abonnement en betalingsgegevens
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-hh-ui-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[16px] leading-[24px] text-hh-text mb-1">
                        Hugo Herbots Pro
                      </p>
                      <p className="text-[14px] leading-[20px] text-hh-muted">
                        Maandelijks abonnement • €149/maand
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[24px] leading-[32px] text-hh-text">
                        €149
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        per maand
                      </p>
                    </div>
                  </div>
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    Volgende betaling: 6 februari 2025
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setChangePlanModalOpen(true)}
                  >
                    Wijzig plan
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPaymentMethodModalOpen(true)}
                  >
                    Betalingsmethode
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-[14px] leading-[20px] text-hh-text">
                    Facturen & betaalgeschiedenis
                  </p>
                  <Button variant="ghost" size="sm">
                    Bekijk alle facturen →
                  </Button>
                </div>
              </div>
            </Card>

            {/* Team - only for Team/Enterprise plans */}
            {isTeamPlan ? (
              <Card
                className="p-6 rounded-[16px] shadow-hh-sm border-hh-border"
                id="section-team"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-hh-primary" />
                  </div>
                  <div>
                    <h2 className="mb-0">Team</h2>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Beheer je teamleden en rollen
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] leading-[24px] text-hh-text">
                        Teamleden
                      </p>
                      <p className="text-[14px] leading-[20px] text-hh-muted">
                        Voeg teamleden toe of verwijder ze
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4" /> Voeg toe
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] leading-[24px] text-hh-text">
                        Rollen
                      </p>
                      <p className="text-[14px] leading-[20px] text-hh-muted">
                        Wijs rollen toe aan teamleden
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4" /> Voeg toe
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card
                className="p-6 rounded-[16px] shadow-hh-sm border-hh-border"
                id="section-team"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-hh-primary" />
                  </div>
                  <div>
                    <h2 className="mb-0">Team</h2>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Werk samen met je team
                    </p>
                  </div>
                </div>

                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-hh-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-8 h-8 text-hh-primary" />
                  </div>
                  <h3 className="text-[18px] leading-[24px] text-hh-text mb-2">
                    Upgrade naar Team
                  </h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted mb-6 max-w-md mx-auto">
                    Met een Team abonnement kun je teamleden uitnodigen, voortgang volgen en samen trainen.
                  </p>
                  <Button onClick={() => setChangePlanModalOpen(true)} className="gap-2">
                    <Crown className="w-4 h-4" /> Bekijk Team plan
                  </Button>
                </div>
              </Card>
            )}

            {/* Account Actions (replaces Danger Zone) */}
            <Card
              className="p-6 rounded-[16px] shadow-hh-sm border-hh-border"
              id="section-danger"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-hh-ui-100 flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-hh-muted" />
                </div>
                <div>
                  <h2 className="mb-0">Account</h2>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Account instellingen en uitloggen
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-hh-border bg-hh-bg">
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text mb-1">
                      Uitloggen
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Log uit van je account op dit apparaat
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" /> Uitloggen
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Change Plan Modal */}
      <Dialog open={changePlanModalOpen} onOpenChange={setChangePlanModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wijzig je abonnement</DialogTitle>
            <DialogDescription>
              Kies een nieuw plan dat bij je past
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Plan */}
            <div className="p-4 rounded-lg border-2 border-hh-primary bg-hh-primary/5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[18px] leading-[24px] text-hh-text font-semibold">
                      Pro
                    </p>
                    <span className="px-2 py-0.5 bg-hh-primary text-white text-[10px] rounded">
                      HUIDIG
                    </span>
                  </div>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Voor individuele gebruikers
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[24px] leading-[30px] text-hh-text font-bold">
                    €149
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    per maand
                  </p>
                </div>
              </div>
            </div>

            {/* Team Plan */}
            <div className="p-4 rounded-lg border border-hh-border hover:border-hh-primary transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[18px] leading-[24px] text-hh-text font-semibold mb-1">
                    Team
                  </p>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Voor teams van 5+ leden
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[24px] leading-[30px] text-hh-text font-bold">
                    €499
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    per maand
                  </p>
                </div>
              </div>
              <Button className="w-full mt-3">
                Upgrade naar Team
              </Button>
            </div>

            {/* Starter Plan */}
            <div className="p-4 rounded-lg border border-hh-border hover:border-hh-primary transition-all cursor-pointer opacity-60">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[18px] leading-[24px] text-hh-text font-semibold mb-1">
                    Starter
                  </p>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Basis features
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[24px] leading-[30px] text-hh-text font-bold">
                    €49
                  </p>
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    per maand
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-3">
                Downgrade naar Starter
              </Button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setChangePlanModalOpen(false)}>
                Annuleer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Modal */}
      <Dialog open={paymentMethodModalOpen} onOpenChange={setPaymentMethodModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Betalingsmethode wijzigen</DialogTitle>
            <DialogDescription>
              Update je betaalgegevens
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Payment Method */}
            <div className="p-4 rounded-lg bg-hh-ui-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      Visa •••• 1234
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Verloopt 12/2026
                    </p>
                  </div>
                </div>
                <Check className="w-5 h-5 text-hh-success" />
              </div>
            </div>

            <Separator />

            {/* Add New Payment Method */}
            <div className="space-y-3">
              <Label>Nieuwe betaalmethode toevoegen</Label>
              
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Kaartnummer</Label>
                <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Vervaldatum</Label>
                  <Input id="expiry" placeholder="MM/JJ" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" placeholder="123" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Naam op kaart</Label>
                <Input id="name" placeholder={user?.full_name || "Naam op kaart"} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setPaymentMethodModalOpen(false)}>
                Annuleer
              </Button>
              <Button onClick={() => setPaymentMethodModalOpen(false)}>
                Opslaan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}