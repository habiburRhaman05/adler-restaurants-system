import type { LucideIcon } from "lucide-react";
import {
  ChefHat,
  Wine,
  Utensils,
  Briefcase,
  ClipboardList,
  Droplets,
  Layers,
} from "lucide-react";

/**
 * Visual identity (icon + gradient) per category id.
 * Falls back to `Layers` / a neutral blue gradient for unknown ids,
 * so newly created custom categories always render sensibly.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  service: Utensils,
  kitchen: ChefHat,
  bar: Wine,
  office: Briefcase,
  commande: ClipboardList,
  dishwashing: Droplets,
};

export const CATEGORY_ICON_GRADIENTS: Record<string, string> = {
  service: "from-blue-600 to-blue-700 shadow-blue-600/30",
  kitchen: "from-amber-500 to-orange-600 shadow-amber-500/30",
  bar: "from-purple-600 to-purple-700 shadow-purple-600/30",
  office: "from-slate-700 to-slate-800 shadow-slate-700/30",
  commande: "from-blue-600 to-blue-700 shadow-blue-600/30",
  dishwashing: "from-sky-600 to-sky-700 shadow-sky-600/30",
};

export const DEFAULT_CATEGORY_ICON = Layers;
export const DEFAULT_CATEGORY_ICON_GRADIENT =
  "from-blue-600 to-blue-700 shadow-blue-600/30";

export function getCategoryIcon(categoryId: string): LucideIcon {
  return CATEGORY_ICONS[categoryId] ?? DEFAULT_CATEGORY_ICON;
}

export function getCategoryIconGradient(categoryId: string): string {
  return CATEGORY_ICON_GRADIENTS[categoryId] ?? DEFAULT_CATEGORY_ICON_GRADIENT;
}
