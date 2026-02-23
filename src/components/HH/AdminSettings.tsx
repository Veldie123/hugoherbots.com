import {
  Settings as SettingsIcon,
  Key,
  Mail,
  Palette,
  Database,
  Shield,
  Users,
  Bell,
  Link2,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";

interface AdminSettingsProps {
  navigate?: (page: string) => void;
}

export function AdminSettings({ navigate }: AdminSettingsProps) {
  const [showApiKeys, setShowApiKeys] = useState(false);

  return (
    <AdminLayout currentPage="admin-settings" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
            Platform Settings
          </h1>
          <p className="text-[16px] leading-[24px] text-hh-muted">
            Configureer platform instellingen en integraties
          </p>
        </div>

        {/* Settings Tabs - Responsive grid */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide gap-1 p-1">
            <TabsTrigger value="general" className="flex items-center gap-2 px-3 py-2 whitespace-nowrap flex-shrink-0">
              <SettingsIcon className="w-4 h-4" />
              <span className="text-sm">Algemeen</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 px-3 py-2 whitespace-nowrap flex-shrink-0">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Security</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2 px-3 py-2 whitespace-nowrap flex-shrink-0">
              <Link2 className="w-4 h-4" />
              <span className="text-sm">Integraties</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 px-3 py-2 whitespace-nowrap flex-shrink-0">
              <Bell className="w-4 h-4" />
              <span className="text-sm">Notificaties</span>
            </TabsTrigger>
            <TabsTrigger value="admins" className="flex items-center gap-2 px-3 py-2 whitespace-nowrap flex-shrink-0">
              <Users className="w-4 h-4" />
              <span className="text-sm">Admins</span>
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5" style={{ color: '#9333ea' }} />
                Branding & Customization
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="platform-name" className="text-[14px] mb-2 block">
                    Platform Naam
                  </Label>
                  <Input
                    id="platform-name"
                    defaultValue="HugoHerbots.ai"
                    placeholder="Bijv: HugoHerbots.ai"
                  />
                </div>
                <div>
                  <Label htmlFor="platform-tagline" className="text-[14px] mb-2 block">
                    Tagline
                  </Label>
                  <Input
                    id="platform-tagline"
                    defaultValue="40 jaar salesgeheimen, nu jouw dagelijkse coach."
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
                    defaultValue="support@hugoherbots.ai"
                    placeholder="support@example.com"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                <Database className="w-5 h-5" style={{ color: '#9333ea' }} />
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
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-hh-ui-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9333ea]"></div>
                  </label>
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
                    defaultValue="14"
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
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-hh-ui-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9333ea]"></div>
                  </label>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="space-y-6">
            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #9333ea 0%, #d64b7a 100%)' }}>
                    <span className="text-white text-[18px] font-bold">HG</span>
                  </div>
                  <div>
                    <h3 className="text-[18px] leading-[24px] text-hh-text font-medium">
                      HeyGen API
                    </h3>
                    <p className="text-[13px] leading-[18px] text-hh-muted">
                      AI Avatar voor video generatie
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  Connected
                </Badge>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="heygen-key" className="text-[14px] mb-2 block">
                    API Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="heygen-key"
                      type={showApiKeys ? "text" : "password"}
                      defaultValue="hg_1234567890abcdef"
                      placeholder="Voer HeyGen API key in"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowApiKeys(!showApiKeys)}
                    >
                      {showApiKeys ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="heygen-avatar" className="text-[14px] mb-2 block">
                    Avatar ID
                  </Label>
                  <Input
                    id="heygen-avatar"
                    defaultValue="avatar_hugo_001"
                    placeholder="Avatar ID"
                  />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Test Connectie
                </Button>
              </div>
            </Card>

            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                    <span className="text-white text-[18px] font-bold">AI</span>
                  </div>
                  <div>
                    <h3 className="text-[18px] leading-[24px] text-hh-text font-medium">
                      OpenAI API
                    </h3>
                    <p className="text-[13px] leading-[18px] text-hh-muted">
                      GPT-4 voor feedback en analyse
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  Connected
                </Badge>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="openai-key" className="text-[14px] mb-2 block">
                    API Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="openai-key"
                      type={showApiKeys ? "text" : "password"}
                      defaultValue=""
                      placeholder="Voer OpenAI API key in"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowApiKeys(!showApiKeys)}
                    >
                      {showApiKeys ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="openai-model" className="text-[14px] mb-2 block">
                    Model
                  </Label>
                  <Input
                    id="openai-model"
                    defaultValue="gpt-4-turbo"
                    placeholder="Model naam"
                  />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Test Connectie
                </Button>
              </div>
            </Card>

            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                    <span className="text-white text-[18px] font-bold">FB</span>
                  </div>
                  <div>
                    <h3 className="text-[18px] leading-[24px] text-hh-text font-medium">
                      Firebase
                    </h3>
                    <p className="text-[13px] leading-[18px] text-hh-muted">
                      Database & Authentication
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  Connected
                </Badge>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="firebase-project" className="text-[14px] mb-2 block">
                    Project ID
                  </Label>
                  <Input
                    id="firebase-project"
                    defaultValue="hugoherbots-ai"
                    placeholder="Firebase project ID"
                  />
                </div>
                <div>
                  <Label htmlFor="firebase-config" className="text-[14px] mb-2 block">
                    Config JSON
                  </Label>
                  <Textarea
                    id="firebase-config"
                    placeholder='{"apiKey": "...", "authDomain": "..."}'
                    rows={4}
                    className="font-mono text-[12px]"
                  />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Test Connectie
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-6">
            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: '#9333ea' }} />
                Security Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      Two-Factor Authentication
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Verplicht 2FA voor alle admin accounts
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-hh-ui-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9333ea]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      Session Timeout
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Automatische uitlog na inactiviteit (minuten)
                    </p>
                  </div>
                  <Input
                    type="number"
                    defaultValue="60"
                    className="w-20 text-center"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      IP Whitelist
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Beperk admin toegang tot specifieke IP adressen
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-hh-ui-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9333ea]"></div>
                  </label>
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                <Key className="w-5 h-5" style={{ color: '#9333ea' }} />
                API Keys & Webhooks
              </h3>
              <div className="space-y-3">
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Beheer API keys voor externe integraties en webhooks
                </p>
                <Button variant="outline" className="w-full gap-2">
                  <Key className="w-4 h-4" />
                  Beheer API Keys
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5" style={{ color: '#9333ea' }} />
                Email Templates
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg hover:bg-hh-ui-100 transition-colors cursor-pointer">
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      Welcome Email
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Verstuurd na nieuwe signup
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg hover:bg-hh-ui-100 transition-colors cursor-pointer">
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      Weekly Summary
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Wekelijkse voortgang samenvatting
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg hover:bg-hh-ui-100 transition-colors cursor-pointer">
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      Trial Ending
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Herinnering voor einde trial periode
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5" style={{ color: '#9333ea' }} />
                Admin Notificaties
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      Nieuwe signups
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Email bij nieuwe gebruiker registratie
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-hh-ui-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9333ea]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                  <div>
                    <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                      System errors
                    </p>
                    <p className="text-[12px] leading-[16px] text-hh-muted">
                      Kritische fouten en downtime
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-hh-ui-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9333ea]"></div>
                  </label>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Admin Users */}
          <TabsContent value="admins" className="space-y-6">
            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[18px] leading-[24px] text-hh-text flex items-center gap-2">
                  <Users className="w-5 h-5" style={{ color: '#9333ea' }} />
                  Admin Accounts
                </h3>
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  + Add Admin
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full text-white flex items-center justify-center text-[14px] font-medium" style={{ backgroundColor: '#9333ea' }}>
                      HH
                    </div>
                    <div>
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                        Hugo Herbots
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        hugo@hugoherbots.com
                      </p>
                    </div>
                  </div>
                  <Badge style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}>
                    Super Admin
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-hh-ui-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-[14px] font-medium">
                      JD
                    </div>
                    <div>
                      <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                        Admin User
                      </p>
                      <p className="text-[12px] leading-[16px] text-hh-muted">
                        admin@hugoherbots.ai
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-blue-600/10 text-blue-600 border-blue-600/20">
                    Content Manager
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[18px] leading-[24px] text-hh-text mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: '#9333ea' }} />
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

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-6 border-t border-hh-border">
          <Button variant="outline">
            Reset naar Default
          </Button>
          <Button className="bg-red-600 hover:bg-red-700 gap-2">
            <Save className="w-4 h-4" />
            Opslaan
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}