import {
  Settings as SettingsIcon,
  Palette,
  Database,
  Shield,
  Users,
  Save,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";

interface AdminSettingsProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

export function AdminSettings({ navigate, isSuperAdmin }: AdminSettingsProps) {
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