import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Search, BookOpen, MessageCircle, Video, FileText, ExternalLink, HelpCircle } from "lucide-react";

interface HelpCenterProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
  onboardingMode?: boolean;
}

export function HelpCenter({ navigate, isAdmin, onboardingMode }: HelpCenterProps) {
  const categories = [
    {
      icon: BookOpen,
      title: "Aan de slag",
      description: "Leer de basis van Hugo's platform",
      articles: 12,
      color: "bg-hh-primary/10 text-hh-primary",
    },
    {
      icon: Video,
      title: "Video cursussen",
      description: "Begrijp de EPIC methodologie",
      articles: 25,
      color: "bg-hh-accent/10 text-hh-accent",
    },
    {
      icon: MessageCircle,
      title: "Role-play sessies",
      description: "Tips voor effectieve training",
      articles: 18,
      color: "bg-hh-success/10 text-hh-success",
    },
    {
      icon: FileText,
      title: "Techniek handleidingen",
      description: "Diepgaande uitleg per techniek",
      articles: 25,
      color: "bg-hh-warn/10 text-hh-warn",
    },
  ];

  const popularArticles = [
    {
      title: "Hoe start ik mijn eerste role-play sessie?",
      category: "Aan de slag",
      readTime: "5 min",
    },
    {
      title: "Wat is de EPIC methodologie?",
      category: "Methodologie",
      readTime: "8 min",
    },
    {
      title: "Hoe interpreteer ik mijn score?",
      category: "Analytics",
      readTime: "6 min",
    },
    {
      title: "Tips voor effectief oefenen",
      category: "Best practices",
      readTime: "10 min",
    },
    {
      title: "Hoe nodig ik teamleden uit?",
      category: "Team",
      readTime: "4 min",
    },
    {
      title: "Techniek 2.1.2: Open vragen stellen",
      category: "Technieken",
      readTime: "12 min",
    },
  ];

  return (
    <AppLayout
      currentPage="help"
      navigate={navigate}
      isAdmin={isAdmin}
      onboardingMode={onboardingMode}
    >
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Search */}
        <Card className="p-8 rounded-[16px] shadow-hh-sm border-hh-border bg-gradient-to-br from-hh-primary/5 to-transparent">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-hh-primary/10 flex items-center justify-center mx-auto">
              <HelpCircle className="w-8 h-8 text-hh-primary" />
            </div>
            <div>
              <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
                Hoe kunnen we je helpen?
              </h1>
              <p className="text-[16px] leading-[24px] text-hh-muted">
                Zoek in onze kennisbank of browse door categorieën
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-hh-muted" />
              <Input
                type="text"
                placeholder="Zoek naar artikelen, guides, video's..."
                className="pl-12 h-14 text-[16px] rounded-xl"
              />
            </div>
          </div>
        </Card>

        {/* Categories */}
        <div>
          <h2 className="text-[24px] leading-[32px] text-hh-text mb-6">
            Browse categorieën
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category, idx) => (
              <Card
                key={idx}
                className="p-6 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center mb-4`}>
                  <category.icon className="w-6 h-6" />
                </div>
                <h3 className="text-[20px] leading-[28px] text-hh-text mb-2 group-hover:text-hh-primary transition-colors">
                  {category.title}
                </h3>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-3">
                  {category.description}
                </p>
                <p className="text-[14px] leading-[20px] text-hh-primary">
                  {category.articles} artikelen →
                </p>
              </Card>
            ))}
          </div>
        </div>

        {/* Popular Articles */}
        <div>
          <h2 className="text-[24px] leading-[32px] text-hh-text mb-6">
            Populaire artikelen
          </h2>
          <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border divide-y divide-hh-border">
            {popularArticles.map((article, idx) => (
              <div
                key={idx}
                className="py-4 first:pt-0 last:pb-0 flex items-center gap-4 hover:bg-hh-ui-50 -mx-6 px-6 transition-colors cursor-pointer group"
              >
                <FileText className="w-5 h-5 text-hh-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] leading-[24px] text-hh-text group-hover:text-hh-primary transition-colors truncate">
                    {article.title}
                  </h3>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    {article.category} • {article.readTime} leestijd
                  </p>
                </div>
                <ExternalLink className="w-5 h-5 text-hh-muted group-hover:text-hh-primary transition-colors flex-shrink-0" />
              </div>
            ))}
          </Card>
        </div>

        {/* Contact Support */}
        <Card className="p-8 rounded-[16px] shadow-hh-sm border-hh-primary/20 bg-hh-primary/5">
          <div className="text-center max-w-xl mx-auto">
            <MessageCircle className="w-12 h-12 text-hh-primary mx-auto mb-4" />
            <h3 className="text-[24px] leading-[32px] text-hh-text mb-2">
              Kan je het antwoord niet vinden?
            </h3>
            <p className="text-[16px] leading-[24px] text-hh-muted mb-6">
              Neem contact op met ons support team — we helpen je graag verder.
            </p>
            <div className="flex gap-4 justify-center">
              <button className="px-6 py-3 rounded-xl bg-hh-primary text-white hover:bg-hh-primary/90 transition-colors">
                Contact support
              </button>
              <button className="px-6 py-3 rounded-xl border-2 border-hh-border hover:bg-hh-ui-50 transition-colors">
                Email ons
              </button>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
