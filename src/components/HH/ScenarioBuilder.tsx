import { useState } from "react";
import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Plus,
  Save,
  Play,
  ZoomIn,
  ZoomOut,
  Grid3x3,
  AlertCircle,
  MessageSquare,
  GitBranch,
  Flag,
  CircleDot,
} from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

type NodeType = "Question" | "CustomerReply" | "Branch" | "ScoreRule" | "End";

interface Node {
  id: string;
  type: NodeType;
  phase: 1 | 2 | 3 | 4;
  techniques: string[];
  label: string;
  x: number;
  y: number;
}

interface ScenarioBuilderProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
  onboardingMode?: boolean;
}

export function ScenarioBuilder({ navigate, isAdmin = false }: ScenarioBuilderProps) {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: "1",
      type: "Question",
      phase: 1,
      techniques: ["Discovery", "SPIN"],
      label: "Opening vraag",
      x: 100,
      y: 100,
    },
    {
      id: "2",
      type: "CustomerReply",
      phase: 1,
      techniques: [],
      label: "Klant reageert op prijs",
      x: 300,
      y: 100,
    },
    {
      id: "3",
      type: "Branch",
      phase: 2,
      techniques: ["Objection Handling"],
      label: "Type bezwaar?",
      x: 500,
      y: 100,
    },
  ]);

  const [zoom, setZoom] = useState(100);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const nodeIcons = {
    Question: MessageSquare,
    CustomerReply: CircleDot,
    Branch: GitBranch,
    ScoreRule: AlertCircle,
    End: Flag,
  };

  const nodeColors = {
    Question: "bg-hh-primary/10 border-hh-primary text-hh-primary",
    CustomerReply: "bg-hh-ui-100 border-hh-ui-300 text-hh-text",
    Branch: "bg-hh-warn/10 border-hh-warn text-hh-warn",
    ScoreRule: "bg-hh-success/10 border-hh-success text-hh-success",
    End: "bg-hh-ink border-hh-ink text-white",
  };

  const validateScenario = () => {
    const newErrors: string[] = [];
    
    // Check for nodes without connections
    if (nodes.length < 3) {
      newErrors.push("Scenario moet minimaal 3 nodes bevatten");
    }
    
    // Check for end node
    const hasEndNode = nodes.some((n) => n.type === "End");
    if (!hasEndNode) {
      newErrors.push("Scenario moet een End node bevatten");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  return (
    <AppLayout currentPage="library" navigate={navigate} isAdmin={isAdmin}>
      <div className="h-full flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel: Templates & Assets - Hidden on small screens, can be shown via toggle */}
        <div className="hidden lg:block lg:w-64 bg-hh-bg border-r border-hh-border p-4 space-y-4 overflow-auto">
          <div>
            <h3 className="text-[20px] leading-[28px] text-hh-text mb-4">
              Nieuw scenario
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template">Start met template</Label>
                <Select>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Kies template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">Blanco canvas</SelectItem>
                    <SelectItem value="discovery">Discovery call</SelectItem>
                    <SelectItem value="objection">Objection handling</SelectItem>
                    <SelectItem value="closing">Closing conversation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="persona">Persona</Label>
                <Input
                  id="persona"
                  placeholder="b.v. Sales Director bij SaaS scale-up"
                  className="bg-hh-ui-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Context</Label>
                <Textarea
                  id="context"
                  placeholder="Beschrijf de situatie, hun pijnpunt, budget niveau..."
                  className="bg-hh-ui-50"
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-hh-border">
            <h3 className="text-[16px] leading-[24px] font-medium text-hh-text mb-3">
              Node types
            </h3>
            <div className="space-y-2">
              {(["Question", "CustomerReply", "Branch", "ScoreRule", "End"] as NodeType[]).map(
                (type) => {
                  const Icon = nodeIcons[type];
                  return (
                    <button
                      key={type}
                      className={`w-full p-3 rounded-lg border-2 ${nodeColors[type]} hover:opacity-80 transition-opacity text-left flex items-center gap-2`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[14px] leading-[20px] font-medium">
                        {type}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-hh-border">
            <h3 className="text-[16px] leading-[24px] font-medium text-hh-text mb-3">
              Assets
            </h3>
            <div className="space-y-2">
              <Card className="p-3 rounded-lg shadow-hh-sm border-hh-border text-[14px] leading-[20px] text-hh-text">
                📄 Product pitch.pdf
              </Card>
              <Card className="p-3 rounded-lg shadow-hh-sm border-hh-border text-[14px] leading-[20px] text-hh-text">
                📊 Pricing sheet.xlsx
              </Card>
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Upload asset
              </Button>
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 bg-hh-ui-50 relative">
          {/* Toolbar */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-hh-bg border border-hh-border rounded-lg p-2 shadow-hh-md">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(Math.max(50, zoom - 10))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-[14px] leading-[20px] font-medium text-hh-text min-w-[60px] text-center">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(Math.min(200, zoom + 10))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <div className="w-px h-6 bg-hh-border mx-1" />
              <Button
                variant={snapToGrid ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setSnapToGrid(!snapToGrid)}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={validateScenario}
                className="gap-2"
              >
                <AlertCircle className="w-4 h-4" /> Valideer
              </Button>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  if (validateScenario()) {
                    navigate?.("roleplay");
                  }
                }}
              >
                <Play className="w-4 h-4" /> Preview
              </Button>
              <Button 
                className="gap-2"
                onClick={() => {
                  if (validateScenario()) {
                    // In production: save to database
                    navigate?.("library");
                  }
                }}
              >
                <Save className="w-4 h-4" /> Publiceer
              </Button>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="absolute top-20 left-4 right-4 z-10">
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Canvas */}
          <div
            className="absolute inset-0 overflow-auto"
            style={{
              backgroundImage: snapToGrid
                ? "radial-gradient(circle, #DCE3ED 1px, transparent 1px)"
                : "none",
              backgroundSize: snapToGrid ? "20px 20px" : "auto",
            }}
          >
            <div
              className="relative min-w-[2000px] min-h-[2000px]"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "0 0" }}
            >
              {/* Connectors */}
              <svg className="absolute inset-0 pointer-events-none">
                <line
                  x1={nodes[0]?.x + 100}
                  y1={nodes[0]?.y + 50}
                  x2={nodes[1]?.x}
                  y2={nodes[1]?.y + 50}
                  stroke="var(--hh-ui-300)"
                  strokeWidth="2"
                />
                <line
                  x1={nodes[1]?.x + 100}
                  y1={nodes[1]?.y + 50}
                  x2={nodes[2]?.x}
                  y2={nodes[2]?.y + 50}
                  stroke="var(--hh-ui-300)"
                  strokeWidth="2"
                />
              </svg>

              {/* Nodes */}
              {nodes.map((node) => {
                const Icon = nodeIcons[node.type];
                return (
                  <div
                    key={node.id}
                    className={`absolute w-[200px] cursor-move ${
                      selectedNode === node.id ? "ring-2 ring-hh-primary" : ""
                    }`}
                    style={{ left: node.x, top: node.y }}
                    onClick={() => setSelectedNode(node.id)}
                  >
                    <Card
                      className={`p-4 rounded-[12px] shadow-hh-md border-2 ${nodeColors[node.type]}`}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] mb-1"
                          >
                            Fase {node.phase}
                          </Badge>
                          <p className="text-[14px] leading-[20px] font-medium">
                            {node.label}
                          </p>
                        </div>
                      </div>
                      {node.techniques.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {node.techniques.map((tech, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel: Properties */}
        <div className="w-80 bg-hh-bg border-l border-hh-border p-6 space-y-6 overflow-auto">
          {selectedNode ? (
            <>
              <div>
                <h2 className="text-[20px] leading-[28px] font-semibold text-hh-text mb-4">
                  Node eigenschappen
                </h2>
                <p className="text-[14px] leading-[20px] text-hh-muted mb-4">
                  Node: {nodes.find((n) => n.id === selectedNode)?.label}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="node-label">Label</Label>
                  <Input
                    id="node-label"
                    value={nodes.find((n) => n.id === selectedNode)?.label}
                    className="bg-hh-ui-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="node-phase">Fase</Label>
                  <Select
                    value={
                      nodes.find((n) => n.id === selectedNode)?.phase.toString()
                    }
                  >
                    <SelectTrigger id="node-phase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Fase 1 - Discovery</SelectItem>
                      <SelectItem value="2">Fase 2 - Qualification</SelectItem>
                      <SelectItem value="3">Fase 3 - Proposal</SelectItem>
                      <SelectItem value="4">Fase 4 - Closing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Technieken</Label>
                  <div className="flex flex-wrap gap-2">
                    {["E.P.I.C", "Discovery", "Objection Handling", "BANT", "Closing", "Value Selling"].map(
                      (tech) => (
                        <Badge
                          key={tech}
                          variant="outline"
                          className="cursor-pointer hover:bg-hh-primary hover:text-white"
                        >
                          {tech}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="node-condition">Voorwaarde</Label>
                  <Textarea
                    id="node-condition"
                    placeholder="b.v. If score > 80%"
                    className="bg-hh-ui-50"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score-rule">Score regel</Label>
                  <Select>
                    <SelectTrigger id="score-rule">
                      <SelectValue placeholder="Kies regel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">
                        Bevat keywords
                      </SelectItem>
                      <SelectItem value="sentiment">
                        Sentiment analyse
                      </SelectItem>
                      <SelectItem value="length">Antwoord lengte</SelectItem>
                      <SelectItem value="questions">
                        Aantal vragen gesteld
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-6 border-t border-hh-border">
                <Button variant="destructive" size="sm" className="w-full">
                  Verwijder node
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <AlertCircle className="w-12 h-12 text-hh-muted mx-auto mb-3" />
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  Selecteer een node om eigenschappen te bewerken
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
