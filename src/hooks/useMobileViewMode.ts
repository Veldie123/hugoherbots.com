import { useState } from "react";

export function useMobileViewMode<T extends string>(
  mobileDefault: T,
  desktopDefault: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  return useState<T>(() =>
    typeof window !== "undefined" && window.innerWidth < 768
      ? mobileDefault
      : desktopDefault
  );
}
