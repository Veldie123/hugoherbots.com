import {
  Library,
  Search,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Video,
  Target,
  Radio,
  FileText,
  Image as ImageIcon,
  Play,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";

interface AdminContentLibraryProps {
  navigate?: (page: string) => void;
}

export function AdminContentLibrary({ navigate }: AdminContentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const allContent = [
    {
      id: 1,
      type: "video",
      title: "SPIN Questioning Technique",
      fase: "Ontdekkingsfase",
      status: "Gepubliceerd",
      views: 847,
      engagement: 92,
      uploadDate: "12 jan 2025",
      icon: Video,
      color: "purple",
    },
    {
      id: 2,
      type: "scenario",
      title: "SaaS Discovery Call",
      fase: "Ontdekkingsfase",
      status: "Gepubliceerd",
      views: 423,
      engagement: 88,
      uploadDate: "10 jan 2025",
      icon: Target,
      color: "blue",
    },
    {
      id: 3,
      type: "live",
      title: "Objection Handling Q&A",
      fase: "Beslissingsfase",
      status: "Afgelopen",
      views: 234,
      engagement: 78,
      uploadDate: "8 jan 2025",
      icon: Radio,
      color: "red",
    },
    {
      id: 4,
      type: "video",
      title: "E.P.I.C Framework Deep Dive",
      fase: "Ontdekkingsfase",
      status: "Gepubliceerd",
      views: 389,
      engagement: 85,
      uploadDate: "7 jan 2025",
      icon: Video,
      color: "purple",
    },
    {
      id: 5,
      type: "document",
      title: "SPIN Vragenlijst Template",
      fase: "Ontdekkingsfase",
      status: "Gepubliceerd",
      views: 512,
      engagement: 94,
      uploadDate: "5 jan 2025",
      icon: FileText,
      color: "green",
    },
    {
      id: 6,
      type: "scenario",
      title: "Cold Calling Roleplay",
      fase: "Openingsfase",
      status: "Gepubliceerd",
      views: 198,
      engagement: 82,
      uploadDate: "3 jan 2025",
      icon: Target,
      color: "blue",
    },
  ];

  const stats = [
    { label: "Total Content", value: allContent.length, icon: Library },
    { label: "Video's", value: allContent.filter((c) => c.type === "video").length, icon: Video },
    { label: "Scenario's", value: allContent.filter((c) => c.type === "scenario").length, icon: Target },
    { label: "Live Sessies", value: allContent.filter((c) => c.type === "live").length, icon: Radio },
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "video":
        return "bg-purple-600/10 text-purple-600";
      case "scenario":
        return "bg-blue-600/10 text-blue-600";
      case "live":
        return "bg-red-600/10 text-red-600";
      case "document":
        return "bg-green-600/10 text-green-600";
      default:
        return "bg-hh-muted/10 text-hh-muted";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "video":
        return "Video";
      case "scenario":
        return "Scenario";
      case "live":
        return "Live";
      case "document":
        return "Document";
      default:
        return type;
    }
  };

  const filteredContent = allContent.filter((content) => {
    if (activeTab !== "all" && content.type !== activeTab) return false;
    return true;
  });

  return (
    <AdminLayout currentPage="admin-content" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Content Library
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Unified overzicht van alle content types
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="p-4 rounded-[16px] shadow-hh-sm border-hh-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[13px] leading-[18px] text-hh-muted">
                      {stat.label}
                    </p>
                    <p className="text-[24px] leading-[32px] text-hh-text font-semibold">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek content..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Types</SelectItem>
                <SelectItem value="video">Video's</SelectItem>
                <SelectItem value="scenario">Scenario's</SelectItem>
                <SelectItem value="live">Live Sessies</SelectItem>
                <SelectItem value="document">Documenten</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="all">Alle ({allContent.length})</TabsTrigger>
            <TabsTrigger value="video">
              Video's ({allContent.filter((c) => c.type === "video").length})
            </TabsTrigger>
            <TabsTrigger value="scenario">
              Scenario's ({allContent.filter((c) => c.type === "scenario").length})
            </TabsTrigger>
            <TabsTrigger value="live">
              Live ({allContent.filter((c) => c.type === "live").length})
            </TabsTrigger>
            <TabsTrigger value="document">
              Docs ({allContent.filter((c) => c.type === "document").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {/* Content Table */}
            <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-hh-ui-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                        <input type="checkbox" className="rounded" />
                      </th>
                      <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                        Titel
                      </th>
                      <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                        Fase
                      </th>
                      <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                        Views
                      </th>
                      <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                        Engagement
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
                    {filteredContent.map((content) => {
                      const Icon = content.icon;
                      return (
                        <tr
                          key={content.id}
                          className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <input type="checkbox" className="rounded" />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg ${getTypeColor(content.type)} flex items-center justify-center`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <Badge variant="outline" className="text-[11px]">
                                {getTypeLabel(content.type)}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                              {content.title}
                            </p>
                            <p className="text-[12px] leading-[16px] text-hh-muted">
                              {content.uploadDate}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px]">
                              {content.fase}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right text-[14px] leading-[20px] text-hh-text">
                            {content.views}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-[14px] leading-[20px] text-hh-success flex items-center justify-end gap-1">
                              {content.engagement}%
                              <TrendingUp className="w-3.5 h-3.5" />
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              className={`text-[11px] ${
                                content.status === "Gepubliceerd"
                                  ? "bg-hh-success/10 text-hh-success border-hh-success/20"
                                  : "bg-hh-muted/10 text-hh-muted border-hh-muted/20"
                              }`}
                            >
                              {content.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Play className="w-4 h-4 mr-2" />
                                  Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-hh-border flex items-center justify-between">
                <p className="text-[13px] leading-[18px] text-hh-muted">
                  Toont 1-{filteredContent.length} van {filteredContent.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    Vorige
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Volgende
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
