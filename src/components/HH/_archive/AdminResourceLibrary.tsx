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
  Download,
  FileText,
  Video,
  File,
  Calendar,
  Star,
  MoreVertical,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface AdminResourceLibraryProps {
  navigate?: (page: string) => void;
}

type ResourceCategory = "methodology" | "techniques" | "templates" | "videos" | "tools" | "guides";
type ResourceType = "pdf" | "video" | "spreadsheet" | "document" | "presentation";

interface Resource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  type: ResourceType;
  fileUrl: string;
  fileSize: string;
  downloads: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  author: string;
}

export function AdminResourceLibrary({ navigate }: AdminResourceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<ResourceCategory | "all">("all");
  const [filterType, setFilterType] = useState<ResourceType | "all">("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "methodology" as ResourceCategory,
    type: "pdf" as ResourceType,
    fileUrl: "",
    fileSize: "",
    featured: false,
  });

  // Mock data
  const resources: Resource[] = [
    {
      id: "1",
      title: "EPIC Sales Framework - Complete Methodologie",
      description: "Volledige uitleg van de 4 fasen en 25 technieken in een praktische PDF handleiding.",
      category: "methodology",
      type: "pdf",
      fileUrl: "/resources/epic-framework.pdf",
      fileSize: "2.4 MB",
      downloads: 1847,
      featured: true,
      createdAt: "2024-01-10",
      updatedAt: "2024-03-01",
      author: "Hugo Herbots",
    },
    {
      id: "2",
      title: "25 Technieken Cheat Sheet",
      description: "Overzicht van alle 25 EPIC technieken op één pagina, perfect voor printen.",
      category: "techniques",
      type: "pdf",
      fileUrl: "/resources/techniques-cheatsheet.pdf",
      fileSize: "856 KB",
      downloads: 2341,
      featured: true,
      createdAt: "2024-01-15",
      updatedAt: "2024-02-28",
      author: "Hugo Herbots",
    },
    {
      id: "3",
      title: "Call Voorbereiding Template",
      description: "Excel template voor het voorbereiden van je sales calls met voorbeelden.",
      category: "templates",
      type: "spreadsheet",
      fileUrl: "/resources/call-prep-template.xlsx",
      fileSize: "124 KB",
      downloads: 982,
      featured: false,
      createdAt: "2024-01-20",
      updatedAt: "2024-02-15",
      author: "Jan de Vries",
    },
    {
      id: "4",
      title: "Hugo's Masterclass: Bezwaren behandelen",
      description: "60 minuten video training over effectief omgaan met bezwaren in fase 4.",
      category: "videos",
      type: "video",
      fileUrl: "/resources/masterclass-bezwaren.mp4",
      fileSize: "1.2 GB",
      downloads: 534,
      featured: false,
      createdAt: "2024-02-01",
      updatedAt: "2024-02-20",
      author: "Hugo Herbots",
    },
    {
      id: "5",
      title: "Discovery Questions Database",
      description: "100+ discovery vragen georganiseerd per industrie en use case.",
      category: "tools",
      type: "spreadsheet",
      fileUrl: "/resources/discovery-questions.xlsx",
      fileSize: "245 KB",
      downloads: 1523,
      featured: true,
      createdAt: "2024-02-10",
      updatedAt: "2024-03-05",
      author: "Sarah van Dijk",
    },
    {
      id: "6",
      title: "Sales Call Scorecard",
      description: "Beoordeel je eigen calls met deze praktische scorecard gebaseerd op EPIC.",
      category: "templates",
      type: "pdf",
      fileUrl: "/resources/call-scorecard.pdf",
      fileSize: "678 KB",
      downloads: 756,
      featured: false,
      createdAt: "2024-02-15",
      updatedAt: "2024-02-28",
      author: "Mark Peters",
    },
  ];

  const categoryLabels: Record<ResourceCategory, string> = {
    methodology: "Methodologie",
    techniques: "Technieken",
    templates: "Templates",
    videos: "Video's",
    tools: "Tools",
    guides: "Handleidingen",
  };

  const typeLabels: Record<ResourceType, string> = {
    pdf: "PDF",
    video: "Video",
    spreadsheet: "Spreadsheet",
    document: "Document",
    presentation: "Presentatie",
  };

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || resource.category === filterCategory;
    const matchesType = filterType === "all" || resource.type === filterType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const handleCreateResource = () => {
    console.log("Create resource:", formData);
    setCreateDialogOpen(false);
    // Reset form
    setFormData({
      title: "",
      description: "",
      category: "methodology",
      type: "pdf",
      fileUrl: "",
      fileSize: "",
      featured: false,
    });
  };

  const handleEditResource = () => {
    console.log("Edit resource:", selectedResource?.id, formData);
    setEditDialogOpen(false);
    setSelectedResource(null);
  };

  const handleDeleteResource = (id: string) => {
    if (confirm("Weet je zeker dat je deze resource wilt verwijderen?")) {
      console.log("Delete resource:", id);
    }
  };

  const openEditDialog = (resource: Resource) => {
    setSelectedResource(resource);
    setFormData({
      title: resource.title,
      description: resource.description,
      category: resource.category,
      type: resource.type,
      fileUrl: resource.fileUrl,
      fileSize: resource.fileSize,
      featured: resource.featured,
    });
    setEditDialogOpen(true);
  };

  const getTypeIcon = (type: ResourceType) => {
    switch (type) {
      case "pdf":
        return FileText;
      case "video":
        return Video;
      case "spreadsheet":
      case "document":
      case "presentation":
        return File;
      default:
        return File;
    }
  };

  const stats = {
    total: resources.length,
    featured: resources.filter((r) => r.featured).length,
    totalDownloads: resources.reduce((sum, r) => sum + r.downloads, 0),
    avgDownloads: Math.round(
      resources.reduce((sum, r) => sum + r.downloads, 0) / resources.length
    ),
  };

  return (
    <AdminLayout currentPage="admin-resources" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Resource Library Beheer
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer downloads, templates, video's en tools
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="gap-2 bg-hh-primary hover:bg-hh-primary/90"
          >
            <Plus className="w-5 h-5" />
            Nieuwe resource
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                  Totaal resources
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
                  Featured
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {stats.featured}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <Star className="w-6 h-6 text-hh-warn" />
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                  Totaal downloads
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {stats.totalDownloads.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-hh-success/10 flex items-center justify-center">
                <Download className="w-6 h-6 text-hh-success" />
              </div>
            </div>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
                  Gem. downloads
                </p>
                <p className="text-[32px] leading-[40px] text-hh-text">
                  {stats.avgDownloads.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center">
                <Download className="w-6 h-6 text-blue-600" />
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
                placeholder="Zoek resources..."
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
                <SelectItem value="methodology">Methodologie</SelectItem>
                <SelectItem value="techniques">Technieken</SelectItem>
                <SelectItem value="templates">Templates</SelectItem>
                <SelectItem value="videos">Video's</SelectItem>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="guides">Handleidingen</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={(value) => setFilterType(value as any)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="presentation">Presentatie</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource) => {
            const TypeIcon = getTypeIcon(resource.type);
            return (
              <Card
                key={resource.id}
                className="p-5 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-hh-primary/10 flex items-center justify-center">
                    <TypeIcon className="w-6 h-6 text-hh-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    {resource.featured && (
                      <Star className="w-5 h-5 text-hh-warn fill-hh-warn" />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(resource)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Bewerken
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="w-4 h-4 mr-2" />
                          Downloaden
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteResource(resource.id)}
                          className="text-hh-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <h3 className="text-[18px] leading-[26px] text-hh-text font-semibold mb-2">
                  {resource.title}
                </h3>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-4">
                  {resource.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline">{categoryLabels[resource.category]}</Badge>
                  <Badge variant="secondary">{typeLabels[resource.type]}</Badge>
                </div>

                <div className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                  <div className="flex items-center justify-between">
                    <span>Downloads</span>
                    <span className="text-hh-text font-medium">
                      {resource.downloads.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bestandsgrootte</span>
                    <span className="text-hh-text font-medium">{resource.fileSize}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Laatst bijgewerkt</span>
                    <span className="text-hh-text font-medium">
                      {new Date(resource.updatedAt).toLocaleDateString("nl-NL")}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditDialogOpen(false);
            setSelectedResource(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editDialogOpen ? "Resource bewerken" : "Nieuwe resource"}
            </DialogTitle>
            <DialogDescription>
              {editDialogOpen
                ? "Pas de resource aan en sla de wijzigingen op."
                : "Voeg een nieuwe resource toe aan de bibliotheek."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Bijv. EPIC Sales Framework - Complete Methodologie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschrijving *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Beschrijf wat de resource bevat en voor wie het nuttig is..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categorie *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value as ResourceCategory })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="methodology">Methodologie</SelectItem>
                    <SelectItem value="techniques">Technieken</SelectItem>
                    <SelectItem value="templates">Templates</SelectItem>
                    <SelectItem value="videos">Video's</SelectItem>
                    <SelectItem value="tools">Tools</SelectItem>
                    <SelectItem value="guides">Handleidingen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as ResourceType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="presentation">Presentatie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileUrl">Bestand *</Label>
              <div className="flex gap-2">
                <Input
                  id="fileUrl"
                  value={formData.fileUrl}
                  onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                  placeholder="URL of upload bestand..."
                  className="flex-1"
                />
                <Button variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Upload
                </Button>
              </div>
              <p className="text-[12px] leading-[16px] text-hh-muted">
                Upload een bestand of voer een URL in naar het bestand
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileSize">Bestandsgrootte</Label>
              <Input
                id="fileSize"
                value={formData.fileSize}
                onChange={(e) => setFormData({ ...formData, fileSize: e.target.value })}
                placeholder="Bijv. 2.4 MB"
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
                Toon als featured resource
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditDialogOpen(false);
                setSelectedResource(null);
              }}
            >
              Annuleren
            </Button>
            <Button onClick={editDialogOpen ? handleEditResource : handleCreateResource}>
              {editDialogOpen ? "Opslaan" : "Resource toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
