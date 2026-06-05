// Central icon map so data (modes, widgets) can reference icons by string name
// without dynamic imports. Add new icons here as features land.
import {
  BookOpen,
  GraduationCap,
  CalendarDays,
  Layers,
  Timer,
  Droplets,
  ListChecks,
  BarChart3,
  Sparkles,
  Settings,
  Sun,
  Moon,
  LogOut,
  Plus,
  Maximize2,
  Minimize2,
  X,
  User,
  Flag,
  Link2,
  Trophy,
  Brain,
} from 'lucide-react'

export const ICONS = {
  BookOpen,
  GraduationCap,
  CalendarDays,
  Layers,
  Timer,
  Droplets,
  ListChecks,
  BarChart3,
  Sparkles,
  Settings,
  Sun,
  Moon,
  LogOut,
  Plus,
  Maximize2,
  Minimize2,
  X,
  User,
  Flag,
  Link2,
  Trophy,
  Brain,
}

/** Resolve an icon component by name, falling back to a neutral glyph. */
export function getIcon(name) {
  return ICONS[name] || Layers
}
