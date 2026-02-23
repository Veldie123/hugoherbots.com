import fs from "fs";
import path from "path";
import { loadMergedTechniques, getFases, getTechniqueCoachIntro } from '../ssot-loader';

interface MethodologySection {
  title: string;
  content: string;
  items: MethodologyItem[];
}

interface MethodologyItem {
  id: string;
  label: string;
  description: string;
  steps?: string[];
  techniques?: string[];
  videoRef?: string;
  details?: Record<string, any>;
}

interface MethodologyReport {
  generatedAt: string;
  version: string;
  configFiles: string[];
  sections: MethodologySection[];
  markdown: string;
}

function loadJsonConfig(filename: string): any {
  const configPath = path.join(process.cwd(), "config", filename);
  if (!fs.existsSync(configPath)) {
    console.warn(`Config not found: ${filename}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function generateFaseSection(fases: any[]): MethodologySection {
  const items: MethodologyItem[] = fases.map((fase) => ({
    id: `fase-${fase.fase}`,
    label: `Fase ${fase.fase}: ${fase.naam}`,
    description: fase.uitleg || "",
    techniques: Array.isArray(fase.technieken)
      ? fase.technieken.map((t: any) =>
          typeof t === "string" ? t : `${t.verplicht_volgnummer}. ${t.naam}`
        )
      : [],
    steps: fase.themas || [],
  }));

  return {
    title: "Fases Overzicht",
    content:
      "De 4 fases van het Hugo verkoopproces met bijhorende technieken.",
    items,
  };
}

function generateTechniekenSection(technieken: readonly any[]): MethodologySection {
  const items: MethodologyItem[] = technieken.map((tech) => {
    const details: Record<string, any> = {};
    
    if (tech.wat) details["Wat"] = tech.wat;
    if (tech.waarom) details["Waarom"] = tech.waarom;
    if (tech.wanneer) details["Wanneer"] = tech.wanneer;
    if (tech.hoe) details["Hoe"] = tech.hoe;
    if (tech.voorbeeld) details["Voorbeelden"] = tech.voorbeeld;
    if (tech["do's"]) details["Do's"] = tech["do's"];
    if (tech["dont's"]) details["Don'ts"] = tech["dont's"];
    if (tech.tags) details["Tags"] = tech.tags;
    if (tech.niveau) details["Niveau"] = tech.niveau;
    if (tech.ai_eval_points) details["AI Evaluatiepunten"] = tech.ai_eval_points;
    if (tech.verkoper_intentie) details["Verkoper Intentie"] = tech.verkoper_intentie;
    if (tech.klant_signaal) details["Klant Signaal"] = tech.klant_signaal;
    if (tech.related_techniques) details["Gerelateerde Technieken"] = tech.related_techniques;
    if (tech.counterindications) details["Contra-indicaties"] = tech.counterindications;
    if (tech.practice) {
      details["Oefenmodus"] = {
        "Default Mode": tech.practice.default_mode,
        "Roleplay Capable": tech.practice.roleplay_capable ? "Ja" : "Nee",
        "Notes": tech.practice.notes
      };
    }

    return {
      id: tech.nummer,
      label: `${tech.nummer}: ${tech.naam}`,
      description: tech.wat || tech.naam,
      steps: tech.stappenplan || [],
      details,
    };
  });

  return {
    title: "Technieken Catalogus",
    content:
      "Alle verkoop technieken met wat, waarom, wanneer, hoe, en stappenplan.",
    items,
  };
}

function generateHoudingSection(houdingen: any): MethodologySection {
  const items: MethodologyItem[] = Object.entries(houdingen).map(
    ([key, h]: [string, any]) => ({
      id: h.id || key,
      label: `${h.id || key}: ${h.naam}`,
      description: h.beschrijving,
      steps: h.stappenplan || [],
      techniques: h.techniek_reactie
        ? typeof h.techniek_reactie === "string"
          ? [h.techniek_reactie]
          : Object.values(h.techniek_reactie).map(
              (t: any) => `${t.techniek}: ${t.beschrijving || t.actie || ""}`
            )
        : [],
      details: {
        "Signalen": h.signalen,
        "Fase Specifiek": h.fase_specifiek,
      }
    })
  );

  return {
    title: "Klant Houdingen (H1-H11)",
    content:
      "De 11 mogelijke klanthoudingen, hun signalen, en hoe de verkoper hierop moet reageren.",
    items,
  };
}

function generateExpectedMovesSection(expectedMoves: any): MethodologySection {
  const items: MethodologyItem[] = [];

  for (const [faseKey, techniques] of Object.entries(expectedMoves)) {
    if (faseKey === "_meta") continue;

    for (const [techKey, houdingen] of Object.entries(techniques as any)) {
      for (const [houdingKey, data] of Object.entries(houdingen as any)) {
        const d = data as any;
        items.push({
          id: `${faseKey}-${techKey}-${houdingKey}`,
          label: `${faseKey.toUpperCase()} > Techniek ${techKey} > Houding: ${houdingKey}`,
          description: d.description,
          techniques: d.expected_moves?.map(
            (m: any) => `[Prio ${m.priority}] ${m.label}${m.when ? ` (wanneer: ${m.when})` : ""}${m.then ? ` → ${m.then}` : ""}`
          ),
          details: {
            "Success Condition": d.success_condition,
            "Fail Condition": d.fail_condition,
          }
        });
      }
    }
  }

  return {
    title: "Verwachte Verkoper Acties per Situatie",
    content:
      "Wanneer de klant een bepaalde houding toont, wat moet de verkoper dan doen? Inclusief prioriteit en voorwaarden.",
    items,
  };
}

function generateDetectorsSection(detectors: any): MethodologySection {
  const items: MethodologyItem[] = [];

  // Lexicon
  if (detectors.lexicon) {
    items.push({
      id: "lexicon",
      label: "Lexicon - Woordenschat voor detectie",
      description: "Woorden en zinsdelen die we gebruiken om technieken te herkennen.",
      details: detectors.lexicon,
    });
  }

  // Semantics
  if (detectors.semantics) {
    items.push({
      id: "semantics",
      label: "Semantiek - Vraagtype en zinstype herkenning",
      description: "Hoe we verschillende vraag- en zinstypes herkennen.",
      details: detectors.semantics,
    });
  }

  // Technique patterns
  if (detectors.techniques) {
    for (const [techId, tech] of Object.entries(detectors.techniques as Record<string, any>)) {
      items.push({
        id: `detector-${techId}`,
        label: `${techId}: ${tech.naam || ""}`,
        description: tech.letterlijke_verwoording?.join(" ") || "",
        details: {
          "Patronen": tech.patterns,
          "Semantic": tech.semantic,
          "Confidence Threshold": tech.confidence_threshold,
          "Success Indicators": tech.success_indicators,
          "Anti Patterns": tech.anti_patterns,
          "Verkoper Intentie": tech.verkoper_intentie,
        }
      });
    }
  }

  return {
    title: "Detectie Patronen",
    content:
      "Hoe het systeem verkooptechnieken herkent in de input van de verkoper.",
    items,
  };
}

function generateContextQuestionsSection(contextQuestions: any): MethodologySection {
  const items: MethodologyItem[] = [];

  for (const [techKey, questions] of Object.entries(contextQuestions)) {
    if (techKey === "_meta") continue;

    const qs = questions as any[];
    items.push({
      id: `context-${techKey}`,
      label: `Techniek ${techKey}: Context Vragen`,
      description: `${qs.length} vragen om context te verzamelen voor deze techniek.`,
      steps: qs.map((q: any) => 
        `${q.required ? "[VERPLICHT] " : ""}${q.question}${q.examples ? ` (bijv. ${q.examples.slice(0, 2).join(", ")})` : ""}`
      ),
    });
  }

  return {
    title: "Context Vragen per Techniek",
    content:
      "Welke vragen stelt Hugo aan de gebruiker om context te verzamelen voordat het rollenspel begint?",
    items,
  };
}

/**
 * Generate coach intros from SSOT - dynamic, no hardcoded duplicates
 * Uses getTechniqueCoachIntro from ssot-loader for template-based generation
 */
function generateCoachIntrosFromSSOT(technieken: readonly any[]): MethodologySection {
  const items: MethodologyItem[] = [];

  for (const tech of technieken) {
    const intro = getTechniqueCoachIntro(tech.nummer) || "";
    
    items.push({
      id: `coach-intro-${tech.nummer}`,
      label: `${tech.nummer}: ${tech.naam}`,
      description: intro,
    });
  }

  return {
    title: "Coach Introducties per Techniek (Dynamisch uit SSOT)",
    content: "Hoe Hugo elke techniek introduceert aan de gebruiker. Gegenereerd uit technieken_index.json.",
    items,
  };
}

function generatePersonaSection(personaTemplates: any): MethodologySection {
  const items: MethodologyItem[] = [];

  if (personaTemplates.axes) {
    for (const [axisKey, axis] of Object.entries(personaTemplates.axes as Record<string, any>)) {
      const axisData = axis as any;
      items.push({
        id: `axis-${axisKey}`,
        label: `As: ${axisData.label || axisKey}`,
        description: axisData.description || "",
        steps: axisData.options?.map((opt: any) => 
          `${opt.value}: ${opt.label}${opt.description ? ` - ${opt.description}` : ""}`
        ),
        details: axisData.houding_weights ? { "Houding Weights": axisData.houding_weights } : undefined,
      });
    }
  }

  if (personaTemplates.defaults) {
    items.push({
      id: "persona-defaults",
      label: "Persona Defaults",
      description: "Standaard instellingen voor persona generatie.",
      details: personaTemplates.defaults,
    });
  }

  return {
    title: "Persona Templates (4-Axis Model)",
    content:
      "Het 4-assen model voor het genereren van klant persona's: behavior_style, buying_clock_stage, experience_level, difficulty_level.",
    items,
  };
}

function generateTechniqueConceptsSection(concepts: any): MethodologySection {
  const items: MethodologyItem[] = [];

  for (const [techId, concept] of Object.entries(concepts as Record<string, any>)) {
    if (techId === "_meta") continue;
    
    const c = concept as any;
    items.push({
      id: `concept-${techId}`,
      label: `${techId}: ${c.naam || ""}`,
      description: c.conceptual_description || c.description || "",
      details: {
        "Core Intent": c.core_intent,
        "Examples": c.examples,
        "Quality Criteria": c.quality_criteria,
      }
    });
  }

  return {
    title: "Conceptuele Techniek Definities (AI Evaluatie)",
    content:
      "Hoe de AI conceptueel evalueert of een verkoper een techniek correct toepast. Dit zijn geen patronen maar intentie-gebaseerde criteria.",
    items,
  };
}

function generateVideoMappingSection(videoMapping: any): MethodologySection {
  const items: MethodologyItem[] = [];

  if (Array.isArray(videoMapping)) {
    for (const mapping of videoMapping) {
      items.push({
        id: `video-${mapping.techniqueId || mapping.nummer}`,
        label: `${mapping.techniqueId || mapping.nummer}: ${mapping.title || mapping.naam || "Video"}`,
        description: mapping.description || "",
        videoRef: mapping.videoUrl || mapping.url,
        details: {
          "Video ID": mapping.videoId,
          "Duration": mapping.duration,
        }
      });
    }
  } else if (typeof videoMapping === "object") {
    for (const [techId, video] of Object.entries(videoMapping as Record<string, any>)) {
      if (techId === "_meta") continue;
      
      const v = video as any;
      items.push({
        id: `video-${techId}`,
        label: `${techId}: ${v.title || v.naam || "Video"}`,
        description: v.description || "",
        videoRef: v.videoUrl || v.url,
      });
    }
  }

  return {
    title: "Video Mapping",
    content:
      "Koppeling tussen technieken en video cursusmateriaal.",
    items,
  };
}

function generateAIConstraintsSection(aiPrompt: any): MethodologySection {
  const items: MethodologyItem[] = [];

  if (aiPrompt.constraints) {
    items.push({
      id: "constraints",
      label: "AI Constraints",
      description: "Harde regels waar de AI zich altijd aan moet houden.",
      steps: aiPrompt.constraints,
    });
  }

  if (aiPrompt.human_variation) {
    items.push({
      id: "human-variation",
      label: "Menselijke Variatie",
      description: "Hoe de AI-klant menselijk en onvoorspelbaar gedrag simuleert.",
      details: {
        "Tone Range": aiPrompt.human_variation.tone_range,
        "Response Patterns": aiPrompt.human_variation.response_patterns,
        "Forbidden Patterns": aiPrompt.human_variation.forbidden_patterns,
      }
    });
  }

  if (aiPrompt.goals) {
    items.push({
      id: "goals",
      label: "AI Doelen per Modus",
      description: "Wat de AI probeert te bereiken in elke modus.",
      details: aiPrompt.goals,
    });
  }

  if (aiPrompt._global_guidelines) {
    items.push({
      id: "global-guidelines",
      label: "Globale Richtlijnen",
      description: "Overkoepelende regels voor alle AI output.",
      details: aiPrompt._global_guidelines,
    });
  }

  return {
    title: "AI Gedragsregels",
    content:
      "Constraints, variatie-regels en doelen die bepalen hoe de AI zich gedraagt.",
    items,
  };
}

function sectionToMarkdown(section: MethodologySection): string {
  let md = `## ${section.title}\n\n`;
  md += `${section.content}\n\n`;

  for (const item of section.items) {
    md += `### ${item.label}\n\n`;
    
    if (item.description) {
      md += `${item.description}\n\n`;
    }

    if (item.videoRef) {
      md += `**Video:** ${item.videoRef}\n\n`;
    }

    if (item.steps && item.steps.length > 0) {
      md += `**Stappen/Items:**\n`;
      item.steps.forEach((step, i) => {
        md += `${i + 1}. ${step}\n`;
      });
      md += `\n`;
    }

    if (item.techniques && item.techniques.length > 0) {
      md += `**Technieken/Acties:**\n`;
      item.techniques.forEach((tech) => {
        md += `- ${tech}\n`;
      });
      md += `\n`;
    }

    if (item.details && Object.keys(item.details).length > 0) {
      md += `**Details:**\n`;
      for (const [key, value] of Object.entries(item.details)) {
        if (value === undefined || value === null) continue;
        
        if (Array.isArray(value)) {
          md += `- **${key}:** ${value.join(", ")}\n`;
        } else if (typeof value === "object") {
          md += `- **${key}:**\n`;
          for (const [subKey, subValue] of Object.entries(value as Record<string, any>)) {
            if (Array.isArray(subValue)) {
              md += `  - ${subKey}: ${subValue.slice(0, 5).join(", ")}${subValue.length > 5 ? "..." : ""}\n`;
            } else {
              md += `  - ${subKey}: ${subValue}\n`;
            }
          }
        } else {
          md += `- **${key}:** ${value}\n`;
        }
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

export function generateMethodologyReport(): MethodologyReport {
  const configFiles: string[] = [];
  const sections: MethodologySection[] = [];

  // Load all config files
  const fases = getFases(); // From SSOT
  const technieken = loadMergedTechniques(); // From SSOT
  const klantHoudingen = loadJsonConfig("klant_houdingen.json");
  const detectors = loadJsonConfig("detectors.json");
  const contextQuestions = loadJsonConfig("context_questions.json");
  const aiPrompt = loadJsonConfig("ai_prompt.json");
  const personaTemplates = loadJsonConfig("persona_templates.json");
  const videoMapping = loadJsonConfig("video_mapping.json");

  // Track which files were loaded
  if (fases) configFiles.push("ssot/technieken_index.json (fases)");
  if (technieken?.length) configFiles.push("ssot/technieken_index.json");
  if (klantHoudingen) configFiles.push("klant_houdingen.json");
  if (detectors) configFiles.push("detectors.json");
  if (contextQuestions) configFiles.push("context_questions.json");
  if (aiPrompt) configFiles.push("ai_prompt.json");
  if (personaTemplates) configFiles.push("persona_templates.json");
  if (videoMapping) configFiles.push("video_mapping.json");

  // Generate sections in logical order
  if (fases) {
    sections.push(generateFaseSection(fases));
  }

  if (technieken) {
    sections.push(generateTechniekenSection(technieken));
  }

  if (klantHoudingen?.houdingen) {
    sections.push(generateHoudingSection(klantHoudingen.houdingen));
  }

  if (detectors) {
    sections.push(generateDetectorsSection(detectors));
  }

  if (contextQuestions) {
    sections.push(generateContextQuestionsSection(contextQuestions));
  }

  // Coach intros now dynamically generated from SSOT - show them here
  if (technieken?.length) {
    sections.push(generateCoachIntrosFromSSOT(technieken));
  }

  if (aiPrompt) {
    sections.push(generateAIConstraintsSection(aiPrompt));
  }

  if (personaTemplates) {
    sections.push(generatePersonaSection(personaTemplates));
  }

  if (videoMapping) {
    sections.push(generateVideoMappingSection(videoMapping));
  }

  // Generate markdown
  let markdown = `# Hugo Methodologie Rapport\n\n`;
  markdown += `*Gegenereerd op: ${new Date().toLocaleString("nl-BE")}*\n\n`;
  markdown += `Dit rapport toont de **volledige geprogrammeerde verkooplogica**. Controleer of dit 100% overeenkomt met de cursus.\n\n`;
  markdown += `## Geïncludeerde Configuratie Bestanden\n\n`;
  configFiles.forEach((file, i) => {
    markdown += `${i + 1}. \`${file}\`\n`;
  });
  markdown += `\n---\n\n`;

  for (const section of sections) {
    markdown += sectionToMarkdown(section);
  }

  return {
    generatedAt: new Date().toISOString(),
    version: "2.0",
    configFiles,
    sections,
    markdown,
  };
}

export function generateEpicFlowMarkdown(): string {
  const klantHoudingen = loadJsonConfig("klant_houdingen.json");
  const technieken = loadMergedTechniques(); // From SSOT

  let md = `# EPIC Flow Logica\n\n`;
  md += `*Dit document beschrijft de EPIC methodologie stappen per techniek (via SSOT).*\n\n`;

  if (!technieken?.length || !klantHoudingen?.houdingen) {
    return md + "Configuratie niet gevonden.\n";
  }

  // Group techniques by phase
  const phases: Record<string, any[]> = {};
  for (const tech of technieken) {
    const phase = tech.fase || "";
    if (!phases[phase]) phases[phase] = [];
    phases[phase].push(tech);
  }

  for (const [phase, techs] of Object.entries(phases)) {
    md += `## Fase: ${phase}\n\n`;

    for (const tech of techs) {
      md += `### ${tech.id} - ${tech.naam}\n\n`;
      
      if (tech.doel) {
        md += `**Doel:** ${tech.doel}\n\n`;
      }

      if (tech.stappenplan?.length) {
        md += `**Stappenplan:**\n`;
        tech.stappenplan.forEach((step: string, i: number) => {
          md += `${i + 1}. ${step}\n`;
        });
        md += `\n`;
      }

      if (tech.signalen_correct?.length) {
        md += `**Signalen correct:** ${tech.signalen_correct.slice(0, 3).join(", ")}${tech.signalen_correct.length > 3 ? "..." : ""}\n\n`;
      }

      md += `---\n\n`;
    }
  }

  // Add customer attitudes section
  md += `## Klant Houdingen\n\n`;
  const houdingMap = klantHoudingen.houdingen;
  for (const [key, h] of Object.entries(houdingMap)) {
    const houding = h as any;
    md += `### ${houding.id} - ${houding.naam}\n\n`;
    if (houding.signalen?.length) {
      md += `**Signalen:** ${houding.signalen.slice(0, 3).join(", ")}...\n\n`;
    }
    if (houding.stappenplan?.length) {
      md += `**Stappenplan:**\n`;
      houding.stappenplan.forEach((step: string, i: number) => {
        md += `${i + 1}. ${step}\n`;
      });
      md += `\n`;
    }
    md += `---\n\n`;
  }

  return md;
}
