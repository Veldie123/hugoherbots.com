import { useState } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
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
  Video,
  File,
  Download,
  Eye,
  Edit2,
  Trash2,
  MoreVertical,
  List,
  LayoutGrid,
  TrendingUp,
  Calendar,
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

interface AdminResourceLibraryProps {
  navigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

export function AdminResourceLibrary({ navigate, isSuperAdmin }: AdminResourceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<any>(null);
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
    description: "",
    category: "methodology",
    type: "pdf",
    fileUrl: "",
    fileSize: "",
    featured: false,
  });

  const resources = [
    {
      id: "1",
      title: "EPIC Sales Methodologie - Complete Guide",
      description: "Volledige handleiding voor het EPIC sales framework met alle 25 technieken",
      category: "Methodologie",
      type: "PDF",
      fileSize: "2,4 MB",
      downloads: 156,
      featured: true,
      createdAt: "2025-01-10",
      author: "Hugo Herbots",
    },
    {
      id: "2",
      title: "Ontdekkingsfase Templates",
      description: "Ready-to-use templates voor discovery gesprekken en vragenlijsten",
      category: "Templates",
      type: "Document",
      fileSize: "1,2 MB",
      downloads: 98,
      featured: false,
      createdAt: "2025-01-08",
      author: "Admin Team",
    },
    {
      id: "3",
      title: "Bezwaarhandeling Masterclass",
      description: "Video training voor effectieve bezwaarhandeling in de afsluitingsfase",
      category: "Video's",
      type: "Video",
      fileSize: "124,5 MB",
      downloads: 234,
      featured: true,
      createdAt: "2025-01-05",
      author: "Hugo Herbots",
    },
    {
      id: "4",
      title: "Sales Call Checklist",
      description: "Pre-call en post-call checklists voor optimale voorbereiding",
      category: "Tools",
      type: "Spreadsheet",
      fileSize: "0,8 MB",
      downloads: 187,
      featured: false,
      createdAt: "2025-01-03",
      author: "Admin Team",
    },
    {
      id: "5",
      title: "SPIN Questioning Guide",
      description: "Praktische gids voor SPIN vragen in discovery fase",
      category: "Technieken",
      type: "PDF",
      fileSize: "1,6 MB",
      downloads: 142,
      featured: false,
      createdAt: "2024-12-28",
      author: "Hugo Herbots",
    },
  ];

  const stats = {
    totalResources: 48,
    totalDownloads: 1842,
    featuredResources: 8,
    newThisMonth: 6,
  };

  const filteredResources = resources.filter((resource) => {
    if (searchQuery && !resource.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterCategory !== "all" && resource.category !== filterCategory) {
      return false;
    }
    if (filterType !== "all" && resource.type !== filterType) {
      return false;
    }
    return true;
  });

  const getCategoryBadge = (category: string) => {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[11px]">
        {category}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Video":
        return <Video className="w-4 h-4 text-hh-muted" />;
      case "PDF":
        return <FileText className="w-4 h-4 text-hh-muted" />;
      case "Spreadsheet":
        return <File className="w-4 h-4 text-hh-muted" />;
      case "Document":
        return <FileText className="w-4 h-4 text-hh-muted" />;
      default:
        return <File className="w-4 h-4 text-hh-muted" />;
    }
  };

  const handleCreate = () => {
    console.log("Create resource:", formData);
    setCreateDialogOpen(false);
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

  const handleEdit = () => {
    console.log("Edit resource:", selectedResource);
    setEditDialogOpen(false);
  };

  return (
    <AdminLayout isSuperAdmin={isSuperAdmin} currentPage="admin-resources" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Resource Library
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Beheer trainingsmateriaal, templates en tools voor gebruikers
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-hh-error hover:bg-hh-error/90 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Resource
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                <FileText className="w-5 h-5" style={{ color: '#9333ea' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5"
                style={{ backgroundColor: 'rgba(18, 185, 129, 0.1)', color: '#12B981', borderColor: 'rgba(18, 185, 129, 0.2)' }}
              >
                +12%
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Totaal Resources</p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {stats.totalResources}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)' }}>
                <Download className="w-5 h-5" style={{ color: '#059669' }} />
              </div>
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5"
                style={{ backgroundColor: 'rgba(18, 185, 129, 0.1)', color: '#12B981', borderColor: 'rgba(18, 185, 129, 0.2)' }}
              >
                +34%
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Totaal Downloads</p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {stats.totalDownloads}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-hh-warn" />
              </div>
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.2)' }}
              >
                Featured
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Featured Resources</p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {stats.featuredResources}
            </p>
          </Card>

          <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-hh-ocean-blue/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-hh-ocean-blue" />
              </div>
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5"
                style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', borderColor: 'rgba(37, 99, 235, 0.2)' }}
              >
                Deze maand
              </Badge>
            </div>
            <p className="text-[13px] text-hh-muted mb-2">Nieuw Deze Maand</p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {stats.newThisMonth}
            </p>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek resources op titel, beschrijving..."
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
                <SelectItem value="Methodologie">Methodologie</SelectItem>
                <SelectItem value="Technieken">Technieken</SelectItem>
                <SelectItem value="Templates">Templates</SelectItem>
                <SelectItem value="Video's">Video's</SelectItem>
                <SelectItem value="Tools">Tools</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Types</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="Video">Video</SelectItem>
                <SelectItem value="Document">Document</SelectItem>
                <SelectItem value="Spreadsheet">Spreadsheet</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden sm:flex gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                style={viewMode === "list" ? { backgroundColor: '#9333ea' } : {}}
                className={viewMode === "list" ? "hover:opacity-90 text-white" : ""}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                style={viewMode === "grid" ? { backgroundColor: '#9333ea' } : {}}
                className={viewMode === "grid" ? "hover:opacity-90 text-white" : ""}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Resources Table */}
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50 border-b border-hh-border">
                <tr>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted w-[40px]"></th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Titel & Beschrijving
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Categorie
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Downloads
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
                {filteredResources.map((resource, index) => (
                  <tr
                    key={resource.id}
                    className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50/50 transition-colors ${
                      index % 2 === 0 ? "bg-card" : "bg-hh-ui-50/30"
                    }`}
                    onMouseEnter={() => setHoveredRow(resource.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-4 py-3 w-[40px]">
                      {(hoveredRow === resource.id || selectionMode) ? (
                        <CustomCheckbox
                          checked={selectedIds.includes(resource.id)}
                          onChange={() => toggleSelectId(resource.id)}
                        />
                      ) : (
                        <div className="w-5 h-5" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {resource.featured && (
                          <Star className="w-4 h-4 text-hh-warn fill-hh-warn flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-[14px] font-medium text-hh-text mb-0.5">
                            {resource.title}
                          </p>
                          <p className="text-[12px] text-hh-muted line-clamp-1">
                            {resource.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getCategoryBadge(resource.category)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(resource.type)}
                        <div>
                          <p className="text-[13px] text-hh-text">{resource.type}</p>
                          <p className="text-[12px] text-hh-muted">{resource.fileSize}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5 text-hh-muted" />
                        <span className="text-[13px] text-hh-text font-medium">
                          {resource.downloads}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-hh-muted">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[12px]">{resource.createdAt}</span>
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
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedResource(resource);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Bewerk
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

          {filteredResources.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-hh-muted mx-auto mb-4" />
              <p className="text-[16px] text-hh-muted">
                Geen resources gevonden met deze filters
              </p>
            </div>
          )}
        </Card>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nieuwe Resource Toevoegen</DialogTitle>
              <DialogDescription>
                Upload trainingsmateriaal, templates of tools voor gebruikers
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Titel</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Bijv: EPIC Sales Methodologie Guide"
                />
              </div>

              <div>
                <Label>Beschrijving</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Korte beschrijving van de resource..."
                  className="min-h-[80px]"
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
                      <SelectItem value="methodology">Methodologie</SelectItem>
                      <SelectItem value="techniques">Technieken</SelectItem>
                      <SelectItem value="templates">Templates</SelectItem>
                      <SelectItem value="videos">Video's</SelectItem>
                      <SelectItem value="tools">Tools</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>File URL</Label>
                <Input
                  value={formData.fileUrl}
                  onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 rounded border-2 border-hh-border/40 cursor-pointer bg-transparent focus:ring-2 focus:ring-offset-0"
                    style={{
                      accentColor: '#9333ea'
                    }}
                  />
                  <Star className="w-4 h-4 text-hh-warn" />
                  Markeer als Featured Resource
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
                Create Resource
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
