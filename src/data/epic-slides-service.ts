import epicSlidesData from "@config/epic_slides.json";

export interface EpicSlide {
  id: string;
  techniqueIds: string[];
  phase: string;
  titel: string;
  kernboodschap: string;
  bulletpoints: string[];
  visual_type: string;
  personalisatie_slots: string[];
}

export function getEpicSlides(): EpicSlide[] {
  return (epicSlidesData as any).slides || [];
}

export function getSlidesByTechnique(techniqueNummer: string): EpicSlide[] {
  return getEpicSlides().filter(
    (slide) => slide.techniqueIds?.includes(techniqueNummer)
  );
}
