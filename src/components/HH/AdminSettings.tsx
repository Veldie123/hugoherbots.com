import { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon,
  Palette,
  Database,
  Shield,
  Users,
  Save,
  Loader2,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { apiFetch } from '../../services/apiFetch';

interface AdminSettingsProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

interface BrandingSettings {
  platformName: string;
  tagline: string;
  supportEmail: string;
}

interface PlatformConfig {
  allowNewUsers: boolean;
  trialDays: number;
  maintenanceMode: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  admin_role: string;
  avatar_url: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  content_manager: "Content Manager",
  support_agent: "Support Agent",
};

export function AdminSettings({ navigate, isSuperAdmin }: AdminSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Branding
  const [branding, setBranding] = useState<BrandingSettings>({
    platformName: "HugoHerbots.ai",
    tagline: "40 jaar salesgeheimen, nu jouw dagelijkse coach.",
    supportEmail: "support@hugoherbots.ai",
  });

  // Platform config
  const [platform, setPlatform] = useState<PlatformConfig>({
    allowNewUsers: true,
    trialDays: 14,
    maintenanceMode: false,
  });

  // Admins
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("content_manager");
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Saved state for reset
  const [savedBranding, setSavedBranding] = useState<BrandingSettings>(branding);
  const [savedPlatform, setSavedPlatform] = useState<PlatformConfig>(platform);

  const fetchSettings = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/admin/settings");
      const data = await resp.json();
      if (data.success && data.settings) {
        if (data.settings.branding) {
          setBranding(data.settings.branding);
          setSavedBranding(data.settings.branding);
        }
        if (data.settings.platform) {
          setPlatform(data.settings.platform);
          setSavedPlatform(data.settings.platform);
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdmins = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/admin/admins");
      const data = await resp.json();
      if (data.success) setAdmins(data.admins || []);
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchAdmins();
  }, [fetchSettings, fetchAdmins]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await apiFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: { branding, platform } }),
      });
      const data = await resp.json();
      if (data.success) {
        setSavedBranding({ ...branding });
        setSavedPlatform({ ...platform });
        toast.success("Instellingen opgeslagen");
      } else {
        toast.error("Opslaan mislukt: " + (data.error || "Onbekende fout"));
      }
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setBranding({ ...savedBranding });
    setPlatform({ ...savedPlatform });
    toast.info("Instellingen teruggezet");
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    try {
      const resp = await apiFetch("/api/admin/admins", {
        method: "POST",
        body: JSON.stringify({ email: newAdminEmail.trim(), role: newAdminRole }),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success("Admin toegevoegd");
        setAddAdminOpen(false);
        setNewAdminEmail("");
        fetchAdmins();
      } else {
        toast.error(data.error || "Toevoegen mislukt");
      }
    } catch {
      toast.error("Toevoegen mislukt");
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string, adminEmail: string) => {
    if (!confirm(`Weet je zeker dat je ${adminEmail} als admin wilt verwijderen?`)) return;
    try {
      const resp = await apiFetch(`/api/admin/admins/${adminId}`, { method: "DELETE" });
      const data = await resp.json();
      if (data.success) {
        toast.success("Admin verwijderd");
        fetchAdmins();
      } else {
        toast.error(data.error || "Verwijderen mislukt");
      }
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  const getInitials = (first: string, last: string) => {
    return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase() || "?";
  };

  return (
    <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-settings" navigate={navigate}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
            Platform Settings
          </h1>
          <p className="text-[16px] leading-[24px] text-hh-muted">
            Configureer platform instellingen en integraties
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-hh-muted" />
          </div>
        ) : (
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="flex w-full overflow-x-auto scrollbar-hide gap-1 p-1">
              <TabsTrigger value="general" className="flex items-center gap-2 px-3 py-2 whitespace-nowrap flex-shrink-0">
                <SettingsIcon className="w-4 h-4" />
                <span className="text-sm">Algemeen</span>
              </TabsTrigger>
              <TabsTrigger value="admins" className="flex items-center gap-2 px-3 py-2 whitespace-nowrap flex-shrink-0">
                <Users className="w-4 h-4" />
                <span className="text-sm">Admins</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-hh-primary" />
                  Branding & Customization
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="platform-name" className="text-[14px] mb-2 block">
                      Platform Naam
                    </Label>
                    <Input
                      id="platform-name"
                      value={branding.platformName}
                      onChange={(e) => setBranding(b => ({ ...b, platformName: e.target.value }))}
                      placeholder="Bijv: HugoHerbots.ai"
                    />
                  </div>
                  <div>
                    <Label htmlFor="platform-tagline" className="text-[14px] mb-2 block">
                      Tagline
                    </Label>
                    <Input
                      id="platform-tagline"
                      value={branding.tagline}
                      onChange={(e) => setBranding(b => ({ ...b, tagline: e.target.value }))}
                      placeholder="Korte tagline"
                    />
                  </div>
                  <div>
                    <Label htmlFor="support-email" className="text-[14px] mb-2 block">
                      Support Email
                    </Label>
                    <Input
                      id="support-email"
                      type="email"
                      value={branding.supportEmail}
                      onChange={(e) => setBranding(b => ({ ...b, supportEmail: e.target.value }))}
                      placeholder="support@example.com"
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-hh-primary" />
                  Platform Configuratie
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                    <div>
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                        Nieuwe gebruikers toestaan
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        Sta nieuwe signups toe via de website
                      </p>
                    </div>
                    <Switch
                      checked={platform.allowNewUsers}
                      onCheckedChange={(v) => setPlatform(p => ({ ...p, allowNewUsers: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                    <div>
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                        Trial periode
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        Gratis trial voor nieuwe gebruikers
                      </p>
                    </div>
                    <Input
                      type="number"
                      value={platform.trialDays}
                      onChange={(e) => setPlatform(p => ({ ...p, trialDays: parseInt(e.target.value) || 0 }))}
                      className="w-20 text-center"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                    <div>
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                        Maintenance mode
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        Toon onderhoudspagina aan gebruikers
                      </p>
                    </div>
                    <Switch
                      checked={platform.maintenanceMode}
                      onCheckedChange={(v) => setPlatform(p => ({ ...p, maintenanceMode: v }))}
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="admins" className="space-y-6">
              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[18px] leading-[24px] text-hh-text flex items-center gap-2">
                    <Users className="w-5 h-5 text-hh-primary" />
                    Admin Accounts
                  </h3>
                  <Button size="sm" className="bg-hh-primary hover:bg-hh-primary/90 text-white" onClick={() => setAddAdminOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Add Admin
                  </Button>
                </div>
                <div className="space-y-3">
                  {admins.length === 0 ? (
                    <p className="text-[14px] text-hh-muted py-4 text-center">Geen admins gevonden</p>
                  ) : (
                    admins.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-hh-primary text-white flex items-center justify-center text-[14px] font-medium">
                            {getInitials(admin.first_name, admin.last_name)}
                          </div>
                          <div>
                            <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                              {admin.first_name} {admin.last_name}
                            </p>
                            <p className="text-[12px] leading-[16px] text-hh-muted">
                              {admin.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-hh-primary-100 text-hh-primary border-hh-primary-200">
                            {ROLE_LABELS[admin.admin_role] || admin.admin_role}
                          </Badge>
                          {admin.admin_role !== "super_admin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-hh-error hover:text-hh-error"
                              onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-hh-primary" />
                  Role Permissions
                </h3>
                <div className="space-y-3">
                  <p className="text-[13px] leading-[18px] text-hh-muted">
                    <strong>Super Admin:</strong> Volledige toegang tot alles
                  </p>
                  <p className="text-[13px] leading-[18px] text-hh-muted">
                    <strong>Content Manager:</strong> Video's, scenario's, live sessies beheren
                  </p>
                  <p className="text-[13px] leading-[18px] text-hh-muted">
                    <strong>Support Agent:</strong> User support en tickets
                  </p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t border-hh-border">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reset naar Default
          </Button>
          <Button className="bg-hh-primary hover:bg-hh-primary/90 text-white gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Opslaan
          </Button>
        </div>
      </div>

      {/* Add Admin Dialog */}
      <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Admin Toevoegen</DialogTitle>
            <DialogDescription>
              Voeg een bestaande gebruiker toe als admin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[14px] mb-2 block">Email</Label>
              <Input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <Label className="text-[14px] mb-2 block">Rol</Label>
              <Select value={newAdminRole} onValueChange={setNewAdminRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="content_manager">Content Manager</SelectItem>
                  <SelectItem value="support_agent">Support Agent</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setAddAdminOpen(false)}>Annuleer</Button>
              <Button onClick={handleAddAdmin} disabled={addingAdmin || !newAdminEmail.trim()}>
                {addingAdmin && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Toevoegen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
