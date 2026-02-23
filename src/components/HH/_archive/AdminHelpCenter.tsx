import { useState } from "react";
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
  DialogFooter,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  FileText,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface AdminHelpCenterProps {
  navigate?: (page: string) => void;
}

type ArticleCategory = "getting-started" | "video-courses" | "roleplay" | "techniques" | "billing" | "troubleshooting";
type ArticleStatus = "published" | "draft" | "archived";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  content: string;
  excerpt: string;
  status: ArticleStatus;
  author: string;
  views: number;
  helpful: number;
  notHelpful: number;
  createdAt: string;
  updatedAt: string;
  featured: boolean;
}

export function AdminHelpCenter({ navigate }: AdminHelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<ArticleCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ArticleStatus | "all">("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    category: "getting-started" as ArticleCategory,
    content: "",
    excerpt: "",
    status: "draft" as ArticleStatus,
    featured: false,
  });

  // Mock data
  const articles: Article[] = [
    {
      id: "1",
      title: "Hoe start ik mijn eerste role-play sessie?",
      slug: "start-eerste-roleplay",
      category: "getting-started",
      content: "Volledige artikel content hier...",
      excerpt: "Stap-voor-stap uitleg om je eerste role-play sessie te starten.",
      status: "published",
      author: "Hugo Herbots",
      views: 1247,
      helpful: 98,
      notHelpful: 4,
      createdAt: "2024-01-15",
      updatedAt: "2024-03-10",
      featured: true,
    },
    {
      id: "2",
      title: "Begrip van de 4 EPIC fasen",
      slug: "epic-fasen-uitleg",
      category: "techniques",
      content: "Volledige artikel content hier...",
      excerpt: "Diepgaande uitleg van de 4 fasen: Voorbereiding, Ontdekking, Voorstel, Afsluiting.",
      status: "published",
      author: "Hugo Herbots",
      views: 892,
      helpful: 76,
      notHelpful: 2,
      createdAt: "2024-01-20",
      updatedAt: "2024-03-08",
      featured: true,
    },
    {
      id: "3",
      title: "Video cursus navigatie en voortgang",
      slug: "video-cursus-navigatie",
      category: "video-courses",
      content: "Volledige artikel content hier...",
      excerpt: "Leer hoe je door de video cursussen navigeert en je voortgang bijhoudt.",
      status: "published",
      author: "Jan de Vries",
      views: 543,
      helpful: 45,
      notHelpful: 3,
      createdAt: "2024-02-01",
      updatedAt: "2024-03-05",
      featured: false,
    },
    {
      id: "4",
      title: "Custom scenario's bouwen (CONCEPT)",
      slug: "custom-scenarios-bouwen",
      category: "roleplay",
      content: "Volledige artikel content hier...",
      excerpt: "Maak je eigen scenario's met de scenario builder tool.",
      status: "draft",
      author: "Sarah van Dijk",
      views: 0,
      helpful: 0,
      notHelpful: 0,
      createdAt: "2024-03-12",
      updatedAt: "2024-03-12",
      featured: false,
    },
    {
      id: "5",
      title: "Facturatie en betalingen",
      slug: "facturatie-betalingen",
      category: "billing",
      content: "Volledige artikel content hier...",
      excerpt: "Alles over je abonnement, facturen en betalingsmethodes.",
      status: "published",
      author: "Mark Peters",
      views: 312,
      helpful: 28,
      notHelpful: 1,
      createdAt: "2024-02-10",
      updatedAt: "2024-03-01",
      featured: false,
    },
  ];

  const categoryLabels: Record<ArticleCategory, string> = {
    "getting-started": "Aan de slag",
    "video-courses": "Video cursussen",
    roleplay: "Role-play",
    techniques: "Technieken",
    billing: "Facturatie",
    troubleshooting: "Problemen oplossen",
  };

  const statusLabels: Record<ArticleStatus, string> = {
    published: "Gepubliceerd",
    draft: "Concept",
    archived: "Gearchiveerd",
  };

  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || article.category === filterCategory;
    const matchesStatus = filterStatus === "all" || article.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleCreateArticle = () => {
    console.log("Create article:", formData);
    setCreateDialogOpen(false);
    // Reset form
    setFormData({
      title: "",
      slug: "",
      category: "getting-started",
      content: "",
      excerpt: "",
      status: "draft",
      featured: false,
    });
  };

  const handleEditArticle = () => {
    console.log("Edit article:", selectedArticle?.id, formData);
    setEditDialogOpen(false);
    setSelectedArticle(null);
  };

  const handleDeleteArticle = (id: string) => {
    if (confirm("Weet je zeker dat je dit artikel wilt verwijderen?")) {
      console.log("Delete article:", id);
    }
  };

  const openEditDialog = (article: Article) => {
    setSelectedArticle(article);
    setFormData({
      title: article.title,
      slug: article.slug,
      category: article.category,
      content: article.content,
      excerpt: article.excerpt,
      status: article.status,
      featured: article.featured,
    });
    setEditDialogOpen(true);
  };

  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === "published").length,
    drafts: articles.filter((a) => a.status === "draft").length,
    totalViews: articles.reduce((sum, a) => sum + a.views, 0),
  };

  return (
    <AdminLayout currentPage="admin-help" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Help Center Beheer
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer help artikelen en kennisbank content
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="gap-2 bg-hh-primary hover:bg-hh-primary/90"
          >
            <Plus className="w-5 h-5" />
            Nieuw artikel
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                  Totaal artikelen
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {stats.total}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-hh-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                  Gepubliceerd
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {stats.published}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-hh-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-hh-success" />
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                  Concepten
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {stats.drafts}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <Edit2 className="w-6 h-6 text-hh-warn" />
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                  Totaal views
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {stats.totalViews.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hh-muted" />
              <Input
                placeholder="Zoek artikelen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={(value) => setFilterCategory(value as any)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                <SelectItem value="getting-started">Aan de slag</SelectItem>
                <SelectItem value="video-courses">Video cursussen</SelectItem>
                <SelectItem value="roleplay">Role-play</SelectItem>
                <SelectItem value="techniques">Technieken</SelectItem>
                <SelectItem value="billing">Facturatie</SelectItem>
                <SelectItem value="troubleshooting">Problemen oplossen</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="published">Gepubliceerd</SelectItem>
                <SelectItem value="draft">Concept</SelectItem>
                <SelectItem value="archived">Gearchiveerd</SelectItem>
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
                  <th className="text-left py-4 px-6 text-[14px] leading-[20px] text-hh-muted">
                    Artikel
                  </th>
                  <th className="text-left py-4 px-6 text-[14px] leading-[20px] text-hh-muted">
                    Categorie
                  </th>
                  <th className="text-left py-4 px-6 text-[14px] leading-[20px] text-hh-muted">
                    Status
                  </th>
                  <th className="text-left py-4 px-6 text-[14px] leading-[20px] text-hh-muted">
                    Auteur
                  </th>
                  <th className="text-left py-4 px-6 text-[14px] leading-[20px] text-hh-muted">
                    Statistieken
                  </th>
                  <th className="text-left py-4 px-6 text-[14px] leading-[20px] text-hh-muted">
                    Laatst bijgewerkt
                  </th>
                  <th className="text-right py-4 px-6 text-[14px] leading-[20px] text-hh-muted">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map((article) => (
                  <tr key={article.id} className="border-b border-hh-border hover:bg-hh-ui-50/50">
                    <td className="py-4 px-6">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[16px] leading-[24px] text-hh-text font-medium">
                              {article.title}
                            </p>
                            {article.featured && (
                              <Badge variant="secondary" className="text-[12px]">
                                Featured
                              </Badge>
                            )}
                          </div>
                          <p className="text-[14px] leading-[20px] text-hh-muted mt-1">
                            {article.excerpt}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant="outline">
                        {categoryLabels[article.category]}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        variant={
                          article.status === "published"
                            ? "default"
                            : article.status === "draft"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {statusLabels[article.status]}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-hh-muted" />
                        <span className="text-[14px] leading-[20px] text-hh-muted">
                          {article.author}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[14px] leading-[20px]">
                          <Eye className="w-4 h-4 text-hh-muted" />
                          <span className="text-hh-text">{article.views}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[12px] leading-[16px]">
                          <span className="text-hh-success flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {article.helpful}
                          </span>
                          <span className="text-hh-destructive flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            {article.notHelpful}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-[14px] leading-[20px] text-hh-muted">
                        <Calendar className="w-4 h-4" />
                        {new Date(article.updatedAt).toLocaleDateString("nl-NL")}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(article)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Bewerken
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            {article.status === "published" ? (
                              <>
                                <EyeOff className="w-4 h-4 mr-2" />
                                Unpublish
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4 mr-2" />
                                Publiceren
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteArticle(article.id)}
                            className="text-hh-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
          setSelectedArticle(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editDialogOpen ? "Artikel bewerken" : "Nieuw artikel"}
            </DialogTitle>
            <DialogDescription>
              {editDialogOpen
                ? "Pas het artikel aan en sla de wijzigingen op."
                : "Maak een nieuw help center artikel."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Bijv. Hoe start ik mijn eerste role-play?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="bijv-hoe-start-ik-eerste-roleplay"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categorie *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value as ArticleCategory })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="getting-started">Aan de slag</SelectItem>
                    <SelectItem value="video-courses">Video cursussen</SelectItem>
                    <SelectItem value="roleplay">Role-play</SelectItem>
                    <SelectItem value="techniques">Technieken</SelectItem>
                    <SelectItem value="billing">Facturatie</SelectItem>
                    <SelectItem value="troubleshooting">Problemen oplossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as ArticleStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Concept</SelectItem>
                    <SelectItem value="published">Gepubliceerd</SelectItem>
                    <SelectItem value="archived">Gearchiveerd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Samenvatting *</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                placeholder="Korte beschrijving die in zoekresultaten verschijnt..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Inhoud *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Volledige artikel inhoud (ondersteunt Markdown)..."
                rows={12}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="featured"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 rounded border-hh-border"
              />
              <Label htmlFor="featured" className="cursor-pointer">
                Toon als featured artikel
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditDialogOpen(false);
                setSelectedArticle(null);
              }}
            >
              Annuleren
            </Button>
            <Button onClick={editDialogOpen ? handleEditArticle : handleCreateArticle}>
              {editDialogOpen ? "Opslaan" : "Artikel aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
