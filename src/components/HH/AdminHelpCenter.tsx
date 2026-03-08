import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../services/apiFetch";
import { toast } from "sonner";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
import {
  Plus,
  Search,
  FileText,
  Eye,
  Edit2,
  Trash2,
  MoreVertical,
  Calendar,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Star,
  Check,
} from "lucide-react";
import { CustomCheckbox } from "../ui/custom-checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface AdminHelpCenterProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

export function AdminHelpCenter({ navigate, isSuperAdmin }: AdminHelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const selectionMode = selectedIds.length > 0;

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    category: "getting-started",
    content: "",
    status: "draft",
    featured: false,
  });

  const [articles, setArticles] = useState<any[]>([]);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v2/admin/articles");
      if (res.ok) setArticles(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const stats = {
    totalArticles: 48,
    publishedArticles: 42,
    totalViews: 12847,
    avgHelpfulRating: 92,
  };

  const filteredArticles = articles.filter((article) => {
    if (searchQuery && !article.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterCategory !== "all" && article.category !== filterCategory) {
      return false;
    }
    if (filterStatus !== "all" && article.status !== filterStatus) {
      return false;
    }
    return true;
  });

  const getCategoryBadge = (category: string) => {
    return (
      <Badge className="bg-hh-primary-100 text-hh-primary border-hh-primary-200 text-[11px]">
        {category}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Gepubliceerd":
        return (
          <Badge className="bg-hh-success/10 text-hh-success border-0 text-[11px]">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Gepubliceerd
          </Badge>
        );
      case "Concept":
        return (
          <Badge className="bg-hh-muted/10 text-hh-muted border-0 text-[11px]">
            <FileText className="w-3 h-3 mr-1" />
            Concept
          </Badge>
        );
      case "Gearchiveerd":
        return (
          <Badge className="bg-hh-error/10 text-hh-error border-0 text-[11px]">
            <XCircle className="w-3 h-3 mr-1" />
            Gearchiveerd
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleCreate = async () => {
    try {
      const res = await apiFetch("/api/v2/admin/articles", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success("Artikel aangemaakt");
        fetchArticles();
      } else {
        const err = await res.json();
        toast.error(err.error || "Aanmaken mislukt");
      }
    } catch {
      toast.error("Netwerk fout");
    }
    setCreateDialogOpen(false);
    setFormData({ title: "", excerpt: "", category: "getting-started", content: "", status: "draft", featured: false });
  };

  return (
    <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-help" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Help Center
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer help artikelen, FAQ's en documentatie voor gebruikers
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-hh-error hover:bg-hh-error/90 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Article
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--hh-primary-100)' }}>
                <FileText className="w-5 h-5" style={{ color: 'var(--hh-primary)' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5"
                style={{ backgroundColor: 'rgba(18, 185, 129, 0.1)', color: '#12B981', borderColor: 'rgba(18, 185, 129, 0.2)' }}
              >
                +8%
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Totaal Artikelen</p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {stats.totalArticles}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)' }}>
                <CheckCircle2 className="w-5 h-5" style={{ color: '#059669' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5"
                style={{ backgroundColor: 'rgba(18, 185, 129, 0.1)', color: '#12B981', borderColor: 'rgba(18, 185, 129, 0.2)' }}
              >
                Live
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Gepubliceerd</p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {stats.publishedArticles}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
                <Eye className="w-5 h-5" style={{ color: '#2563eb' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5"
                style={{ backgroundColor: 'rgba(18, 185, 129, 0.1)', color: '#12B981', borderColor: 'rgba(18, 185, 129, 0.2)' }}
              >
                +42%
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Totaal Views</p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {stats.totalViews}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)' }}>
                <ThumbsUp className="w-5 h-5" style={{ color: '#059669' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5"
                style={{ backgroundColor: 'rgba(18, 185, 129, 0.1)', color: '#12B981', borderColor: 'rgba(18, 185, 129, 0.2)' }}
              >
                Excellent
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Helpful Rating</p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {stats.avgHelpfulRating}%
            </p>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek artikelen op titel, inhoud..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Categorieën</SelectItem>
                <SelectItem value="Aan de slag">Aan de slag</SelectItem>
                <SelectItem value="Video Cursussen">Video Cursussen</SelectItem>
                <SelectItem value="Roleplay">Roleplay</SelectItem>
                <SelectItem value="Technieken">Technieken</SelectItem>
                <SelectItem value="Facturering">Facturering</SelectItem>
                <SelectItem value="Probleemoplossing">Probleemoplossing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Statussen</SelectItem>
                <SelectItem value="Gepubliceerd">Gepubliceerd</SelectItem>
                <SelectItem value="Concept">Concept</SelectItem>
                <SelectItem value="Gearchiveerd">Gearchiveerd</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Articles Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50 border-b border-hh-border">
                <tr>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted w-[40px]"></th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Titel & Excerpt
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Categorie
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Views
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Rating
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Datum
                  </th>
                  <th className="text-right px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map((article, index) => (
                  <tr
                    key={article.id}
                    className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50/50 transition-colors cursor-pointer ${
                      index % 2 === 0 ? "bg-card" : "bg-hh-ui-50/30"
                    }`}
                    onClick={() => setSelectedArticle(article)}
                    onMouseEnter={() => setHoveredRow(article.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-4 py-3 w-[40px]">
                      {(hoveredRow === article.id || selectionMode) ? (
                        <CustomCheckbox
                          checked={selectedIds.includes(article.id)}
                          onChange={() => toggleSelectId(article.id)}
                        />
                      ) : (
                        <div className="w-5 h-5" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {article.featured && (
                          <Star className="w-4 h-4 text-hh-warn fill-hh-warn flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-[14px] font-medium text-hh-text mb-0.5">
                            {article.title}
                          </p>
                          <p className="text-[12px] text-hh-muted line-clamp-1">
                            {article.excerpt}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getCategoryBadge(article.category)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(article.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-hh-muted" />
                        <span className="text-[13px] text-hh-text font-medium">
                          {article.views}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {article.views > 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="w-3.5 h-3.5 text-hh-success" />
                            <span className="text-[12px] text-hh-text font-medium">
                              {article.helpful}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ThumbsDown className="w-3.5 h-3.5 text-hh-error" />
                            <span className="text-[12px] text-hh-text font-medium">
                              {article.notHelpful}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12px] text-hh-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-hh-muted">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[12px]">{article.createdAt}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedArticle(article);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Bewerk
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {article.status === "Gepubliceerd" ? "Archiveer" : "Publiceer"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-hh-error">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Verwijder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredArticles.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-hh-muted mx-auto mb-4" />
              <p className="text-[16px] text-hh-muted">
                Geen artikelen gevonden met deze filters
              </p>
            </div>
          )}
        </Card>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nieuw Help Artikel</DialogTitle>
              <DialogDescription>
                Maak een nieuw help artikel of FAQ voor gebruikers
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Titel</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Bijv: Hoe start ik mijn eerste roleplay?"
                />
              </div>

              <div>
                <Label>Excerpt (kort overzicht)</Label>
                <Textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  placeholder="Korte samenvatting van dit artikel..."
                  className="min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categorie</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="getting-started">Aan de slag</SelectItem>
                      <SelectItem value="video-courses">Video Cursussen</SelectItem>
                      <SelectItem value="roleplay">Roleplay</SelectItem>
                      <SelectItem value="techniques">Technieken</SelectItem>
                      <SelectItem value="billing">Facturering</SelectItem>
                      <SelectItem value="troubleshooting">Probleemoplossing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Concept</SelectItem>
                      <SelectItem value="published">Gepubliceerd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Inhoud (Markdown supported)</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Schrijf de volledige inhoud van het artikel..."
                  className="min-h-[200px] font-mono text-[13px]"
                />
              </div>

              <div>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 rounded border-2 border-hh-border/40 focus:ring-2 focus:ring-hh-primary focus:ring-offset-0 cursor-pointer bg-transparent checked:bg-hh-primary checked:border-hh-primary"
                    style={{ color: 'var(--hh-primary)' }}
                  />
                  <Star className="w-4 h-4 text-hh-warn" />
                  Markeer als Featured Artikel
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuleer
              </Button>
              <Button
                onClick={handleCreate}
                className="bg-hh-error hover:bg-hh-error/90 text-white"
              >
                Create Article
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
