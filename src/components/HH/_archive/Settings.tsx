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
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { auth } from "../../utils/supabase/client";
import { uploadAvatar } from "../../utils/supabase/storage";
import { useUser } from "../../contexts/UserContext";

interface SettingsProps {
  navigate?: (page: string) => void;
  initialSection?: "profile" | "notifications" | "subscription" | "team" | "danger";
}

export function Settings({ navigate, initialSection = "profile" }: SettingsProps) {
  const { user, workspace } = useUser();
  const [activeSection, setActiveSection] = useState(initialSection);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);

  // Auto-scroll to section on mount or when initialSection changes
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
    { id: "team", label: "Team", icon: Users },
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
      // Get current user - DEFENSIVE CODE
      let userResult;
      try {
        userResult = await auth.getUser();
      } catch (err) {
        console.error("❌ Error getting user:", err);
        return;
      }

      if (!userResult || !userResult.user) {
        console.error("No user logged in");
        return;
      }

      const user = userResult.user;

      const { url, error } = await uploadAvatar(user.id, file);
      if (url) {
        console.log("Avatar uploaded successfully:", url);
        // TODO: Update user metadata with new avatar URL
      } else if (error) {
        console.error("Error uploading avatar:", error);
      }
    }
  };

  return (
    <AppLayout currentPage="settings" navigate={navigate}>
      <div className="flex h-full">
        {/* Left Sidebar - Subnavigation */}
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

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
            {/* Header */}
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
                {/* Avatar */}
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

                {/* Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Voornaam</Label>
                    <Input
                      id="firstName"
                      defaultValue={user?.first_name || ""}
                      placeholder="Voornaam"
                      className="bg-hh-ui-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Achternaam</Label>
                    <Input
                      id="lastName"
                      defaultValue={user?.last_name || ""}
                      placeholder="Achternaam"
                      className="bg-hh-ui-50"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user?.email || ""}
                    className="bg-hh-ui-50"
                  />
                  <p className="text-[12px] leading-[16px] text-hh-muted">
                    We sturen updates naar dit adres
                  </p>
                </div>

                {/* Job Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Functie</Label>
                    <Input
                      id="role"
                      defaultValue=""
                      placeholder="Bijv. Senior Sales Rep"
                      className="bg-hh-ui-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Bedrijf</Label>
                    <Input
                      id="company"
                      defaultValue={workspace?.name || ""}
                      placeholder="Bedrijfsnaam"
                      className="bg-hh-ui-50"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (optioneel)</Label>
                  <Textarea
                    id="bio"
                    placeholder="Vertel iets over jezelf en je sales ervaring..."
                    className="bg-hh-ui-50"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {/* Reset form */}}
                  >
                    Annuleer
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => {/* Save profile settings */}}
                  >
                    <Save className="w-4 h-4" /> Opslaan
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
                  <Switch defaultChecked />
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
                  <Switch defaultChecked />
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
                  <Switch defaultChecked />
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
                  <Switch />
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
                  <Switch />
                </div>
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

            {/* Team */}
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

            {/* Danger Zone */}
            <Card
              className="p-6 rounded-[16px] shadow-hh-sm border-destructive/20 bg-destructive/5"
              id="section-danger"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h2 className="mb-0 text-destructive">Danger Zone</h2>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    Permanente acties — wees voorzichtig
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-hh-border bg-hh-bg">
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text mb-1">
                      Verwijder alle sessiedata
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Wis je complete trainingsgeschiedenis en scores
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Wissen
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-hh-border bg-hh-bg">
                  <div>
                    <p className="text-[16px] leading-[24px] text-hh-text mb-1">
                      Deactiveer account
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Pauzeer je account tijdelijk zonder data te verliezen
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Deactiveer
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50 bg-hh-bg">
                  <div>
                    <p className="text-[16px] leading-[24px] text-destructive mb-1">
                      Verwijder account
                    </p>
                    <p className="text-[14px] leading-[20px] text-hh-muted">
                      Permanent verwijderen — dit kan niet ongedaan gemaakt worden
                    </p>
                  </div>
                  <Button variant="destructive" size="sm">
                    Verwijder
                  </Button>
                </div>
              </div>
            </Card>

            {/* Logout */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                className="gap-2 text-hh-muted"
                onClick={() => navigate?.("landing")}
              >
                <LogOut className="w-4 h-4" /> Log uit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Plan Modal */}
      <Dialog open={changePlanModalOpen} onOpenChange={setChangePlanModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
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
        <DialogContent className="sm:max-w-[500px]">
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
                <Input id="name" placeholder="Jan de Vries" />
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