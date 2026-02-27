import {
  CreditCard,
  Search,
  Download,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Eye,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface AdminBillingProps {
  navigate?: (page: string) => void;
}

export function AdminBilling({ navigate }: AdminBillingProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode("card", "list");
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const invoices = [
    {
      id: "INV-2025-001",
      organization: "TechCorp BV",
      plan: "Team",
      amount: 499,
      status: "paid",
      date: "2025-01-15",
      dueDate: "2025-01-15",
      paidDate: "2025-01-15",
      period: "Jan 2025",
    },
    {
      id: "INV-2025-002",
      organization: "Salesforce EMEA",
      plan: "Enterprise",
      amount: 2499,
      status: "paid",
      date: "2025-01-14",
      dueDate: "2025-01-14",
      paidDate: "2025-01-14",
      period: "Jan 2025",
    },
    {
      id: "INV-2025-003",
      organization: "GrowCo",
      plan: "Pro",
      amount: 149,
      status: "pending",
      date: "2025-01-13",
      dueDate: "2025-01-20",
      paidDate: null,
      period: "Jan 2025",
    },
    {
      id: "INV-2025-004",
      organization: "Example Inc",
      plan: "Pro",
      amount: 149,
      status: "overdue",
      date: "2024-12-15",
      dueDate: "2024-12-22",
      paidDate: null,
      period: "Dec 2024",
    },
    {
      id: "INV-2024-089",
      organization: "StartUp.io",
      plan: "Starter",
      amount: 49,
      status: "paid",
      date: "2024-12-12",
      dueDate: "2024-12-12",
      paidDate: "2024-12-12",
      period: "Dec 2024",
    },
    {
      id: "INV-2024-088",
      organization: "TechCorp BV",
      plan: "Team",
      amount: 499,
      status: "paid",
      date: "2024-12-15",
      dueDate: "2024-12-15",
      paidDate: "2024-12-16",
      period: "Dec 2024",
    },
  ];

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1 inline" />
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Betaald
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px] gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        );
      case "overdue":
        return (
          <Badge className="bg-hh-error/10 text-hh-error border-hh-error/20 text-[11px] gap-1">
            <AlertCircle className="w-3 h-3" />
            Achterstallig
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-600/10 text-red-600 border-red-600/20 text-[11px] gap-1">
            <XCircle className="w-3 h-3" />
            Mislukt
          </Badge>
        );
      default:
        return null;
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (filterStatus !== "all" && invoice.status !== filterStatus) return false;
    if (searchQuery && !invoice.organization.toLowerCase().includes(searchQuery.toLowerCase()) && !invoice.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((acc, i) => acc + i.amount, 0);
  const pendingRevenue = invoices.filter(i => i.status === "pending").reduce((acc, i) => acc + i.amount, 0);
  const overdueRevenue = invoices.filter(i => i.status === "overdue").reduce((acc, i) => acc + i.amount, 0);

  return (
    <AdminLayout currentPage="admin-billing" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Facturatie & Betalingen
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer {invoices.length} facturen en betalingen
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* KPI Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +18%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Totale Inkomsten
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              €{totalRevenue.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-blue-600/10 text-blue-600 border-blue-600/20"
              >
                {invoices.filter(i => i.status === "pending").length}
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Pending
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              €{pendingRevenue.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-error/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-hh-error" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-error/10 text-hh-error border-hh-error/20"
              >
                {invoices.filter(i => i.status === "overdue").length}
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Achterstallig
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              €{overdueRevenue.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(147, 51, 234, 0.1)" }}>
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: "#9333ea" }} />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                +5%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Facturen
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {invoices.length}
            </p>
          </Card>
        </div>

        {/* Search, View Toggle & Filters Card */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="space-y-3">
            {/* Search + View Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
                <Input
                  placeholder="Zoek facturen, organisaties..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="hidden sm:flex rounded-lg border border-hh-border overflow-hidden">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none border-r border-hh-border"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "card" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setViewMode("card")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="paid">Betaald</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Achterstallig</SelectItem>
                  <SelectItem value="failed">Mislukt</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Periodes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Periodes</SelectItem>
                  <SelectItem value="current">Deze maand</SelectItem>
                  <SelectItem value="last">Vorige maand</SelectItem>
                  <SelectItem value="quarter">Dit kwartaal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* List View - Table */}
        {viewMode === "list" && (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer" onClick={() => handleSort("id")}>
                      Factuur # {getSortIcon("id")}
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer" onClick={() => handleSort("organization")}>
                      Organisatie {getSortIcon("organization")}
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Plan
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer" onClick={() => handleSort("amount")}>
                      Bedrag {getSortIcon("amount")}
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer" onClick={() => handleSort("date")}>
                      Datum {getSortIcon("date")}
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium font-mono">
                          {invoice.id}
                        </p>
                        <p className="text-[12px] leading-[16px] text-hh-muted">
                          {invoice.period}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                          {invoice.organization}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[11px]">
                          {invoice.plan}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                          €{invoice.amount}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[14px] leading-[20px] text-hh-text">
                          {invoice.date}
                        </p>
                        {invoice.status === "paid" && invoice.paidDate && (
                          <p className="text-[12px] leading-[16px] text-hh-muted">
                            Betaald: {invoice.paidDate}
                          </p>
                        )}
                        {invoice.status === "overdue" && (
                          <p className="text-[12px] leading-[16px] text-hh-error">
                            Vervaldatum: {invoice.dueDate}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(invoice.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Card View - Grid */}
        {viewMode === "card" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.map((invoice) => (
              <Card key={invoice.id} className="p-4 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[16px] leading-[22px] text-hh-text font-medium font-mono">
                      {invoice.id}
                    </p>
                    <p className="text-[13px] leading-[18px] text-hh-muted">
                      {invoice.period}
                    </p>
                  </div>
                  {getStatusBadge(invoice.status)}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">Organisatie:</span>
                    <span className="text-hh-text font-medium">{invoice.organization}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">Plan:</span>
                    <Badge variant="outline" className="text-[11px]">{invoice.plan}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">Bedrag:</span>
                    <span className="text-hh-text font-semibold text-[16px]">€{invoice.amount}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] leading-[18px]">
                    <span className="text-hh-muted">Datum:</span>
                    <span className="text-hh-text">{invoice.date}</span>
                  </div>
                  {invoice.status === "paid" && invoice.paidDate && (
                    <div className="flex items-center justify-between text-[13px] leading-[18px]">
                      <span className="text-hh-muted">Betaald:</span>
                      <span className="text-emerald-500">{invoice.paidDate}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-hh-border flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2">
                    <Eye className="w-3.5 h-3.5" />
                    Bekijk
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-2">
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
