/**
 * TODO[ADMIN-CONFLICTS-PAGE]: Admin Conflicts pagina voor Golden Standard correcties
 * Status: Pending
 * Issue: Geen UI om config conflicts te reviewen en patches toe te passen
 * Bron: hugo-engine_(4).zip → server/config-consistency.ts (backend klaar, frontend ontbreekt)
 * Aanpak:
 *   1. API endpoint GET /api/v2/admin/config-conflicts toevoegen in api.ts
 *   2. Conflict lijst ophalen met severity filter (High/Medium/Low)
 *   3. View Patch knop → toon suggested config change
 *   4. Apply Patch (✓) → POST /api/v2/admin/config-conflicts/:id/apply
 *   5. Reject Patch (✗) → POST /api/v2/admin/config-conflicts/:id/reject
 *   6. Session Context collapsible tonen met volledige conversatie
 * Frontend koppeling: AdminLayout navigation, route /admin-conflicts
 * 
 * PLACEHOLDER: Dit component wordt pas geïmplementeerd wanneer de API endpoints bestaan
 */

import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { AlertTriangle } from "lucide-react";

interface AdminConflictsProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

export function AdminConflicts({ navigate, isSuperAdmin }: AdminConflictsProps) {
  return (
    <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-conflicts" navigate={navigate}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
            Config Conflicts
          </h1>
          <p className="text-[16px] leading-[24px] text-hh-muted">
            Review en pas config wijzigingen toe op basis van Golden Standard correcties
          </p>
        </div>

        <Card className="p-8 text-center border-dashed border-2 border-hh-border">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nog niet geïmplementeerd</h2>
          <p className="text-hh-muted">
            Deze pagina wordt actief wanneer de API endpoints voor config conflicts zijn toegevoegd.
          </p>
          <p className="text-[12px] text-hh-muted mt-4">
            Zie TODO[ADMIN-CONFLICTS-PAGE] voor implementatie details
          </p>
        </Card>
      </div>
    </AdminLayout>
  );
}
