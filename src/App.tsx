import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Check,
  Clock,
  Download,
  Flame,
  Heart,
  Home,
  KeyRound,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  TrendingUp,
  UserX,
  X,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { jsPDF } from "jspdf";

import { BackgroundPaths } from "@/components/ui/background-paths";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiquidButton } from "@/components/ui/liquid-button";
import {
  InteractiveMenu,
  type InteractiveMenuItem,
} from "@/components/ui/modern-mobile-menu";
import { Textarea } from "@/components/ui/textarea";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";

type AppTab = "dashboard" | "add" | "history" | "analytics";
type PressureCategory = "normal" | "elevated" | "high1" | "high2" | "low";
type PulseCategory = "low" | "normal" | "high";
type TimeRange = "7d" | "30d" | "3m" | "all";
type SettingsSectionKey = "pulse" | "pressure";
type AuthView = "login" | "signup";
type PasswordResetStep = "idle" | "request" | "verify";
type Handedness = "left" | "right";
type ArmSide = "left" | "right";
type AppThemeId = "midnight" | "sand" | "blush" | "sage" | "ocean";

import type { Id } from "../convex/_generated/dataModel";

interface SecondArmReading {
  arm: ArmSide;
  systolic: number;
  diastolic: number;
  pulse: number;
}

interface BloodPressureReading {
  id: Id<"readings">;
  systolic: number;
  diastolic: number;
  pulse: number;
  arm: ArmSide;
  secondArm?: SecondArmReading;
  timestamp: Date;
  note?: string;
}

interface DisplayReadingValues {
  systolic: number;
  diastolic: number;
  pulse: number;
}

interface AddMeasurementPrefill {
  systolic: number;
  diastolic: number;
  pulse: number;
  sampleCount: number;
  source: "default" | "recent_10_days" | "recent_readings";
}

interface PressureChartPoint {
  date: string;
  sys: number;
  dia: number;
  pulse: number;
  count: number;
}

interface ChartInteractionState {
  activeTooltipIndex: number | string | null | undefined;
  isTooltipActive: boolean;
  activeCoordinate?: {
    x?: number;
    y?: number;
  };
}

interface PressurePreferences {
  lowSys: number;
  lowDia: number;
  elevatedSys: number;
  high1Sys: number;
  high1Dia: number;
  high2Sys: number;
  high2Dia: number;
  high3Sys: number;
  high3Dia: number;
}

interface PulsePreferences {
  low: number;
  high: number;
}

interface MeasurementPreferences {
  pressure: PressurePreferences;
  pulse: PulsePreferences;
}

const defaultMeasurementPreferences: MeasurementPreferences = {
  pressure: {
    lowSys: 90,
    lowDia: 60,
    elevatedSys: 120,
    high1Sys: 130,
    high1Dia: 85,
    high2Sys: 140,
    high2Dia: 90,
    high3Sys: 180,
    high3Dia: 120,
  },
  pulse: {
    low: 60,
    high: 100,
  },
};

const PRESSURE_RULES = {
  lowSys: 90,
  lowDia: 60,
  normalDiaMin: 80,
  normalSysMax: 119,
  normalDiaMax: 79,
  high1SysMin: 130,
  high1SysMax: 139,
  high1DiaMin: 85,
  high1DiaMax: 89,
  high2SysMin: 140,
  high2DiaMin: 90,
  chartMin: 40,
  chartMax: 200,
} as const;

const OTP_CODE_VALIDITY_SECONDS = 10 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const PREFILL_LOOKBACK_DAYS = 10;
const PREFILL_MIN_RECENT_SAMPLE = 3;
const PREFILL_MAX_FALLBACK_SAMPLE = 10;
const ADD_DEFAULTS = {
  systolic: 120,
  diastolic: 80,
  pulse: 72,
} as const;

interface AppThemePalette {
  id: AppThemeId;
  label: string;
  background: string;
  pathColor: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  menuGradient: string;
  menuOverlay: string;
  accent: string;
  onAccent: string;
  accentMuted: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  heart: string;
  swatchA: string;
  swatchB: string;
}

const THEME_STORAGE_KEY = "bp-theme";
const DEFAULT_THEME_ID: AppThemeId = "midnight";
const THEME_IDS: AppThemeId[] = ["midnight", "sand", "ocean", "blush", "sage"];

const APP_THEME_PALETTES: Record<AppThemeId, AppThemePalette> = {
  midnight: {
    id: "midnight",
    label: "Główny",
    background: "#0A0A0A",
    pathColor: "rgba(152,185,255,0.90)",
    cardBg: "rgba(17, 18, 22, 0.84)",
    cardBorder: "rgba(255, 255, 255, 0.10)",
    cardShadow: "0 14px 32px rgba(0, 0, 0, 0.44)",
    menuGradient:
      "linear-gradient(165deg, rgba(26,31,44,0.8) 0%, rgba(18,23,34,0.84) 38%, rgba(10,13,21,0.9) 100%)",
    menuOverlay:
      "radial-gradient(90% 110% at 50% -25%, rgba(10,132,255,0.10), rgba(10,132,255,0) 56%), radial-gradient(80% 100% at 50% 140%, rgba(0,0,0,0.28), rgba(0,0,0,0) 70%)",
    accent: "#0A84FF",
    onAccent: "#FFFFFF",
    accentMuted: "#BFDFFF",
    success: "#30D158",
    warning: "#FF9F0A",
    danger: "#FF453A",
    info: "#7AB8FF",
    heart: "#FF453A",
    swatchA: "#0A84FF",
    swatchB: "#1B2435",
  },
  sand: {
    id: "sand",
    label: "Biało-czarny",
    background: "#E9E7E4",
    pathColor: "rgba(40,40,40,0.22)",
    cardBg: "rgba(248, 247, 245, 0.82)",
    cardBorder: "rgba(20, 20, 20, 0.14)",
    cardShadow: "0 12px 28px rgba(0, 0, 0, 0.10)",
    menuGradient:
      "linear-gradient(165deg, rgba(245,245,243,0.88) 0%, rgba(232,231,228,0.92) 38%, rgba(220,218,214,0.95) 100%)",
    menuOverlay:
      "radial-gradient(90% 110% at 50% -25%, rgba(255,255,255,0.46), rgba(255,255,255,0) 58%), radial-gradient(80% 100% at 50% 140%, rgba(0,0,0,0.07), rgba(0,0,0,0) 70%)",
    accent: "#2A2A2A",
    onAccent: "#F5F5F5",
    accentMuted: "#1B1B1B",
    success: "#2C2C2C",
    warning: "#8A6A1E",
    danger: "#9B3B3B",
    info: "#4A617A",
    heart: "#4C4C4C",
    swatchA: "#F8F8F8",
    swatchB: "#1F1F1F",
  },
  blush: {
    id: "blush",
    label: "Różowy",
    background: "#151015",
    pathColor: "rgba(242,183,215,0.86)",
    cardBg: "rgba(35, 21, 33, 0.84)",
    cardBorder: "rgba(245, 201, 230, 0.14)",
    cardShadow: "0 14px 32px rgba(8, 3, 8, 0.46)",
    menuGradient:
      "linear-gradient(165deg, rgba(53,32,50,0.80) 0%, rgba(38,24,37,0.84) 38%, rgba(24,15,24,0.90) 100%)",
    menuOverlay:
      "radial-gradient(90% 110% at 50% -25%, rgba(217,119,168,0.16), rgba(217,119,168,0) 56%), radial-gradient(80% 100% at 50% 140%, rgba(0,0,0,0.28), rgba(0,0,0,0) 70%)",
    accent: "#D977A8",
    onAccent: "#FFFFFF",
    accentMuted: "#F2C6DE",
    success: "#78C8A8",
    warning: "#E3A37A",
    danger: "#DC728A",
    info: "#E8A9CB",
    heart: "#F28CB5",
    swatchA: "#D977A8",
    swatchB: "#34212F",
  },
  sage: {
    id: "sage",
    label: "Szałwia",
    background: "#0D1412",
    pathColor: "rgba(165,220,198,0.88)",
    cardBg: "rgba(19, 31, 27, 0.84)",
    cardBorder: "rgba(186, 232, 212, 0.14)",
    cardShadow: "0 14px 32px rgba(4, 9, 7, 0.44)",
    menuGradient:
      "linear-gradient(165deg, rgba(28,46,39,0.80) 0%, rgba(20,34,30,0.84) 38%, rgba(12,22,18,0.90) 100%)",
    menuOverlay:
      "radial-gradient(90% 110% at 50% -25%, rgba(83,179,140,0.17), rgba(83,179,140,0) 56%), radial-gradient(80% 100% at 50% 140%, rgba(0,0,0,0.26), rgba(0,0,0,0) 70%)",
    accent: "#53B38C",
    onAccent: "#FFFFFF",
    accentMuted: "#BFE9D6",
    success: "#48C78E",
    warning: "#D4A65B",
    danger: "#D97364",
    info: "#8BDAB9",
    heart: "#E98271",
    swatchA: "#53B38C",
    swatchB: "#21392E",
  },
  ocean: {
    id: "ocean",
    label: "Czarno-biały",
    background: "#070707",
    pathColor: "rgba(245,245,245,0.90)",
    cardBg: "rgba(18, 18, 18, 0.86)",
    cardBorder: "rgba(255, 255, 255, 0.18)",
    cardShadow: "0 14px 32px rgba(0, 0, 0, 0.56)",
    menuGradient:
      "linear-gradient(165deg, rgba(46,46,46,0.78) 0%, rgba(30,30,30,0.84) 38%, rgba(12,12,12,0.92) 100%)",
    menuOverlay:
      "radial-gradient(90% 110% at 50% -25%, rgba(255,255,255,0.16), rgba(255,255,255,0) 56%), radial-gradient(80% 100% at 50% 140%, rgba(0,0,0,0.36), rgba(0,0,0,0) 70%)",
    accent: "#F2F2F2",
    onAccent: "#111111",
    accentMuted: "#FFFFFF",
    success: "#D1D1D1",
    warning: "#D4AF5E",
    danger: "#CF7272",
    info: "#9FBAD7",
    heart: "#F0F0F0",
    swatchA: "#111111",
    swatchB: "#FFFFFF",
  },
};

const isAppThemeId = (value: unknown): value is AppThemeId =>
  typeof value === "string" && (THEME_IDS as string[]).includes(value);

const isLightMonoTheme = (themeId: AppThemeId): boolean => themeId === "sand";

const hexToRgb = (hexColor: string): [number, number, number] | null => {
  const normalized = hexColor.trim().replace("#", "");
  if (![3, 6].includes(normalized.length)) return null;
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  const intValue = Number.parseInt(expanded, 16);
  return [(intValue >> 16) & 255, (intValue >> 8) & 255, intValue & 255];
};

const withAlpha = (hexColor: string, alpha: number, fallback: string): string => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return fallback;
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampedAlpha})`;
};

const readStoredThemeId = (): AppThemeId => {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isAppThemeId(stored) ? stored : DEFAULT_THEME_ID;
};

const getThemeCssVars = (theme: AppThemePalette): React.CSSProperties =>
  ({
    "--theme-bg": theme.background,
    "--theme-path-color": theme.pathColor,
    "--theme-card-bg": theme.cardBg,
    "--theme-card-border": theme.cardBorder,
    "--theme-card-shadow": theme.cardShadow,
    "--theme-menu-gradient": theme.menuGradient,
    "--theme-menu-overlay": theme.menuOverlay,
    "--theme-accent": theme.accent,
    "--theme-on-accent": theme.onAccent,
    "--theme-accent-muted": theme.accentMuted,
    "--theme-success": theme.success,
    "--theme-warning": theme.warning,
    "--theme-danger": theme.danger,
    "--theme-info": theme.info,
    "--theme-heart": theme.heart,
    "--theme-accent-soft": withAlpha(theme.accent, 0.22, "rgba(10, 132, 255, 0.22)"),
    "--theme-accent-soft-strong": withAlpha(theme.accent, 0.3, "rgba(10, 132, 255, 0.3)"),
    "--theme-accent-border": withAlpha(theme.accent, 0.75, "rgba(10, 132, 255, 0.75)"),
    "--theme-success-soft": withAlpha(theme.success, 0.2, "rgba(48, 209, 88, 0.2)"),
    "--theme-success-border": withAlpha(theme.success, 0.32, "rgba(48, 209, 88, 0.32)"),
    "--theme-warning-soft": withAlpha(theme.warning, 0.22, "rgba(255, 159, 10, 0.22)"),
    "--theme-warning-border": withAlpha(theme.warning, 0.34, "rgba(255, 159, 10, 0.34)"),
    "--theme-danger-soft": withAlpha(theme.danger, 0.2, "rgba(255, 69, 58, 0.2)"),
    "--theme-danger-border": withAlpha(theme.danger, 0.34, "rgba(255, 69, 58, 0.34)"),
    "--theme-info-soft": withAlpha(theme.info, 0.2, "rgba(122, 184, 255, 0.2)"),
    "--theme-info-border": withAlpha(theme.info, 0.3, "rgba(122, 184, 255, 0.3)"),
    "--theme-chart-sys": theme.info,
    "--theme-chart-dia": theme.warning,
    "--theme-chart-sys-soft": withAlpha(theme.info, 0.3, "rgba(122, 184, 255, 0.3)"),
    "--theme-chart-dia-soft": withAlpha(theme.warning, 0.3, "rgba(255, 159, 10, 0.3)"),
    "--theme-chart-sys-glow": withAlpha(theme.info, 0.86, "rgba(122, 184, 255, 0.86)"),
  }) as React.CSSProperties;

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  const safeValue = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(max, Math.max(min, Math.round(safeValue)));
};

const normalizeMeasurementPreferences = (candidate: MeasurementPreferences): MeasurementPreferences => {
  const defaults = defaultMeasurementPreferences;
  const lowSys = clamp(candidate.pressure.lowSys, 60, 120, defaults.pressure.lowSys);
  const lowDia = clamp(candidate.pressure.lowDia, 40, 90, defaults.pressure.lowDia);
  const elevatedSys = clamp(candidate.pressure.elevatedSys, lowSys + 1, 150, defaults.pressure.elevatedSys);
  const high1Sys = clamp(candidate.pressure.high1Sys, elevatedSys + 1, 170, defaults.pressure.high1Sys);
  const high2Sys = clamp(candidate.pressure.high2Sys, high1Sys + 1, 190, defaults.pressure.high2Sys);
  const high3Sys = clamp(candidate.pressure.high3Sys, high2Sys + 1, 230, defaults.pressure.high3Sys);
  const minHighNormalDia = Math.max(PRESSURE_RULES.high1DiaMin, lowDia + 1);
  const high1Dia = clamp(candidate.pressure.high1Dia, minHighNormalDia, 110, defaults.pressure.high1Dia);
  const high2Dia = clamp(candidate.pressure.high2Dia, high1Dia + 1, 130, defaults.pressure.high2Dia);
  const high3Dia = clamp(candidate.pressure.high3Dia, high2Dia + 1, 150, defaults.pressure.high3Dia);
  const pulseLow = clamp(candidate.pulse.low, 35, 120, defaults.pulse.low);
  const pulseHigh = clamp(candidate.pulse.high, pulseLow + 1, 220, defaults.pulse.high);

  return {
    pressure: {
      lowSys,
      lowDia,
      elevatedSys,
      high1Sys,
      high1Dia,
      high2Sys,
      high2Dia,
      high3Sys,
      high3Dia,
    },
    pulse: {
      low: pulseLow,
      high: pulseHigh,
    },
  };
};

const areMeasurementPreferencesEqual = (
  left: MeasurementPreferences,
  right: MeasurementPreferences,
): boolean =>
  left.pressure.lowSys === right.pressure.lowSys &&
  left.pressure.lowDia === right.pressure.lowDia &&
  left.pressure.elevatedSys === right.pressure.elevatedSys &&
  left.pressure.high1Sys === right.pressure.high1Sys &&
  left.pressure.high1Dia === right.pressure.high1Dia &&
  left.pressure.high2Sys === right.pressure.high2Sys &&
  left.pressure.high2Dia === right.pressure.high2Dia &&
  left.pressure.high3Sys === right.pressure.high3Sys &&
  left.pressure.high3Dia === right.pressure.high3Dia &&
  left.pulse.low === right.pulse.low &&
  left.pulse.high === right.pulse.high;

const classifyPressure = (
  sys: number,
  dia: number,
  pressurePrefs: PressurePreferences = defaultMeasurementPreferences.pressure,
): PressureCategory => {
  const { lowSys, lowDia, elevatedSys, high1Sys, high1Dia, high2Sys, high2Dia } = pressurePrefs;
  const normalDiaStart = Math.max(lowDia + 1, high1Dia - 5);

  if (sys >= high2Sys || dia >= high2Dia) return "high2";
  if (sys >= high1Sys || dia >= high1Dia) return "high1";
  if (sys < lowSys || dia < lowDia) return "low";
  if (sys >= elevatedSys || dia >= normalDiaStart) return "elevated";
  return "normal";
};

const classifyPulse = (pulse: number, pulsePrefs: PulsePreferences): PulseCategory => {
  if (pulse < pulsePrefs.low) return "low";
  if (pulse > pulsePrefs.high) return "high";
  return "normal";
};

const getCategoryLabel = (category: PressureCategory): string => {
  const labels = {
    normal: "Prawidłowe",
    elevated: "Prawidłowe",
    high1: "Wysokie prawidłowe",
    high2: "Nadciśnienie",
    low: "Niskie",
  };

  return labels[category];
};

const getPulseCategoryLabel = (category: PulseCategory): string => {
  const labels = {
    low: "Niski puls",
    normal: "Puls w normie",
    high: "Puls podwyższony",
  };

  return labels[category];
};

const getPulseCategoryColor = (category: PulseCategory): string => {
  const colors = {
    low: "var(--theme-info)",
    normal: "var(--theme-accent-muted)",
    high: "var(--theme-warning)",
  };

  return colors[category];
};

const oppositeArm = (arm: ArmSide): ArmSide => (arm === "left" ? "right" : "left");
const getPreferredArmFromHandedness = (dominantHand: Handedness): ArmSide => oppositeArm(dominantHand);
const getHandednessLabel = (hand: Handedness): string =>
  hand === "left" ? "Leworęczny / leworęczna" : "Praworęczny / praworęczna";
const getArmLabel = (arm: ArmSide): string => (arm === "left" ? "Lewa ręka" : "Prawa ręka");
const normalizeArmSide = (value: unknown, fallback: ArmSide): ArmSide =>
  value === "left" || value === "right" ? value : fallback;

const getCategoryStyles = (category: PressureCategory) => {
  const styles = {
    normal: {
      bg: "var(--theme-success-soft)",
      text: "var(--theme-success)",
      border: "var(--theme-success-border)",
    },
    elevated: {
      bg: "var(--theme-success-soft)",
      text: "var(--theme-success)",
      border: "var(--theme-success-border)",
    },
    high1: {
      bg: "var(--theme-warning-soft)",
      text: "var(--theme-warning)",
      border: "var(--theme-warning-border)",
    },
    high2: {
      bg: "var(--theme-danger-soft)",
      text: "var(--theme-danger)",
      border: "var(--theme-danger-border)",
    },
    low: {
      bg: "var(--theme-info-soft)",
      text: "var(--theme-info)",
      border: "var(--theme-info-border)",
    },
  };

  return styles[category];
};

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatValueOrDash = (value: unknown): string => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? "--" : String(Math.round(parsed));
};

const formatPercentOrDash = (value: unknown): string => {
  const parsed = toFiniteNumber(value);
  return parsed === null ? "--" : `${Math.round(parsed)}%`;
};

const formatPreciseValueOrDash = (value: unknown, digits = 1): string => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return "--";
  if (Number.isInteger(parsed)) return String(parsed);
  return parsed.toFixed(digits);
};

const formatDaysLabel = (days: number): string => {
  if (days === 1) return "1 dzień";
  return `${days} dni`;
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const keys = ["message", "error", "shortMessage", "details"] as const;

    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }

    for (const nestedKey of ["data", "cause", "response"] as const) {
      const nested = record[nestedKey];
      if (!nested || typeof nested !== "object") continue;
      const nestedRecord = nested as Record<string, unknown>;

      for (const key of keys) {
        const value = nestedRecord[key];
        if (typeof value === "string" && value.trim()) {
          return value;
        }
      }
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // ignore serialization errors
    }
  }

  return fallback;
};

const mapAppError = (error: unknown, fallback: string): string => {
  const lower = extractErrorMessage(error, fallback).toLowerCase();
  if (lower.includes("not authenticated")) {
    return "Sesja wygasła. Zaloguj się ponownie.";
  }
  if (lower.includes("invalid credentials")) {
    return "Nieprawidłowe dane logowania.";
  }
  if (lower.includes("must be different")) {
    return "Nowe hasło musi być inne niż obecne.";
  }
  if (lower.includes("missing password")) {
    return "Uzupełnij wszystkie pola hasła.";
  }
  if (lower.includes("account email missing")) {
    return "Brakuje adresu e-mail konta.";
  }
  if (lower.includes("password")) {
    return "Hasło musi mieć co najmniej 8 znaków.";
  }

  return fallback;
};

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const isValidDate = (date: Date): boolean => Number.isFinite(date.getTime());

const ensureLocalDate = (date: Date): Date => {
  return isValidDate(date) ? date : new Date();
};

const clampDateToNow = (date: Date, now: Date = new Date()): Date => {
  const safeDate = ensureLocalDate(date);
  const safeNow = ensureLocalDate(now);
  return safeDate.getTime() > safeNow.getTime() ? safeNow : safeDate;
};

const startOfLocalDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getRangeStart = (range: TimeRange, now: Date): Date | null => {
  const todayStart = startOfLocalDay(now);
  if (range === "all") return null;
  if (range === "7d") return addDays(todayStart, -6);
  if (range === "30d") return addDays(todayStart, -29);
  return addDays(todayStart, -89);
};

const getDisplayReadingValues = (reading: BloodPressureReading): DisplayReadingValues => {
  if (!reading.secondArm) {
    return {
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      pulse: reading.pulse,
    };
  }

  return {
    systolic: Math.round((reading.systolic + reading.secondArm.systolic) / 2),
    diastolic: Math.round((reading.diastolic + reading.secondArm.diastolic) / 2),
    pulse: Math.round((reading.pulse + reading.secondArm.pulse) / 2),
  };
};

const getTooltipIndexFromInteraction = (
  interaction: ChartInteractionState,
  pointsCount: number,
): number | null => {
  const raw = interaction.activeTooltipIndex;
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= pointsCount) {
    return null;
  }

  return Math.floor(parsed);
};

const trimmedMeanRounded = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trimEachSide = Math.min(2, Math.floor(sorted.length * 0.1));
  const core =
    trimEachSide > 0 && sorted.length - trimEachSide * 2 > 0
      ? sorted.slice(trimEachSide, sorted.length - trimEachSide)
      : sorted;
  const total = core.reduce((sum, value) => sum + value, 0);
  return Math.round(total / core.length);
};

const getAddMeasurementPrefill = (
  readings: BloodPressureReading[],
  now: Date,
): AddMeasurementPrefill => {
  if (readings.length === 0) {
    return {
      ...ADD_DEFAULTS,
      sampleCount: 0,
      source: "default",
    };
  }

  const windowStart = addDays(startOfLocalDay(now), -(PREFILL_LOOKBACK_DAYS - 1)).getTime();
  const recentWindowReadings = readings.filter((reading) => reading.timestamp.getTime() >= windowStart);

  const pool =
    recentWindowReadings.length >= PREFILL_MIN_RECENT_SAMPLE
      ? recentWindowReadings
      : readings.slice(0, Math.min(PREFILL_MAX_FALLBACK_SAMPLE, readings.length));

  const displayRows = pool.map(getDisplayReadingValues);
  const latestDisplay = getDisplayReadingValues(readings[0]);

  const rawSys = trimmedMeanRounded(displayRows.map((row) => row.systolic)) ?? latestDisplay.systolic;
  const rawDia = trimmedMeanRounded(displayRows.map((row) => row.diastolic)) ?? latestDisplay.diastolic;
  const rawPulse = trimmedMeanRounded(displayRows.map((row) => row.pulse)) ?? latestDisplay.pulse;

  const systolic = clamp(rawSys, 60, 250, ADD_DEFAULTS.systolic);
  const diastolicClamped = clamp(rawDia, 40, 150, ADD_DEFAULTS.diastolic);
  const pulse = clamp(rawPulse, 30, 200, ADD_DEFAULTS.pulse);
  const diastolic = Math.min(diastolicClamped, Math.max(40, systolic - 5));

  return {
    systolic,
    diastolic,
    pulse,
    sampleCount: pool.length,
    source: recentWindowReadings.length >= PREFILL_MIN_RECENT_SAMPLE ? "recent_10_days" : "recent_readings",
  };
};

const averageRounded = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
};

const standardDeviation = (values: number[]): number | null => {
  if (values.length === 0) return null;
  if (values.length === 1) return 0;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(1));
};

const formatSecondsToClock = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const toPdfSafeText = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const getDayStamp = (date: Date): number => startOfLocalDay(date).getTime();

const calculateStreak = (readings: BloodPressureReading[]) => {
  if (readings.length === 0) {
    return { current: 0, best: 0, hasTodayEntry: false };
  }

  const uniqueDayStampsDesc = Array.from(
    new Set(readings.map((reading) => getDayStamp(reading.timestamp)))
  ).sort((a, b) => b - a);

  const dayMs = 24 * 60 * 60 * 1000;
  const todayStamp = getDayStamp(new Date());
  const yesterdayStamp = todayStamp - dayMs;
  const newestDay = uniqueDayStampsDesc[0];
  const hasTodayEntry = newestDay === todayStamp;

  let current = 0;
  if (newestDay === todayStamp || newestDay === yesterdayStamp) {
    current = 1;
    for (let i = 1; i < uniqueDayStampsDesc.length; i += 1) {
      if (uniqueDayStampsDesc[i - 1] - uniqueDayStampsDesc[i] === dayMs) {
        current += 1;
      } else {
        break;
      }
    }
  }

  const uniqueDayStampsAsc = [...uniqueDayStampsDesc].sort((a, b) => a - b);
  let best = uniqueDayStampsAsc.length > 0 ? 1 : 0;
  let run = uniqueDayStampsAsc.length > 0 ? 1 : 0;
  for (let i = 1; i < uniqueDayStampsAsc.length; i += 1) {
    if (uniqueDayStampsAsc[i] - uniqueDayStampsAsc[i - 1] === dayMs) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }

  return { current, best, hasTodayEntry };
};

const getStreakGraphic = (
  current: number,
  hasTodayEntry: boolean,
): {
  icon: React.ElementType<{ className?: string; strokeWidth?: number; color?: string }>;
  alt: string;
  color: string;
  glow: string;
} => {
  if (current >= 30) {
    return {
      icon: Trophy,
      alt: "Trofeum passy",
      color: "var(--theme-warning)",
      glow: "var(--theme-warning-soft)",
    };
  }
  if (current >= 14) {
    return {
      icon: hasTodayEntry ? Flame : Sparkles,
      alt: "Wysoka passa",
      color: hasTodayEntry ? "var(--theme-warning)" : "var(--theme-info)",
      glow: hasTodayEntry ? "var(--theme-warning-soft)" : "var(--theme-info-soft)",
    };
  }
  if (current >= 7) {
    return {
      icon: Zap,
      alt: "Solidna passa",
      color: "var(--theme-info)",
      glow: "var(--theme-info-soft)",
    };
  }
  if (current >= 3) {
    return {
      icon: Star,
      alt: "Dobra passa",
      color: "var(--theme-success)",
      glow: "var(--theme-success-soft)",
    };
  }
  if (current >= 1) {
    return {
      icon: hasTodayEntry ? Flame : Sparkles,
      alt: "Początek passy",
      color: hasTodayEntry ? "var(--theme-warning)" : "var(--theme-accent-muted)",
      glow: hasTodayEntry ? "var(--theme-warning-soft)" : "var(--theme-accent-soft)",
    };
  }
  return {
    icon: Flame,
    alt: "Nowa passa",
    color: "var(--theme-info)",
    glow: "var(--theme-info-soft)",
  };
};

const getWelcomeLine = (name: string, loginCount: number) => {
  const firstName = name.trim().split(" ")[0] || "Użytkowniku";
  const variantsReturning = [
    `Witaj, ${firstName}`,
    `Dobrze Cię widzieć, ${firstName}`,
    `${firstName}, czas na kolejny pomiar`,
    `${firstName}, działamy dalej`,
    `${firstName}, wszystko gotowe`,
    `${firstName}, wracasz w dobrym rytmie`,
    `${firstName}, dobra robota z regularnością`,
    `${firstName}, jedziemy dalej`,
    `${firstName}, witaj ponownie`,
    `${firstName}, kolejny krok dla zdrowia`,
  ];
  const variantsNew = [
    `Witaj, ${firstName}`,
    `Cześć ${firstName}`,
    `${firstName}, zaczynamy Twoją historię`,
    `Miło Cię widzieć, ${firstName}`,
    `${firstName}, startujemy`,
  ];

  const variants = loginCount > 1 ? variantsReturning : variantsNew;
  const randomIndex = Math.floor(Math.random() * variants.length);
  return variants[randomIndex];
};

const toDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInput = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const mergeDateAndTime = (base: Date, datePart?: string, timePart?: string): Date => {
  const safeBase = ensureLocalDate(base);
  const dateValue = datePart ?? toDateInput(safeBase);
  const timeValue = timePart ?? toTimeInput(safeBase);
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return new Date(safeBase);
  }

  const next = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return isValidDate(next) ? next : new Date(safeBase);
};

const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const addMonths = (date: Date, months: number): Date => {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
};

interface CalendarDayCell {
  date: Date;
  inCurrentMonth: boolean;
}

const buildCalendarDays = (monthDate: Date): CalendarDayCell[] => {
  const monthStart = startOfMonth(monthDate);
  const firstDay = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -firstDay);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      inCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
};

const useMobileOverscrollLock = (containerRef: React.RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let startY = 0;
    let startX = 0;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      startY = event.touches[0]?.clientY ?? 0;
      startX = event.touches[0]?.clientX ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-allow-elastic-scroll='true']")) {
        return;
      }

      const currentY = event.touches[0]?.clientY ?? 0;
      const currentX = event.touches[0]?.clientX ?? 0;
      const deltaY = currentY - startY;
      const deltaX = Math.abs(currentX - startX);

      if (deltaX > Math.abs(deltaY)) {
        return;
      }

      const atTop = container.scrollTop <= 0;
      const atBottom = Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight;

      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault();
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, [containerRef]);
};

// Auth Components

const AuthScreen: React.FC<{
  view: AuthView;
  onChangeView: (view: AuthView) => void;
  theme: AppThemePalette;
}> = ({ view, onChangeView, theme }) => {
  const authScreenRef = useRef<HTMLDivElement>(null);
  useMobileOverscrollLock(authScreenRef);
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [dominantHand, setDominantHand] = useState<Handedness>("right");
  const [awaitsEmailVerification, setAwaitsEmailVerification] = useState(false);
  const [passwordResetStep, setPasswordResetStep] = useState<PasswordResetStep>("idle");
  const [passwordResetCode, setPasswordResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [verificationExpiresAtMs, setVerificationExpiresAtMs] = useState<number | null>(null);
  const [verificationResendReadyAtMs, setVerificationResendReadyAtMs] = useState<number | null>(null);
  const [resetCodeExpiresAtMs, setResetCodeExpiresAtMs] = useState<number | null>(null);
  const [resetCodeResendReadyAtMs, setResetCodeResendReadyAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const authRequestInFlightRef = useRef(false);
  const themeCssVars = useMemo(() => getThemeCssVars(theme), [theme]);
  const isLightTheme = isLightMonoTheme(theme.id);

  const normalizeEmail = (rawEmail: string) => rawEmail.trim().toLowerCase();
  const normalizeVerificationCode = (rawCode: string) => rawCode.replace(/\D/g, "").slice(0, 6);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isPasswordResetFlow = passwordResetStep !== "idle";
  const verificationSecondsLeft =
    verificationExpiresAtMs === null ? null : Math.max(0, Math.ceil((verificationExpiresAtMs - nowMs) / 1000));
  const verificationResendSecondsLeft =
    verificationResendReadyAtMs === null ? 0 : Math.max(0, Math.ceil((verificationResendReadyAtMs - nowMs) / 1000));
  const resetCodeSecondsLeft =
    resetCodeExpiresAtMs === null ? null : Math.max(0, Math.ceil((resetCodeExpiresAtMs - nowMs) / 1000));
  const resetResendSecondsLeft =
    resetCodeResendReadyAtMs === null ? 0 : Math.max(0, Math.ceil((resetCodeResendReadyAtMs - nowMs) / 1000));
  const canResendVerificationCode = verificationResendSecondsLeft === 0 && !isLoading;
  const canResendResetCode = resetResendSecondsLeft === 0 && !isLoading;

  useEffect(() => {
    if (!awaitsEmailVerification && passwordResetStep !== "verify") {
      return;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [awaitsEmailVerification, passwordResetStep]);

  const mapAuthError = (message: string, fallback: string) => {
    const lower = message.toLowerCase();
    const normalized = lower.replace(/\s+/g, " ");

    if (
      normalized.includes("invalidsecret") ||
      normalized.includes("invalid secret") ||
      normalized.includes("incorrect password") ||
      normalized.includes("invalid password")
    ) {
      return "Błędne hasło.";
    }
    if (
      normalized.includes("invalidaccountid") ||
      normalized.includes("invalid account id") ||
      normalized.includes("nie znaleziono konta") ||
      normalized.includes("no account")
    ) {
      return "Nie znaleziono konta z tym adresem e-mail.";
    }
    if (normalized.includes("toomanyfailedattempts")) {
      return "Za dużo nieudanych prób. Spróbuj ponownie za chwilę.";
    }
    if (
      normalized.includes("invalid code") ||
      normalized.includes("could not verify code") ||
      normalized.includes("invalid verification") ||
      (normalized.includes("kod") && normalized.includes("wygas"))
    ) {
      return "Kod jest nieprawidłowy albo wygasł.";
    }
    if (normalized.includes("password reset is not enabled")) {
      return "Reset hasła jest chwilowo niedostępny.";
    }
    if (normalized.includes("missing `newpassword`")) {
      return "Podaj nowe hasło.";
    }
    if (normalized.includes("missing `password`")) {
      return "Podaj hasło.";
    }
    if (normalized.includes("hasła nie są takie same") || normalized.includes("nowe hasła nie są takie same")) {
      return "Hasła nie są takie same.";
    }
    if (normalized.includes("co najmniej 8 znaków")) {
      return "Hasło musi mieć co najmniej 8 znaków.";
    }
    if (normalized.includes("podaj 6-cyfrowy kod")) {
      return "Podaj 6-cyfrowy kod.";
    }
    if (normalized.includes("podaj kod potwierdzający")) {
      return "Podaj 6-cyfrowy kod potwierdzający.";
    }
    if (normalized.includes("choose whether you are left") || normalized.includes("wybierz czy jesteś lewo")) {
      return "Wybierz, czy jesteś lewo- czy praworęczny/a.";
    }
    if (
      normalized.includes("already exists") ||
      normalized.includes("already registered") ||
      (normalized.includes("account") && normalized.includes("exists"))
    ) {
      return "Konto z tym e-mailem już istnieje. Zaloguj się.";
    }
    if (
      normalized.includes("verify a domain at resend.com/domains") ||
      normalized.includes("resend nie jest gotowy produkcyjnie")
    ) {
      return "Konfiguracja e-mail jest niekompletna. Zweryfikuj domenę nadawcy.";
    }
    if (
      normalized.includes("smtp_send_failed") ||
      normalized.includes("incorrect authentication data") ||
      normalized.includes("invalid login: 535")
    ) {
      return "Błąd SMTP. Sprawdź login i hasło skrzynki nadawczej.";
    }
    if (normalized.includes("invalid email") || normalized.includes("podaj poprawny adres")) {
      return "Podaj poprawny adres e-mail.";
    }
    if (normalized.includes("failed to fetch") || normalized.includes("network")) {
      return "Brak połączenia z serwerem. Sprawdź internet.";
    }
    if (lower.includes("invalid credentials")) {
      return "Nieprawidłowy email lub hasło.";
    }
    if (lower.includes("invalidsecret")) {
      return "Nieprawidłowe hasło.";
    }
    if (lower.includes("invalidaccountid") || lower.includes("invalid account id")) {
      return "Nie znaleziono konta dla tego adresu e-mail.";
    }
    if (lower.includes("toomanyfailedattempts")) {
      return "Za dużo nieudanych prób logowania. Spróbuj ponownie za chwilę.";
    }
    if (lower.includes("not found") || lower.includes("no account")) {
      return "Nie znaleziono konta z tym adresem e-mail.";
    }
    if (lower.includes("password") && lower.includes("least")) {
      return "Hasło musi mieć co najmniej 8 znaków.";
    }
    if (
      lower.includes("invalid code") ||
      lower.includes("invalid verification") ||
      lower.includes("could not verify code") ||
      lower.includes("kod") && lower.includes("wygas")
    ) {
      return "Kod jest nieprawidłowy albo wygasł.";
    }
    if (lower.includes("email verification")) {
      return "Najpierw potwierdź adres e-mail kodem z wiadomości.";
    }
    if (lower.includes("resend nie jest gotowy produkcyjnie")) {
      return "Konfiguracja e-mail jest niekompletna. Zweryfikuj domenę nadawcy.";
    }
    if (lower.includes("verify a domain at resend.com/domains")) {
      return "Konfiguracja e-mail jest niekompletna. Zweryfikuj domenę nadawcy.";
    }
    if (
      lower.includes("smtp_send_failed") ||
      lower.includes("incorrect authentication data") ||
      lower.includes("invalid login: 535")
    ) {
      return "Błąd SMTP. Sprawdź login i hasło skrzynki nadawczej.";
    }
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Brak połączenia z serwerem. Sprawdź internet.";
    }
    if (lower.includes("server error")) {
      return "Błąd serwera autoryzacji. Spróbuj ponownie za chwilę.";
    }
    return fallback;
  };

  const clearAuthFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const startEmailVerificationWindow = (message: string) => {
    const now = Date.now();
    setNowMs(now);
    setVerificationExpiresAtMs(now + OTP_CODE_VALIDITY_SECONDS * 1000);
    setVerificationResendReadyAtMs(now + OTP_RESEND_COOLDOWN_SECONDS * 1000);
    setSuccess(message);
  };

  const clearEmailVerificationWindow = () => {
    setVerificationCode("");
    setVerificationExpiresAtMs(null);
    setVerificationResendReadyAtMs(null);
  };

  const startResetCodeWindow = (message: string) => {
    const now = Date.now();
    setNowMs(now);
    setResetCodeExpiresAtMs(now + OTP_CODE_VALIDITY_SECONDS * 1000);
    setResetCodeResendReadyAtMs(now + OTP_RESEND_COOLDOWN_SECONDS * 1000);
    setSuccess(message);
  };

  const resetPasswordResetState = () => {
    setPasswordResetStep("idle");
    setPasswordResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetCodeExpiresAtMs(null);
    setResetCodeResendReadyAtMs(null);
  };

  const startPasswordReset = () => {
    clearAuthFeedback();
    setAwaitsEmailVerification(false);
    clearEmailVerificationWindow();
    setPasswordResetStep("request");
    setPassword("");
    setConfirmPassword("");
  };

  const stopPasswordReset = () => {
    clearAuthFeedback();
    resetPasswordResetState();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authRequestInFlightRef.current) {
      return;
    }

    authRequestInFlightRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const cleanEmail = normalizeEmail(email);
      if (!emailPattern.test(cleanEmail)) {
        throw new Error("Podaj poprawny adres e-mail.");
      }

      if (!password || password.length < 8) {
        throw new Error("Hasło musi mieć co najmniej 8 znaków.");
      }

      if (view === "signup" && password !== confirmPassword) {
        throw new Error("Hasła nie są takie same.");
      }

      const formData = new FormData();
      formData.append("email", cleanEmail);
      formData.append("password", password);
      formData.append("flow", view === "signup" ? "signUp" : "signIn");
      if (view === "signup" && name.trim()) {
        formData.append("name", name.trim());
      }
      if (view === "signup") {
        formData.append("dominantHand", dominantHand);
      }

      const result = await signIn("password", formData);
      if (result.signingIn) {
        resetPasswordResetState();
        setAwaitsEmailVerification(false);
        clearEmailVerificationWindow();
        setSuccess(view === "signup" ? "Konto utworzone. Jesteś zalogowany." : "Zalogowano pomyślnie.");
      } else {
        setAwaitsEmailVerification(true);
        resetPasswordResetState();
        startEmailVerificationWindow(
          view === "signup"
            ? "Wysłaliśmy kod potwierdzający na Twój email."
            : "Hasło poprawne. Wysłaliśmy kod potwierdzający na Twój email.",
        );
      }
    } catch (err) {
      const rawError = extractErrorMessage(err, "Wystąpił błąd logowania.");
      const mappedError = mapAuthError(rawError, "Nie udało się zalogować.");
      setError(mappedError);
      if (view === "signup" && mappedError.includes("już istnieje")) {
        onChangeView("login");
      }
    } finally {
      authRequestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authRequestInFlightRef.current) {
      return;
    }

    authRequestInFlightRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const cleanEmail = normalizeEmail(email);
      const cleanVerificationCode = normalizeVerificationCode(verificationCode);
      if (!emailPattern.test(cleanEmail)) {
        throw new Error("Podaj poprawny adres e-mail.");
      }
      if (cleanVerificationCode.length !== 6) {
        throw new Error("Podaj kod potwierdzający.");
      }
      if (verificationSecondsLeft !== null && verificationSecondsLeft <= 0) {
        throw new Error("Kod wygasł. Wyślij nowy kod.");
      }

      const formData = new FormData();
      formData.append("email", cleanEmail);
      formData.append("flow", "email-verification");
      formData.append("code", cleanVerificationCode);

      const result = await signIn("password", formData);
      if (result.signingIn) {
        setAwaitsEmailVerification(false);
        clearEmailVerificationWindow();
        setSuccess("Adres e-mail został potwierdzony. Jesteś zalogowany.");
      } else {
        throw new Error("Kod potwierdzający jest nieprawidłowy lub wygasł.");
      }
    } catch (err) {
      const rawError = extractErrorMessage(err, "Nie udało się potwierdzić adresu e-mail.");
      setError(mapAuthError(rawError, "Nie udało się potwierdzić kodu."));
    } finally {
      authRequestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleResendEmailVerificationCode = async () => {
    if (verificationResendSecondsLeft > 0) {
      setError(`Nowy kod możesz wysłać za ${formatSecondsToClock(verificationResendSecondsLeft)}.`);
      return;
    }
    if (authRequestInFlightRef.current || !canResendVerificationCode) {
      return;
    }

    authRequestInFlightRef.current = true;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const cleanEmail = normalizeEmail(email);
      if (!emailPattern.test(cleanEmail)) {
        throw new Error("Podaj poprawny adres e-mail.");
      }

      const formData = new FormData();
      formData.append("email", cleanEmail);
      formData.append("password", password);
      formData.append("flow", view === "signup" ? "signUp" : "signIn");
      if (view === "signup" && name.trim()) {
        formData.append("name", name.trim());
      }
      if (view === "signup") {
        formData.append("dominantHand", dominantHand);
      }

      await signIn("password", formData);
      startEmailVerificationWindow("Wysłaliśmy nowy kod potwierdzający.");
    } catch (err) {
      const rawError = extractErrorMessage(err, "Nie udało się wysłać nowego kodu.");
      setError(mapAuthError(rawError, "Nie udało się wysłać nowego kodu."));
    } finally {
      authRequestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authRequestInFlightRef.current) {
      return;
    }

    authRequestInFlightRef.current = true;
    clearAuthFeedback();
    setIsLoading(true);

    try {
      const cleanEmail = normalizeEmail(email);
      if (!emailPattern.test(cleanEmail)) {
        throw new Error("Podaj poprawny adres e-mail.");
      }

      const formData = new FormData();
      formData.append("email", cleanEmail);
      formData.append("flow", "reset");
      await signIn("password", formData);

      setPasswordResetStep("verify");
      setPasswordResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      startResetCodeWindow("Wysłaliśmy kod resetu hasła na Twój email.");
    } catch (err) {
      const rawError = extractErrorMessage(err, "Nie udało się rozpocząć resetu hasła.");
      setError(mapAuthError(rawError, "Nie udało się wysłać kodu resetu."));
    } finally {
      authRequestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleResendPasswordResetCode = async () => {
    if (resetResendSecondsLeft > 0) {
      setError(`Nowy kod możesz wysłać za ${formatSecondsToClock(resetResendSecondsLeft)}.`);
      return;
    }
    if (authRequestInFlightRef.current) {
      return;
    }

    authRequestInFlightRef.current = true;
    clearAuthFeedback();
    setIsLoading(true);

    try {
      const cleanEmail = normalizeEmail(email);
      if (!emailPattern.test(cleanEmail)) {
        throw new Error("Podaj poprawny adres e-mail.");
      }

      const formData = new FormData();
      formData.append("email", cleanEmail);
      formData.append("flow", "reset");
      await signIn("password", formData);

      setPasswordResetStep("verify");
      startResetCodeWindow("Wysłaliśmy nowy kod resetu hasła.");
    } catch (err) {
      const rawError = extractErrorMessage(err, "Nie udało się wysłać nowego kodu resetu.");
      setError(mapAuthError(rawError, "Nie udało się wysłać nowego kodu resetu."));
    } finally {
      authRequestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handlePasswordResetVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authRequestInFlightRef.current) {
      return;
    }

    authRequestInFlightRef.current = true;
    clearAuthFeedback();
    setIsLoading(true);

    try {
      const cleanEmail = normalizeEmail(email);
      const cleanCode = normalizeVerificationCode(passwordResetCode);
      if (!emailPattern.test(cleanEmail)) {
        throw new Error("Podaj poprawny adres e-mail.");
      }
      if (cleanCode.length !== 6) {
        throw new Error("Podaj 6-cyfrowy kod resetu.");
      }
      if (resetCodeSecondsLeft !== null && resetCodeSecondsLeft <= 0) {
        throw new Error("Kod resetu wygasł. Wyślij nowy kod.");
      }
      if (!newPassword || newPassword.length < 8) {
        throw new Error("Nowe hasło musi mieć co najmniej 8 znaków.");
      }
      if (newPassword !== confirmNewPassword) {
        throw new Error("Nowe hasła nie są takie same.");
      }

      const formData = new FormData();
      formData.append("email", cleanEmail);
      formData.append("flow", "reset-verification");
      formData.append("code", cleanCode);
      formData.append("newPassword", newPassword);

      const result = await signIn("password", formData);
      if (!result.signingIn) {
        throw new Error("Kod resetu jest nieprawidłowy lub wygasł.");
      }

      resetPasswordResetState();
      setAwaitsEmailVerification(false);
      clearEmailVerificationWindow();
      setSuccess("Hasło zostało zmienione. Jesteś zalogowany.");
    } catch (err) {
      const rawError = extractErrorMessage(err, "Nie udało się zresetować hasła.");
      setError(mapAuthError(rawError, "Nie udało się ustawić nowego hasła."));
    } finally {
      authRequestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={authScreenRef}
      className={`h-[100dvh] overflow-y-auto overscroll-none touch-pan-y flex items-center justify-center p-4 relative ${isLightTheme ? "theme-mono-light" : ""}`}
      style={{
        ...themeCssVars,
        backgroundColor: "var(--theme-bg)",
      }}
    >
      <BackgroundPaths />
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "var(--theme-accent-soft)" }}
          >
            <Heart className="w-10 h-10" style={{ color: "var(--theme-heart)" }} />
          </div>
        </div>

        <div
          className="rounded-3xl p-6"
          style={{
            background: "var(--theme-card-bg)",
            backdropFilter: "blur(15px) saturate(132%)",
            WebkitBackdropFilter: "blur(15px) saturate(132%)",
            border: "1px solid var(--theme-card-border)",
            boxShadow: "var(--theme-card-shadow)",
          }}
        >
          <h1 className="text-3xl font-bold text-white text-center mb-1">
            {awaitsEmailVerification
              ? "Potwierdź e-mail"
              : passwordResetStep === "request"
              ? "Reset hasła"
              : passwordResetStep === "verify"
              ? "Potwierdź kod resetu"
              : view === "signup"
              ? "Rejestracja"
              : "Logowanie"}
          </h1>
          <p className="text-center text-white/55 text-sm mb-6">
            {awaitsEmailVerification
              ? `Kod wysłaliśmy na ${normalizeEmail(email)}`
              : passwordResetStep === "request"
              ? "Podaj e-mail. Wyślemy kod do ustawienia nowego hasła."
              : passwordResetStep === "verify"
              ? `Wpisz kod z ${normalizeEmail(email)} i ustaw nowe hasło.`
              : view === "signup"
              ? "Utwórz konto raz i korzystaj na tym urządzeniu bez ponownego logowania."
              : "Zaloguj się raz, a sesja zostanie zapamiętana na tym urządzeniu."}
          </p>

          {awaitsEmailVerification && (
            <div
              className="mb-4 rounded-2xl border px-3 py-2.5 text-center"
              style={{
                borderColor: "var(--theme-success-border)",
                background: "var(--theme-success-soft)",
              }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--theme-success)" }}>
                Email z kodem został wysłany.
              </p>
              <p className="text-white/75 text-xs mt-1">
                Kod wygasa za {formatSecondsToClock(verificationSecondsLeft ?? OTP_CODE_VALIDITY_SECONDS)}
              </p>
            </div>
          )}

          {passwordResetStep === "verify" && (
            <div
              className="mb-4 rounded-2xl border px-3 py-2.5 text-center"
              style={{
                borderColor: "var(--theme-accent-border)",
                background: "var(--theme-accent-soft)",
              }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--theme-accent-muted)" }}>
                Kod resetu został wysłany.
              </p>
              <p className="text-white/75 text-xs mt-1">
                Kod wygasa za {formatSecondsToClock(resetCodeSecondsLeft ?? OTP_CODE_VALIDITY_SECONDS)}
              </p>
            </div>
          )}

          {!awaitsEmailVerification && !isPasswordResetFlow ? (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {view === "signup" && (
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Nazwa</Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)]"
                    placeholder="Twoje imię"
                  />
                </div>
              )}

              {view === "signup" && (
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Ręka dominująca</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["right", "left"] as Handedness[]).map((hand) => {
                      const isSelected = dominantHand === hand;
                      return (
                        <button
                          key={hand}
                          type="button"
                          onClick={() => setDominantHand(hand)}
                          className="h-11 rounded-xl border text-sm font-medium transition-colors"
                          style={{
                            borderColor: isSelected
                              ? "var(--theme-accent-border)"
                              : isLightTheme
                                ? "rgba(0,0,0,0.16)"
                                : "rgba(255,255,255,0.12)",
                            background: isSelected
                              ? "var(--theme-accent-soft)"
                              : isLightTheme
                                ? "rgba(0,0,0,0.04)"
                                : "rgba(255,255,255,0.04)",
                            color: isSelected
                              ? "var(--theme-accent-muted)"
                              : isLightTheme
                                ? "rgba(22,22,22,0.78)"
                                : "rgba(255,255,255,0.78)",
                          }}
                        >
                          {hand === "right" ? "Praworęczny/a" : "Leworęczny/a"}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-white/40 text-xs mt-2">
                    Domyślna ręka pomiarowa: {getArmLabel(getPreferredArmFromHandedness(dominantHand))}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-white/55 text-sm mb-2 block">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)]"
                  placeholder="twoj@email.pl"
                  required
                />
              </div>

              <div>
                <Label className="text-white/55 text-sm mb-2 block">Hasło</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)]"
                  placeholder="Minimum 8 znaków"
                  required
                />
              </div>

              {view === "signup" && (
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Powtórz hasło</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)]"
                    placeholder="Powtórz hasło"
                    required
                  />
                </div>
              )}

              <LiquidButton
                type="submit"
                className="w-full"
                variant="default"
                disabled={isLoading}
              >
                {isLoading
                  ? "Przetwarzanie..."
                  : view === "signup"
                  ? "Zarejestruj i zaloguj"
                  : "Zaloguj się"}
              </LiquidButton>

              <button
                type="button"
                onClick={() => {
                  clearAuthFeedback();
                  setAwaitsEmailVerification(false);
                  clearEmailVerificationWindow();
                  resetPasswordResetState();
                  onChangeView(view === "login" ? "signup" : "login");
                }}
                className="w-full text-center text-white/55 text-sm hover:text-white/75 transition-colors"
              >
                {view === "login"
                  ? "Nie masz konta? Zarejestruj się"
                  : "Masz już konto? Przejdź do logowania"}
              </button>

              {view === "login" && (
                <button
                  type="button"
                  onClick={startPasswordReset}
                  className="w-full text-center text-white/55 text-sm hover:text-white/75 transition-colors"
                >
                  Nie pamiętasz hasła? Odzyskaj hasło
                </button>
              )}
            </form>
          ) : isPasswordResetFlow ? (
            passwordResetStep === "request" ? (
              <form onSubmit={handlePasswordResetRequest} className="space-y-4">
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)]"
                    placeholder="twoj@email.pl"
                    required
                  />
                </div>

                <LiquidButton
                  type="submit"
                  className="w-full"
                  variant="default"
                  disabled={isLoading}
                >
                  {isLoading ? "Wysyłanie..." : "Wyślij kod resetu"}
                </LiquidButton>

                <button
                  type="button"
                  className="w-full text-center text-white/55 text-sm hover:text-white/75 transition-colors"
                  onClick={stopPasswordReset}
                >
                  Wróć do logowania
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordResetVerification} className="space-y-4">
                <p className="text-center text-xs text-white/45">{normalizeEmail(email)}</p>

                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Kod resetu</Label>
                  <Input
                    type="text"
                    value={passwordResetCode}
                    onChange={(e) => setPasswordResetCode(normalizeVerificationCode(e.target.value))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)] tracking-[0.3em] text-center uppercase"
                    placeholder="123456"
                    maxLength={6}
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Nowe hasło</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)]"
                    placeholder="Minimum 8 znaków"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Powtórz nowe hasło</Label>
                  <Input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)]"
                    placeholder="Powtórz nowe hasło"
                    required
                  />
                </div>

                <LiquidButton
                  type="submit"
                  className="w-full"
                  variant="default"
                  disabled={isLoading}
                >
                  {isLoading ? "Zapisywanie..." : "Ustaw nowe hasło"}
                </LiquidButton>

                <button
                  type="button"
                  className="w-full text-center text-white/55 text-sm hover:text-white/75 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={handleResendPasswordResetCode}
                  disabled={!canResendResetCode}
                >
                  {canResendResetCode
                    ? "Wyślij nowy kod resetu"
                    : `Wyślij ponownie za ${formatSecondsToClock(resetResendSecondsLeft)}`}
                </button>

                <button
                  type="button"
                  className="w-full text-center text-white/55 text-sm hover:text-white/75 transition-colors"
                  onClick={stopPasswordReset}
                >
                  Wróć do logowania
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleVerifyEmailCode} className="space-y-4">
              <div>
                <Label className="text-white/55 text-sm mb-2 block">Kod potwierdzający</Label>
                <Input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(normalizeVerificationCode(e.target.value))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[var(--theme-accent)] tracking-[0.3em] text-center uppercase"
                  placeholder="123456"
                  maxLength={6}
                  required
                />
              </div>

              <LiquidButton
                type="submit"
                className="w-full"
                variant="default"
                disabled={isLoading}
              >
                {isLoading ? "Weryfikowanie..." : "Potwierdź kod"}
              </LiquidButton>

              <button
                type="button"
                className="w-full text-center text-white/55 text-sm hover:text-white/75 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleResendEmailVerificationCode}
                disabled={!canResendVerificationCode}
              >
                {canResendVerificationCode
                  ? "Wyślij kod ponownie"
                  : `Wyślij ponownie za ${formatSecondsToClock(verificationResendSecondsLeft)}`}
              </button>

              <button
                type="button"
                className="w-full text-center text-white/55 text-sm hover:text-white/75 transition-colors"
                onClick={() => {
                  setAwaitsEmailVerification(false);
                  clearEmailVerificationWindow();
                  clearAuthFeedback();
                }}
              >
                Wróć do formularza
              </button>
            </form>
          )}

          {error && (
            <p className="mt-4 text-sm text-center" style={{ color: "var(--theme-warning)" }}>
              {error}
            </p>
          )}

          {success && (
            <p className="mt-4 text-sm text-center" style={{ color: "var(--theme-success)" }}>
              {success}
            </p>
          )}

        </div>
      </div>
    </div>
  );
};

// Main UI Components

let sharedPickerAudioContext: AudioContext | null = null;

const getSharedPickerAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const WebAudioContext =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!WebAudioContext) return null;

  if (!sharedPickerAudioContext) {
    sharedPickerAudioContext = new WebAudioContext();
  }

  return sharedPickerAudioContext;
};

const unlockSharedPickerAudio = () => {
  const ctx = getSharedPickerAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {
      // Ignorujemy ograniczenia autoodtwarzania - dźwięk jest opcjonalny.
    });
  }
};

const ScrollPicker: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
  isLightTheme?: boolean;
}> = ({ value, onChange, min, max, label, isLightTheme = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPlayedValueRef = useRef<number | null>(null);
  const lastPlayAtRef = useRef(0);
  const hasUserInteractedRef = useRef(false);
  const inertiaRafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const stableFramesRef = useRef(0);
  const shouldSnapAfterReleaseRef = useRef(false);
  const isInteractingRef = useRef(false);
  const values = useMemo(() => Array.from({ length: max - min + 1 }, (_, i) => min + i), [max, min]);
  const itemHeight = 56;
  const containerHeight = 240;
  const spacerHeight = (containerHeight - itemHeight) / 2;
  const [internalValue, setInternalValue] = useState(value);
  const nearOpacity = isLightTheme ? 0.66 : 0.55;
  const farOpacity = isLightTheme ? 0.3 : 0.2;
  const pickerValueColor = isLightTheme ? "rgba(16,16,16,0.88)" : "#FFFFFF";
  const pickerOverlayBorder = isLightTheme ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.12)";
  const pickerOverlayBg = isLightTheme ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.04)";

  const playSelectionSound = (nextValue: number) => {
    if (lastPlayedValueRef.current === nextValue) return;

    const now = performance.now();
    if (now - lastPlayAtRef.current < 40) return;
    const ctx = getSharedPickerAudioContext();
    if (!ctx) return;
    if (ctx.state !== "running") {
      void ctx
        .resume()
        .then(() => playSelectionSound(nextValue))
        .catch(() => {
          // Brak dźwięku nie blokuje działania scroll pickera.
        });
      return;
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const normalizedRange = Math.max(1, max - min);
      const position = (nextValue - min) / normalizedRange;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(520 + position * 120, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);

      lastPlayAtRef.current = now;
      lastPlayedValueRef.current = nextValue;
    } catch {
      // Audio jest opcjonalne, ignorujemy błędy urządzenia/przeglądarki.
    }
  };

  const getNearestIndex = (scrollTop: number) => {
    const rawIndex = Math.round(scrollTop / itemHeight);
    return Math.max(0, Math.min(values.length - 1, rawIndex));
  };

  const scrollToValue = (targetValue: number, behavior: ScrollBehavior = "auto") => {
    if (!containerRef.current) return;
    const index = values.indexOf(targetValue);
    if (index < 0) return;
    containerRef.current.scrollTo({
      top: index * itemHeight,
      behavior,
    });
  };

  const snapToClosest = (behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) return;
    const index = getNearestIndex(containerRef.current.scrollTop);
    const snappedValue = values[index];
    const targetTop = index * itemHeight;
    const distance = Math.abs(containerRef.current.scrollTop - targetTop);

    if (distance < 1.5 || behavior === "auto") {
      containerRef.current.scrollTop = targetTop;
    } else {
      containerRef.current.scrollTo({ top: targetTop, behavior });
    }

    if (snappedValue !== undefined) {
      setInternalValue(snappedValue);
      playSelectionSound(snappedValue);
      if (snappedValue !== value) {
        onChange(snappedValue);
      }
    }
  };

  useEffect(() => {
    setInternalValue(value);
    if (!isInteractingRef.current) {
      scrollToValue(value, "auto");
    }
  }, [value, values]);

  useEffect(() => {
    return () => {
      if (inertiaRafRef.current !== null) {
        window.cancelAnimationFrame(inertiaRafRef.current);
      }
    };
  }, []);

  const startInertiaWatcher = () => {
    if (!containerRef.current) return;
    if (isInteractingRef.current || !shouldSnapAfterReleaseRef.current) return;

    if (inertiaRafRef.current !== null) {
      window.cancelAnimationFrame(inertiaRafRef.current);
    }

    stableFramesRef.current = 0;
    lastScrollTopRef.current = containerRef.current.scrollTop;

    const tick = () => {
      if (!containerRef.current) {
        inertiaRafRef.current = null;
        return;
      }

      const current = containerRef.current.scrollTop;
      const delta = Math.abs(current - lastScrollTopRef.current);
      lastScrollTopRef.current = current;

      if (delta < 0.12) {
        stableFramesRef.current += 1;
      } else {
        stableFramesRef.current = 0;
      }

      if (stableFramesRef.current >= 8) {
        snapToClosest("smooth");
        shouldSnapAfterReleaseRef.current = false;
        inertiaRafRef.current = null;
        return;
      }

      inertiaRafRef.current = window.requestAnimationFrame(tick);
    };

    inertiaRafRef.current = window.requestAnimationFrame(tick);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const index = getNearestIndex(scrollTop);
    const newValue = values[index];

    if (newValue !== undefined && newValue !== value) {
      setInternalValue(newValue);
      if (hasUserInteractedRef.current) {
        playSelectionSound(newValue);
      }
    }

    if (!isInteractingRef.current && shouldSnapAfterReleaseRef.current && inertiaRafRef.current === null) {
      startInertiaWatcher();
    }
  };

  const handleInteractionStart = () => {
    hasUserInteractedRef.current = true;
    isInteractingRef.current = true;
    shouldSnapAfterReleaseRef.current = false;
    unlockSharedPickerAudio();
    if (containerRef.current) {
      // Przerywa ewentualny trwający smooth snap, żeby od razu oddać kontrolę palcu.
      containerRef.current.scrollTo({ top: containerRef.current.scrollTop, behavior: "auto" });
    }
    if (inertiaRafRef.current !== null) {
      window.cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  };

  const handleInteractionEnd = () => {
    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;
    shouldSnapAfterReleaseRef.current = true;
    startInertiaWatcher();
  };

  const handleWheel = () => {
    hasUserInteractedRef.current = true;
    shouldSnapAfterReleaseRef.current = true;
    unlockSharedPickerAudio();
    startInertiaWatcher();
  };

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <div className="text-white/55 text-sm mb-2 font-medium">{label}</div>
      <div className="relative h-[240px] w-full max-w-[96px]">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onTouchStart={handleInteractionStart}
          onTouchEnd={handleInteractionEnd}
          onTouchCancel={handleInteractionEnd}
          onMouseDown={handleInteractionStart}
          onMouseUp={handleInteractionEnd}
          onMouseLeave={handleInteractionEnd}
          onWheel={handleWheel}
          data-allow-elastic-scroll="true"
          className="h-full overflow-y-scroll overscroll-none scrollbar-hide"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}
        >
          <div style={{ height: spacerHeight }} />
          {values.map((val) => (
            <div
              key={val}
              className="flex items-center justify-center transition-[opacity,transform,color] duration-120 ease-out"
              style={{
                height: itemHeight,
                fontSize: "36px",
                opacity: val === internalValue ? 1 : val >= internalValue - 1 && val <= internalValue + 1 ? nearOpacity : farOpacity,
                fontWeight: val === internalValue ? 650 : 420,
                lineHeight: 1.06,
                letterSpacing: "0em",
                transform:
                  val === internalValue
                    ? "scale(1)"
                    : val >= internalValue - 1 && val <= internalValue + 1
                      ? "scale(0.86)"
                      : "scale(0.7)",
                color: pickerValueColor,
                fontVariantNumeric: "tabular-nums lining-nums",
                WebkitFontSmoothing: "antialiased",
                textRendering: "auto",
              }}
            >
              {val}
            </div>
          ))}
          <div style={{ height: spacerHeight }} />
        </div>

        <div
          className="absolute top-1/2 left-1 right-1 h-14 -translate-y-1/2 pointer-events-none border-y rounded-xl"
          style={{
            borderColor: pickerOverlayBorder,
            background: pickerOverlayBg,
          }}
        />
      </div>
    </div>
  );
};

const CategoryBadge: React.FC<{ category: PressureCategory }> = ({ category }) => {
  const styles = getCategoryStyles(category);

  return (
    <div
      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap leading-none"
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        border: `1px solid ${styles.border}`,
      }}
    >
      {getCategoryLabel(category)}
    </div>
  );
};

const SWIPE_REVEAL_OFFSET = -96;
const SWIPE_OPEN_THRESHOLD = -56;
const SWIPE_GESTURE_THRESHOLD = 6;

const SwipeDeleteCard: React.FC<{
  onRequestDelete: () => void;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onRequestDelete, isOpen, onOpenChange, disabled = false, children }) => {
  const [offsetX, setOffsetX] = useState(isOpen ? SWIPE_REVEAL_OFFSET : 0);
  const [isDragging, setIsDragging] = useState(false);
  const axisRef = useRef<"x" | "y" | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const currentOffsetRef = useRef(isOpen ? SWIPE_REVEAL_OFFSET : 0);

  useEffect(() => {
    if (isDragging) return;
    const nextOffset = isOpen ? SWIPE_REVEAL_OFFSET : 0;
    currentOffsetRef.current = nextOffset;
    setOffsetX(nextOffset);
  }, [isOpen, isDragging]);

  const releasePointer = (target: HTMLDivElement) => {
    const pointerId = pointerIdRef.current;
    if (pointerId === null) return;
    try {
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // ignore cross-browser release errors
    }
    pointerIdRef.current = null;
  };

  const finishSwipe = (target: HTMLDivElement) => {
    releasePointer(target);
    setIsDragging(false);
    axisRef.current = null;
    const nextOpen = currentOffsetRef.current <= SWIPE_OPEN_THRESHOLD;
    const nextOffset = nextOpen ? SWIPE_REVEAL_OFFSET : 0;
    onOpenChange(nextOpen);
    currentOffsetRef.current = nextOffset;
    setOffsetX(nextOffset);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, [role='button'], [data-no-swipe='true']")) {
      return;
    }
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    axisRef.current = null;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    startOffsetRef.current = isOpen ? SWIPE_REVEAL_OFFSET : offsetX;
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;

    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;

    if (axisRef.current === null) {
      if (
        Math.abs(deltaX) < SWIPE_GESTURE_THRESHOLD &&
        Math.abs(deltaY) < SWIPE_GESTURE_THRESHOLD
      ) {
        return;
      }
      axisRef.current = Math.abs(deltaX) > Math.abs(deltaY) + 3 ? "x" : "y";
    }

    if (axisRef.current !== "x") return;

    event.preventDefault();
    const nextOffset = Math.max(
      SWIPE_REVEAL_OFFSET,
      Math.min(0, startOffsetRef.current + deltaX),
    );
    currentOffsetRef.current = nextOffset;
    setOffsetX(nextOffset);
  };

  const reveal = Math.min(1, Math.abs(offsetX) / Math.abs(SWIPE_REVEAL_OFFSET));
  const backdropOpacity = Math.max(0, reveal - 0.03) * 1.1;

  return (
    <div className="relative overflow-hidden rounded-3xl" style={{ touchAction: "pan-y" }}>
      <div
        className="absolute inset-0 flex items-center justify-end px-3"
        style={{
          opacity: backdropOpacity,
          background: "linear-gradient(90deg, rgba(255,255,255,0), var(--theme-danger-soft))",
          border: "1px solid var(--theme-danger-border)",
          boxShadow: "inset 0 0 24px var(--theme-danger-soft)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            onOpenChange(false);
            onRequestDelete();
          }}
          className="h-12 w-12 rounded-2xl border bg-white/[0.02] flex items-center justify-center"
          style={{
            borderColor: "var(--theme-danger-border)",
            color: "var(--theme-danger)",
            background: "var(--theme-danger-soft)",
          }}
          aria-label="Usuń pomiar"
          disabled={disabled}
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div
        className="relative"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishSwipe(event.currentTarget)}
        onPointerCancel={(event) => finishSwipe(event.currentTarget)}
      >
        {children}
      </div>
    </div>
  );
};

const PressureTooltipCard: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: { sys: number; dia: number; pulse: number; count?: number } }>;
  label?: string | number;
  pressurePrefs?: PressurePreferences;
  isCoarsePointer?: boolean;
  isLightTheme?: boolean;
}> = ({
  active,
  payload,
  label,
  pressurePrefs = defaultMeasurementPreferences.pressure,
  isCoarsePointer = false,
  isLightTheme = false,
}) => {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  const category = classifyPressure(point.sys, point.dia, pressurePrefs);
  const categoryStyles = getCategoryStyles(category);

  return (
    <div
      style={{
        background: "var(--theme-card-bg)",
        backdropFilter: "blur(10px) saturate(130%)",
        border: "1px solid var(--theme-card-border)",
        borderRadius: "12px",
        padding: isCoarsePointer ? "8px 10px" : "10px 12px",
        color: "var(--theme-accent-muted)",
        minWidth: isCoarsePointer ? "154px" : "176px",
        boxShadow: isLightTheme ? "0 8px 16px rgba(0,0,0,0.14)" : "0 8px 18px rgba(0,0,0,0.34)",
      }}
    >
      <p style={{ fontSize: "11px", opacity: 0.72, marginBottom: "5px" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "5px" }}>
        <span style={{ fontWeight: 700, fontSize: isCoarsePointer ? "19px" : "20px", lineHeight: 1 }}>
          {formatPreciseValueOrDash(point.sys)}/{formatPreciseValueOrDash(point.dia)}
        </span>
        <span style={{ fontSize: "12px", opacity: 0.72, whiteSpace: "nowrap" }}>
          {formatPreciseValueOrDash(point.pulse)} bpm
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "11px", opacity: 0.72 }}>
          {typeof point.count === "number" && point.count > 1 ? `Śr. z ${point.count} pom.` : "1 pomiar"}
        </span>
        <span
          style={{
            fontSize: "11px",
            borderRadius: "999px",
            border: `1px solid ${categoryStyles.border}`,
            background: categoryStyles.bg,
            color: categoryStyles.text,
            padding: "2px 7px",
            whiteSpace: "nowrap",
          }}
        >
          {getCategoryLabel(category)}
        </span>
      </div>
    </div>
  );
};

const SkeletonBar: React.FC<{ className: string }> = ({ className }) => (
  <div className={`animate-pulse rounded-2xl bg-white/[0.10] ${className}`} />
);

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`rounded-3xl p-6 ${className}`}
      style={{
        background: "var(--theme-card-bg)",
        backdropFilter: "blur(15px) saturate(132%)",
        WebkitBackdropFilter: "blur(15px) saturate(132%)",
        border: "1px solid var(--theme-card-border)",
        boxShadow: "var(--theme-card-shadow)",
      }}
    >
      {children}
    </div>
  );
};

const SettingsSection: React.FC<{
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, description, isOpen, onToggle, children }) => {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition-colors"
        aria-expanded={isOpen}
      >
        <div>
          <p className="text-white text-lg font-semibold leading-tight">{title}</p>
          {description && <p className="text-white/45 text-xs mt-1">{description}</p>}
        </div>
        <div className="w-8 h-8 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
          <ChevronDown
            className={`w-4 h-4 text-white/70 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {isOpen && <div className="px-4 pb-4 pt-1">{children}</div>}
    </section>
  );
};

const SettingsField: React.FC<{
  label: string;
  value: number;
  onChange: (next: number) => void;
  span?: "full" | "half";
}> = ({ label, value, onChange, span = "half" }) => {
  return (
    <div className={`space-y-1.5 ${span === "full" ? "col-span-2" : ""}`}>
      <Label className="min-h-10 text-white/55 text-sm leading-tight font-semibold tracking-wide">
        {label}
      </Label>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : value)}
        inputMode="numeric"
        className="bg-white/5 border-white/10 text-white h-14 rounded-2xl text-2xl font-semibold tracking-tight px-4 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
};

const SettingsActionButton: React.FC<{
  icon: React.ElementType<{ className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
}> = ({ icon: Icon, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full h-16 rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white text-lg font-semibold inline-flex items-center justify-center gap-2 transition-colors"
  >
    <Icon className="w-5 h-5 text-white/85" />
    <span>{children}</span>
  </button>
);

const DateTimePicker: React.FC<{
  value: Date;
  onChange: (next: Date) => void;
}> = ({ value, onChange }) => {
  const safeValue = useMemo(() => ensureLocalDate(value), [value]);
  const now = new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(safeValue));

  useEffect(() => {
    if (isOpen) {
      setVisibleMonth(startOfMonth(safeValue));
    }
  }, [isOpen, safeValue]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const selectedDayStamp = startOfLocalDay(safeValue).getTime();
  const todayStamp = startOfLocalDay(now).getTime();
  const currentMonthStamp = startOfMonth(now).getTime();
  const visibleMonthStamp = startOfMonth(visibleMonth).getTime();
  const canGoToNextMonth = visibleMonthStamp < currentMonthStamp;

  const setSelectedDay = (day: Date) => {
    const merged = mergeDateAndTime(safeValue, toDateInput(day));
    onChange(clampDateToNow(merged));
  };

  const changeHours = (delta: number) => {
    const next = new Date(safeValue);
    next.setHours((next.getHours() + delta + 24) % 24);
    onChange(clampDateToNow(next));
  };

  const changeMinutes = (delta: number) => {
    const next = new Date(safeValue);
    next.setMinutes(next.getMinutes() + delta);
    onChange(clampDateToNow(next));
  };

  const monthLabel = visibleMonth.toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/55 font-medium">Godzina pomiaru</p>
        <button
          type="button"
          onClick={() => onChange(new Date())}
          className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/90 text-sm font-medium transition-colors"
        >
          Teraz
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-xs text-white/45">Godzina</p>
          <div className="h-12 rounded-xl border border-white/10 bg-white/[0.02] px-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeHours(-1)}
              className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              <ChevronDown className="w-4 h-4 text-white/80" />
            </button>
            <span className="text-white text-2xl font-semibold tabular-nums">
              {String(safeValue.getHours()).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => changeHours(1)}
              className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              <ChevronUp className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-white/45">Minuty</p>
          <div className="h-12 rounded-xl border border-white/10 bg-white/[0.02] px-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMinutes(-5)}
              className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              <ChevronDown className="w-4 h-4 text-white/80" />
            </button>
            <span className="text-white text-2xl font-semibold tabular-nums">
              {String(safeValue.getMinutes()).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => changeMinutes(5)}
              className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              <ChevronUp className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full h-12 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/10 transition-colors px-4 flex items-center justify-between"
      >
        <div className="text-white text-base font-medium">Data: {formatDate(safeValue)}</div>
        <div className="flex items-center gap-2 text-white/75">
          <CalendarDays className="w-5 h-5" />
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVisibleMonth((prev) => addMonths(prev, -1))}
              className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4 text-white/80" />
            </button>
            <p className="text-white text-base font-semibold capitalize">{monthLabel}</p>
            <button
              type="button"
              onClick={() => {
                if (canGoToNextMonth) {
                  setVisibleMonth((prev) => addMonths(prev, 1));
                }
              }}
              className={`w-9 h-9 rounded-xl border transition-colors flex items-center justify-center ${
                canGoToNextMonth
                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                  : "border-white/10 bg-white/[0.02] text-white/35 cursor-not-allowed"
              }`}
              disabled={!canGoToNextMonth}
              aria-label="Następny miesiąc"
            >
              <ChevronRight className="w-4 h-4 text-white/80" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((label) => (
              <div key={label} className="text-center text-[11px] text-white/40 font-semibold">
                {label}
              </div>
            ))}
            {calendarDays.map((cell) => {
              const dayStamp = startOfLocalDay(cell.date).getTime();
              const isSelected = dayStamp === selectedDayStamp;
              const isToday = dayStamp === todayStamp;
              const isFutureDay = dayStamp > todayStamp;

              return (
                <button
                  key={cell.date.toISOString()}
                  type="button"
                  onClick={() => {
                    if (!isFutureDay) {
                      setSelectedDay(cell.date);
                    }
                  }}
                  disabled={isFutureDay}
                  className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                    isFutureDay
                      ? "text-white/25 cursor-not-allowed"
                      : cell.inCurrentMonth
                        ? "text-white/85 hover:bg-white/8"
                        : "text-white/30 hover:bg-white/5"
                  }`}
                  style={
                    isSelected
                      ? { background: "var(--theme-accent)", color: "var(--theme-on-accent)" }
                      : isToday
                        ? { border: "1px solid var(--theme-accent-border)", color: "var(--theme-info)" }
                        : undefined
                  }
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Main App Component

const BloodPressureApp: React.FC = () => {
  const appScrollRef = useRef<HTMLDivElement>(null);
  useMobileOverscrollLock(appScrollRef);
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const [authView, setAuthView] = useState<AuthView>("login");
  const [currentTab, setCurrentTab] = useState<AppTab>("dashboard");
  const [showSuccess, setShowSuccess] = useState(false);
  const [dataSyncError, setDataSyncError] = useState<string | null>(null);
  const hydratedSettingsUserIdRef = useRef<string | null>(null);

  // Auth state from Convex
  const userData = useQuery(api.authHelpers.getUser);

  const [systolic, setSystolic] = useState<number>(ADD_DEFAULTS.systolic);
  const [diastolic, setDiastolic] = useState<number>(ADD_DEFAULTS.diastolic);
  const [pulse, setPulse] = useState<number>(ADD_DEFAULTS.pulse);
  const [enableSecondArm, setEnableSecondArm] = useState(false);
  const [secondArmSystolic, setSecondArmSystolic] = useState<number>(ADD_DEFAULTS.systolic);
  const [secondArmDiastolic, setSecondArmDiastolic] = useState<number>(ADD_DEFAULTS.diastolic);
  const [secondArmPulse, setSecondArmPulse] = useState<number>(ADD_DEFAULTS.pulse);
  const [readingDate, setReadingDate] = useState(new Date());
  const [note, setNote] = useState("");

  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [showSettings, setShowSettings] = useState(false);
  const [themeId, setThemeId] = useState<AppThemeId>(() => readStoredThemeId());
  const [draftThemeId, setDraftThemeId] = useState<AppThemeId>(() => readStoredThemeId());
  const [dominantHand, setDominantHand] = useState<Handedness>("right");
  const [draftDominantHand, setDraftDominantHand] = useState<Handedness>("right");
  const [settingsSections, setSettingsSections] = useState<Record<SettingsSectionKey, boolean>>({
    pulse: false,
    pressure: false,
  });
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [preferences, setPreferences] = useState<MeasurementPreferences>(defaultMeasurementPreferences);
  const [draftPreferences, setDraftPreferences] = useState<MeasurementPreferences>(preferences);
  const [pendingDeleteReadingId, setPendingDeleteReadingId] = useState<Id<"readings"> | null>(null);
  const [openSwipeReadingId, setOpenSwipeReadingId] = useState<Id<"readings"> | null>(null);
  const [expandedHistoryReadingIds, setExpandedHistoryReadingIds] = useState<Set<Id<"readings">>>(() => new Set());
  const [isDeletingReading, setIsDeletingReading] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState(() => toDateInput(addDays(new Date(), -29)));
  const [exportDateTo, setExportDateTo] = useState(() => toDateInput(new Date()));
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState("");
  const [isCoarsePointer, setIsCoarsePointer] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches;
  });
  const [isMobileChartTooltipVisible, setIsMobileChartTooltipVisible] = useState(false);
  const activeThemeId = showSettings ? draftThemeId : themeId;
  const isActiveThemeLight = isLightMonoTheme(activeThemeId);
  const currentTheme = APP_THEME_PALETTES[activeThemeId];
  const themeCssVars = useMemo(() => getThemeCssVars(currentTheme), [currentTheme]);
  const settingsOverlayTint = isActiveThemeLight
    ? withAlpha(currentTheme.background, 0.56, "rgba(236,236,233,0.56)")
    : withAlpha(currentTheme.background, 0.62, "rgba(7,10,14,0.62)");
  const settingsOverlayRepaintTransform = {
    midnight: "translate3d(0px, 0, 0)",
    sand: "translate3d(0.001px, 0, 0)",
    ocean: "translate3d(0.002px, 0, 0)",
    blush: "translate3d(0.003px, 0, 0)",
    sage: "translate3d(0.004px, 0, 0)",
  }[activeThemeId];

  // Convex mutations
  const addReadingMutation = useMutation(api.readings.add);
  const deleteReadingMutation = useMutation(api.readings.remove);
  const savePreferencesMutation = useMutation(api.preferences.save);
  const setDominantHandMutation = useMutation(api.account.setDominantHand);
  const deleteAccountMutation = useMutation(api.account.deleteAccount);
  const changePasswordAction = useAction(api.account.changePassword);

  const menuItems: InteractiveMenuItem[] = [
    { label: "Dashboard", icon: Home },
    { label: "Dodaj", icon: Plus },
    { label: "Historia", icon: Clock },
    { label: "Analiza", icon: TrendingUp },
  ];
  const preferredMeasurementArm = getPreferredArmFromHandedness(dominantHand);
  const secondaryMeasurementArm = oppositeArm(preferredMeasurementArm);

  const tabToIndex: Record<AppTab, number> = {
    dashboard: 0,
    add: 1,
    history: 2,
    analytics: 3,
  };

  const indexToTab: AppTab[] = ["dashboard", "add", "history", "analytics"];

  const handleTabChange = (index: number) => {
    const nextTab = indexToTab[index];
    if (nextTab) {
      setShowSettings(false);
      setCurrentTab(nextTab);
    }
  };

  useEffect(() => {
    if (!showSettings) return;
    setDraftPreferences(preferences);
    setDraftDominantHand(dominantHand);
    setDraftThemeId(themeId);
    setIsSettingsDirty(false);
    setSettingsSections({
      pulse: false,
      pressure: false,
    });
  }, [showSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const numberFromInput = (valueAsNumber: number, fallback: number) =>
    Number.isFinite(valueAsNumber) ? valueAsNumber : fallback;

  const updatePulseDraft = <K extends keyof PulsePreferences>(key: K, value: number) => {
    setIsSettingsDirty(true);
    setDraftPreferences((prev) => ({
      ...prev,
      pulse: {
        ...prev.pulse,
        [key]: value,
      },
    }));
  };

  const updatePressureDraft = <K extends keyof PressurePreferences>(key: K, value: number) => {
    setIsSettingsDirty(true);
    setDraftPreferences((prev) => ({
      ...prev,
      pressure: {
        ...prev.pressure,
        [key]: value,
      },
    }));
  };

  const toggleSettingsSection = (section: SettingsSectionKey) => {
    setSettingsSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleLogout = async () => {
    setShowSettings(false);
    try {
      await signOut();
      setCurrentTab("dashboard");
      setDataSyncError(null);
    } catch (error) {
      setDataSyncError(mapAppError(error, "Nie udało się wylogować."));
    }
  };

  const handleSavePreferences = async () => {
    if (!isSettingsDirty) {
      setShowSettings(false);
      setDataSyncError(null);
      return;
    }

    const normalized = normalizeMeasurementPreferences(draftPreferences);
    const hasDominantHandChanged = draftDominantHand !== dominantHand;
    const hasPreferencesChanged = !areMeasurementPreferencesEqual(normalized, preferences);
    const hasThemeChanged = draftThemeId !== themeId;

    if (!hasDominantHandChanged && !hasPreferencesChanged && !hasThemeChanged) {
      setShowSettings(false);
      setIsSettingsDirty(false);
      setDataSyncError(null);
      return;
    }

    try {
      if (hasDominantHandChanged) {
        await setDominantHandMutation({ dominantHand: draftDominantHand });
        setDominantHand(draftDominantHand);
      }
      if (hasPreferencesChanged || hasThemeChanged) {
        await savePreferencesMutation({ preferences: normalized, theme: draftThemeId });
      }
      setPreferences(normalized);
      setThemeId(draftThemeId);
      setDraftThemeId(draftThemeId);
      setShowSettings(false);
      setIsSettingsDirty(false);
      setDataSyncError(null);
    } catch (error) {
      console.error("Manual settings save failed", error);
      setDataSyncError(null);
    }
  };

  const handleCloseSettings = async () => {
    if (!isSettingsDirty) {
      setShowSettings(false);
      setDataSyncError(null);
      return;
    }

    const normalized = normalizeMeasurementPreferences(draftPreferences);
    const hasDominantHandChanged = draftDominantHand !== dominantHand;
    const hasPreferencesChanged = !areMeasurementPreferencesEqual(normalized, preferences);
    const hasThemeChanged = draftThemeId !== themeId;

    setPreferences(normalized);
    setDraftPreferences(normalized);
    setThemeId(draftThemeId);
    setDraftThemeId(draftThemeId);
    setShowSettings(false);

    if (!hasDominantHandChanged && !hasPreferencesChanged && !hasThemeChanged) {
      setIsSettingsDirty(false);
      setDataSyncError(null);
      return;
    }

    try {
      if (hasDominantHandChanged) {
        await setDominantHandMutation({ dominantHand: draftDominantHand });
        setDominantHand(draftDominantHand);
      }
      if (hasPreferencesChanged || hasThemeChanged) {
        await savePreferencesMutation({ preferences: normalized, theme: draftThemeId });
      }
      setIsSettingsDirty(false);
      setDataSyncError(null);
    } catch (error) {
      console.error("Background settings sync failed on close", error);
      setDataSyncError(null);
    }
  };

  const handleResetPreferences = () => {
    setIsSettingsDirty(true);
    setDraftPreferences(defaultMeasurementPreferences);
  };

  const parseDateInputToBoundary = (value: string, endOfDay: boolean): Date | null => {
    const [yearRaw, monthRaw, dayRaw] = value.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  const buildDoctorReportDataset = () => {
    const rangeStart = parseDateInputToBoundary(exportDateFrom, false);
    const rangeEnd = parseDateInputToBoundary(exportDateTo, true);
    if (!rangeStart || !rangeEnd || rangeStart.getTime() > rangeEnd.getTime()) {
      throw new Error("Zakres dat jest nieprawidłowy.");
    }

    const inRange = readings
      .filter((reading) => {
        const timestamp = reading.timestamp.getTime();
        return timestamp >= rangeStart.getTime() && timestamp <= rangeEnd.getTime();
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const rows = inRange.map((reading) => {
      const display = getDisplayReadingValues(reading);
      const pressureCategory = classifyPressure(display.systolic, display.diastolic, preferences.pressure);
      const pulseCategory = classifyPulse(display.pulse, preferences.pulse);
      const primary = reading;
      const secondary = reading.secondArm;
      const left =
        primary.arm === "left"
          ? { systolic: primary.systolic, diastolic: primary.diastolic, pulse: primary.pulse }
          : secondary?.arm === "left"
            ? { systolic: secondary.systolic, diastolic: secondary.diastolic, pulse: secondary.pulse }
            : null;
      const right =
        primary.arm === "right"
          ? { systolic: primary.systolic, diastolic: primary.diastolic, pulse: primary.pulse }
          : secondary?.arm === "right"
            ? { systolic: secondary.systolic, diastolic: secondary.diastolic, pulse: secondary.pulse }
            : null;

      return {
        reading,
        display,
        pressureCategory,
        pulseCategory,
        left,
        right,
      };
    });

    const anomalies = rows.filter(
      (row) => row.pressureCategory !== "normal" || row.pulseCategory !== "normal",
    );
    const sysValues = rows.map((row) => row.display.systolic);
    const diaValues = rows.map((row) => row.display.diastolic);
    const pulseValues = rows.map((row) => row.display.pulse);

    return {
      rangeStart,
      rangeEnd,
      rows,
      anomalies,
      summary: {
        count: rows.length,
        avgSys: averageRounded(sysValues),
        avgDia: averageRounded(diaValues),
        avgPulse: averageRounded(pulseValues),
        stdSys: standardDeviation(sysValues),
        stdDia: standardDeviation(diaValues),
        stdPulse: standardDeviation(pulseValues),
      },
    };
  };

  const downloadDoctorReportCsv = () => {
    const report = buildDoctorReportDataset();
    if (report.rows.length === 0) {
      throw new Error("Brak pomiarów w wybranym zakresie dat.");
    }

    const csvLines: string[] = [];
    csvLines.push(`Raport ciśnienia;${formatDate(report.rangeStart)} - ${formatDate(report.rangeEnd)}`);
    csvLines.push(`Pacjent;${userData?.name ?? "Użytkownik"};${userData?.email ?? ""}`);
    csvLines.push(
      `Liczba pomiarów;${report.summary.count};Anomalie;${report.anomalies.length}`,
    );
    csvLines.push(
      `Średnia SYS;${report.summary.avgSys ?? "--"};Odchylenie SYS;${report.summary.stdSys ?? "--"}`,
    );
    csvLines.push(
      `Średnia DIA;${report.summary.avgDia ?? "--"};Odchylenie DIA;${report.summary.stdDia ?? "--"}`,
    );
    csvLines.push(
      `Średni puls;${report.summary.avgPulse ?? "--"};Odchylenie pulsu;${report.summary.stdPulse ?? "--"}`,
    );
    csvLines.push("");
    csvLines.push(
      "Data;Godzina;SYS;DIA;Puls;Kategoria ciśnienia;Kategoria pulsu;Tryb;Lewa ręka;Prawa ręka;Notatka",
    );

    for (const row of report.rows) {
      const leftValue = row.left
        ? `${row.left.systolic}/${row.left.diastolic} ${row.left.pulse} bpm`
        : "";
      const rightValue = row.right
        ? `${row.right.systolic}/${row.right.diastolic} ${row.right.pulse} bpm`
        : "";

      csvLines.push(
        [
          formatDate(row.reading.timestamp),
          formatTime(row.reading.timestamp),
          String(row.display.systolic),
          String(row.display.diastolic),
          String(row.display.pulse),
          getCategoryLabel(row.pressureCategory),
          getPulseCategoryLabel(row.pulseCategory),
          row.reading.secondArm ? "2 ręce" : "1 ręka",
          leftValue,
          rightValue,
          (row.reading.note ?? "").replace(/\r?\n/g, " ").replace(/;/g, ","),
        ].join(";"),
      );
    }

    const csvContent = `\ufeff${csvLines.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `raport-cisnienia-${exportDateFrom}-${exportDateTo}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const downloadDoctorReportPdf = () => {
    const report = buildDoctorReportDataset();
    if (report.rows.length === 0) {
      throw new Error("Brak pomiarów w wybranym zakresie dat.");
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const maxY = pageHeight - 42;
    let y = 48;

    const writeLine = (text: string, fontSize = 11, isBold = false) => {
      if (y > maxY) {
        doc.addPage();
        y = 48;
      }
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(toPdfSafeText(text), pageWidth - marginX * 2);
      doc.text(lines, marginX, y);
      y += lines.length * (fontSize + 3);
    };

    writeLine("Raport ciśnienia tętniczego", 18, true);
    writeLine(`${formatDate(report.rangeStart)} - ${formatDate(report.rangeEnd)}`, 12, false);
    y += 4;
    writeLine(`Pacjent: ${userData?.name ?? "Użytkownik"} (${userData?.email ?? "brak e-maila"})`, 11, false);
    writeLine(`Liczba pomiarów: ${report.summary.count}`, 11, false);
    writeLine(`Liczba anomalii: ${report.anomalies.length}`, 11, false);
    y += 4;
    writeLine("Statystyki (wartości uśrednione dla pomiarów 2-ręcznych):", 12, true);
    writeLine(
      `SYS: średnia ${report.summary.avgSys ?? "--"} mmHg, odchylenie ${report.summary.stdSys ?? "--"}`,
      11,
      false,
    );
    writeLine(
      `DIA: średnia ${report.summary.avgDia ?? "--"} mmHg, odchylenie ${report.summary.stdDia ?? "--"}`,
      11,
      false,
    );
    writeLine(
      `Puls: średnia ${report.summary.avgPulse ?? "--"} bpm, odchylenie ${report.summary.stdPulse ?? "--"}`,
      11,
      false,
    );

    y += 8;
    writeLine("Lista anomalii:", 12, true);
    if (report.anomalies.length === 0) {
      writeLine("Brak anomalii w wybranym zakresie.", 11, false);
    } else {
      for (const row of report.anomalies) {
        writeLine(
          `${formatDate(row.reading.timestamp)} ${formatTime(row.reading.timestamp)} | ${row.display.systolic}/${row.display.diastolic} | ${row.display.pulse} bpm | ${getCategoryLabel(row.pressureCategory)} / ${getPulseCategoryLabel(row.pulseCategory)}`,
          10,
          false,
        );
      }
    }

    y += 8;
    writeLine("Wszystkie pomiary:", 12, true);
    for (const row of report.rows) {
      writeLine(
        `${formatDate(row.reading.timestamp)} ${formatTime(row.reading.timestamp)} | ${row.display.systolic}/${row.display.diastolic} | ${row.display.pulse} bpm | ${row.reading.secondArm ? "2 ręce" : "1 ręka"}`,
        10,
        false,
      );
    }

    doc.save(`raport-cisnienia-${exportDateFrom}-${exportDateTo}.pdf`);
  };

  const handleExportData = async (format: "csv" | "pdf") => {
    setIsExporting(true);
    setDataSyncError(null);
    try {
      if (format === "csv") {
        downloadDoctorReportCsv();
      } else {
        downloadDoctorReportPdf();
      }
      setShowExportModal(false);
    } catch (error) {
      setDataSyncError(extractErrorMessage(error, "Nie udało się wygenerować raportu."));
    } finally {
      setIsExporting(false);
    }
  };

  const getPressureCategory = (sys: number, dia: number) => classifyPressure(sys, dia, preferences.pressure);
  const getPulseCategory = (pulseValue: number) => classifyPulse(pulseValue, preferences.pulse);

  const handleAddReading = async () => {
    const now = new Date();
    if (readingDate.getTime() > now.getTime()) {
      setReadingDate(now);
      setDataSyncError("Data pomiaru nie może być w przyszłości.");
      return;
    }

    try {
      await addReadingMutation({
        systolic,
        diastolic,
        pulse,
        arm: preferredMeasurementArm,
        secondArm: enableSecondArm
          ? {
              arm: secondaryMeasurementArm,
              systolic: secondArmSystolic,
              diastolic: secondArmDiastolic,
              pulse: secondArmPulse,
            }
          : undefined,
        timestamp: readingDate.toISOString(),
        note: note.trim() || undefined,
      });

      setShowSuccess(true);
      setDataSyncError(null);

      setTimeout(() => {
        setShowSuccess(false);
        setCurrentTab("dashboard");
        setNote("");
        setSystolic(ADD_DEFAULTS.systolic);
        setDiastolic(ADD_DEFAULTS.diastolic);
        setPulse(ADD_DEFAULTS.pulse);
        setEnableSecondArm(false);
        setSecondArmSystolic(ADD_DEFAULTS.systolic);
        setSecondArmDiastolic(ADD_DEFAULTS.diastolic);
        setSecondArmPulse(ADD_DEFAULTS.pulse);
        setReadingDate(new Date());
      }, 1500);
    } catch (error) {
      setDataSyncError(mapAppError(error, "Nie udało się zapisać pomiaru."));
    }
  };

  const handleDeleteReading = async (id: Id<"readings">) => {
    setIsDeletingReading(true);
    try {
      await deleteReadingMutation({ id });
      setPendingDeleteReadingId(null);
      setOpenSwipeReadingId(null);
      setDataSyncError(null);
    } catch (error) {
      setDataSyncError(mapAppError(error, "Nie udało się usunąć pomiaru."));
    } finally {
      setIsDeletingReading(false);
    }
  };

  const handleConfirmDeleteReading = async () => {
    if (!pendingDeleteReadingId) return;
    await handleDeleteReading(pendingDeleteReadingId);
  };

  const toggleHistoryReadingDetails = (readingId: Id<"readings">) => {
    setExpandedHistoryReadingIds((prev) => {
      const next = new Set(prev);
      if (next.has(readingId)) {
        next.delete(readingId);
      } else {
        next.add(readingId);
      }
      return next;
    });
  };

  const handleChangePassword = async () => {
    setDataSyncError(null);

    if (!currentPasswordInput || !newPasswordInput || !confirmNewPasswordInput) {
      setDataSyncError("Uzupełnij wszystkie pola hasła.");
      return;
    }
    if (newPasswordInput.length < 8) {
      setDataSyncError("Nowe hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setDataSyncError("Nowe hasła nie są takie same.");
      return;
    }
    if (currentPasswordInput === newPasswordInput) {
      setDataSyncError("Nowe hasło musi być inne niż obecne.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePasswordAction({
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
      });
      setShowChangePasswordModal(false);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmNewPasswordInput("");
      setDataSyncError(null);
      setShowSuccess(true);
      window.setTimeout(() => setShowSuccess(false), 1200);
    } catch (error) {
      setDataSyncError(mapAppError(error, "Nie udało się zmienić hasła."));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteAccountConfirmText.trim().toUpperCase() !== "USUN") {
      setDataSyncError("Aby usunąć konto wpisz dokładnie: USUN");
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccountMutation({});
      await signOut();
      setShowDeleteAccountModal(false);
      setDeleteAccountConfirmText("");
      setCurrentTab("dashboard");
      setDataSyncError(null);
    } catch (error) {
      setDataSyncError(mapAppError(error, "Nie udało się usunąć konta."));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Transform Convex data
  const readings: BloodPressureReading[] = useMemo(() => {
    if (!userData?.readings) return [];
    return userData.readings
      .map((r: any): BloodPressureReading | null => {
        const systolicValue = toFiniteNumber(r.systolic);
        const diastolicValue = toFiniteNumber(r.diastolic);
        const pulseValue = toFiniteNumber(r.pulse);
        const timestamp = new Date(r.timestamp);

        if (
          systolicValue === null ||
          diastolicValue === null ||
          pulseValue === null ||
          !isValidDate(timestamp)
        ) {
          return null;
        }

        return {
          id: r._id,
          systolic: Math.round(systolicValue),
          diastolic: Math.round(diastolicValue),
          pulse: Math.round(pulseValue),
          arm: normalizeArmSide(r.arm, preferredMeasurementArm),
          secondArm:
            r.secondArm &&
            typeof r.secondArm === "object" &&
            toFiniteNumber((r.secondArm as Record<string, unknown>).systolic) !== null &&
            toFiniteNumber((r.secondArm as Record<string, unknown>).diastolic) !== null &&
            toFiniteNumber((r.secondArm as Record<string, unknown>).pulse) !== null
              ? {
                  arm: normalizeArmSide(
                    (r.secondArm as Record<string, unknown>).arm,
                    oppositeArm(normalizeArmSide(r.arm, preferredMeasurementArm)),
                  ),
                  systolic: Math.round(toFiniteNumber((r.secondArm as Record<string, unknown>).systolic)!),
                  diastolic: Math.round(toFiniteNumber((r.secondArm as Record<string, unknown>).diastolic)!),
                  pulse: Math.round(toFiniteNumber((r.secondArm as Record<string, unknown>).pulse)!),
                }
              : undefined,
          timestamp,
          note: typeof r.note === "string" ? r.note : undefined,
        };
      })
      .filter((reading): reading is BloodPressureReading => reading !== null)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [userData?.readings, preferredMeasurementArm]);

  const addMeasurementPrefill = useMemo(
    () => getAddMeasurementPrefill(readings, new Date()),
    [readings],
  );
  const previousTabRef = useRef<AppTab>(currentTab);

  useEffect(() => {
    const previousTab = previousTabRef.current;
    const shouldApplyOnTabEnter = currentTab === "add" && previousTab !== "add";
    const shouldApplyAfterDataLoad =
      currentTab === "add" &&
      previousTab === "add" &&
      addMeasurementPrefill.source !== "default" &&
      readings.length > 0 &&
      systolic === ADD_DEFAULTS.systolic &&
      diastolic === ADD_DEFAULTS.diastolic &&
      pulse === ADD_DEFAULTS.pulse;

    if (shouldApplyOnTabEnter || shouldApplyAfterDataLoad) {
      setSystolic(addMeasurementPrefill.systolic);
      setDiastolic(addMeasurementPrefill.diastolic);
      setPulse(addMeasurementPrefill.pulse);
      setSecondArmSystolic(addMeasurementPrefill.systolic);
      setSecondArmDiastolic(addMeasurementPrefill.diastolic);
      setSecondArmPulse(addMeasurementPrefill.pulse);
      setReadingDate(new Date());
    }
    previousTabRef.current = currentTab;
  }, [currentTab, addMeasurementPrefill, readings.length, systolic, diastolic, pulse]);

  // Hydrate settings from backend once per signed-in user to avoid overwriting live local theme changes.
  useEffect(() => {
    if (!userData?._id) {
      hydratedSettingsUserIdRef.current = null;
      return;
    }
    if (showSettings) return;
    if (hydratedSettingsUserIdRef.current === userData._id) return;

    const nextDominant = normalizeArmSide(userData.dominantHand, "right");
    setDominantHand(nextDominant);
    setDraftDominantHand(nextDominant);

    if (userData.preferences) {
      const prefs = normalizeMeasurementPreferences({
        pressure: userData.preferences.pressure as PressurePreferences,
        pulse: userData.preferences.pulse as PulsePreferences,
      });
      setPreferences(prefs);
      setDraftPreferences(prefs);

      const nextThemeRaw = (userData.preferences as { theme?: unknown }).theme;
      if (isAppThemeId(nextThemeRaw)) {
        setThemeId(nextThemeRaw);
        setDraftThemeId(nextThemeRaw);
      }
    }

    hydratedSettingsUserIdRef.current = userData._id;
  }, [showSettings, userData?._id, userData?.dominantHand, userData?.preferences]);

  const filteredReadings = useMemo(() => {
    const rangeStart = getRangeStart(timeRange, new Date());
    const inRange = rangeStart
      ? readings.filter((reading) => reading.timestamp.getTime() >= rangeStart.getTime())
      : readings;
    return [...inRange].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [readings, timeRange]);

  const filteredDisplayReadings = useMemo(
    () =>
      filteredReadings.map((reading) => ({
        reading,
        ...getDisplayReadingValues(reading),
      })),
    [filteredReadings],
  );

  const chartData = useMemo<PressureChartPoint[]>(() => {
    const dailyMap = new Map<number, { sysSum: number; diaSum: number; pulseSum: number; count: number }>();

    for (const row of filteredDisplayReadings) {
      const dayStamp = startOfLocalDay(row.reading.timestamp).getTime();
      const current = dailyMap.get(dayStamp);
      if (current) {
        current.sysSum += row.systolic;
        current.diaSum += row.diastolic;
        current.pulseSum += row.pulse;
        current.count += 1;
      } else {
        dailyMap.set(dayStamp, {
          sysSum: row.systolic,
          diaSum: row.diastolic,
          pulseSum: row.pulse,
          count: 1,
        });
      }
    }

    const points = Array.from(dailyMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayStamp, bucket]) => ({
        date: formatDate(new Date(dayStamp)),
        sys: Number((bucket.sysSum / bucket.count).toFixed(1)),
        dia: Number((bucket.diaSum / bucket.count).toFixed(1)),
        pulse: Number((bucket.pulseSum / bucket.count).toFixed(1)),
        count: bucket.count,
      }));

    const maxPoints: Record<TimeRange, number> = {
      "7d": 7,
      "30d": 30,
      "3m": 90,
      all: 180,
    };

    return points.slice(-maxPoints[timeRange]);
  }, [filteredDisplayReadings, timeRange]);

  const handleMobileChartTouchUpdate = (nextState: ChartInteractionState) => {
    if (!isCoarsePointer) return;
    const activeIndex = getTooltipIndexFromInteraction(nextState, chartData.length);
    setIsMobileChartTooltipVisible(nextState.isTooltipActive && activeIndex !== null);
  };

  const handleMobileChartTouchRelease = () => {
    if (!isCoarsePointer) return;
    setIsMobileChartTooltipVisible(false);
  };

  const stats = useMemo(() => {
    if (filteredDisplayReadings.length === 0) return null;

    const avgSys = Math.round(
      filteredDisplayReadings.reduce((sum, row) => sum + row.systolic, 0) / filteredDisplayReadings.length,
    );
    const avgDia = Math.round(
      filteredDisplayReadings.reduce((sum, row) => sum + row.diastolic, 0) / filteredDisplayReadings.length,
    );
    const avgPulse = Math.round(
      filteredDisplayReadings.reduce((sum, row) => sum + row.pulse, 0) / filteredDisplayReadings.length,
    );
    const goodCount = filteredDisplayReadings.filter((row) => {
      const category = classifyPressure(row.systolic, row.diastolic, preferences.pressure);
      return category === "normal" || category === "elevated";
    }).length;
    const normalPercent = Math.round((goodCount / filteredDisplayReadings.length) * 100);

    return { avgSys, avgDia, avgPulse, normalPercent };
  }, [filteredDisplayReadings, preferences.pressure]);

  const analyticsYDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) {
      return [PRESSURE_RULES.chartMin, PRESSURE_RULES.chartMax];
    }

    const values = chartData.flatMap((point) => [point.sys, point.dia]);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const dynamicPadding = Math.max(10, Math.ceil((rawMax - rawMin) * 0.28));

    let domainMin = Math.floor((rawMin - dynamicPadding) / 5) * 5;
    let domainMax = Math.ceil((rawMax + dynamicPadding) / 5) * 5;

    const minRange = 55;
    if (domainMax - domainMin < minRange) {
      const center = (domainMin + domainMax) / 2;
      domainMin = Math.floor((center - minRange / 2) / 5) * 5;
      domainMax = Math.ceil((center + minRange / 2) / 5) * 5;
    }

    domainMin = Math.max(PRESSURE_RULES.chartMin, domainMin);
    domainMax = Math.min(PRESSURE_RULES.chartMax, domainMax);

    if (domainMax <= domainMin) {
      return [PRESSURE_RULES.chartMin, PRESSURE_RULES.chartMax];
    }

    return [domainMin, domainMax];
  }, [chartData]);

  const xAxisTickInterval = useMemo(() => {
    if (chartData.length <= 7) return 0;
    const maxLabels = isCoarsePointer ? 4 : 6;
    return Math.max(1, Math.ceil(chartData.length / maxLabels) - 1);
  }, [chartData.length, isCoarsePointer]);
  const normalDiaStart = Math.max(preferences.pressure.lowDia + 1, preferences.pressure.high1Dia - 5);
  const sysTunnelRange = useMemo(() => {
    return {
      y1: Math.max(analyticsYDomain[0], preferences.pressure.elevatedSys),
      y2: Math.min(analyticsYDomain[1], preferences.pressure.high2Sys - 1),
    };
  }, [analyticsYDomain, preferences.pressure.elevatedSys, preferences.pressure.high2Sys]);
  const diaTunnelRange = useMemo(() => {
    return {
      y1: Math.max(analyticsYDomain[0], normalDiaStart),
      y2: Math.min(analyticsYDomain[1], preferences.pressure.high2Dia - 1),
    };
  }, [analyticsYDomain, normalDiaStart, preferences.pressure.high2Dia]);
  const chartTooltipTrigger: "hover" | "click" = "hover";
  const chartTooltipActive = isCoarsePointer ? isMobileChartTooltipVisible : undefined;
  const chartAxisColor = isActiveThemeLight ? "rgba(18,18,18,0.46)" : "rgba(255,255,255,0.30)";
  const chartGridColor = isActiveThemeLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.06)";
  const chartCursorColor = isActiveThemeLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.26)";
  const chartDateTickColor = isActiveThemeLight ? "rgba(22,22,22,0.50)" : "rgba(255,255,255,0.30)";
  const chartDotBorderColor = isActiveThemeLight ? "rgba(255,255,255,0.92)" : "#FFFFFF";
  const chartTooltipCursor = isCoarsePointer
    ? (isMobileChartTooltipVisible ? { stroke: chartCursorColor, strokeDasharray: "4 4" } : false)
    : { stroke: chartCursorColor, strokeDasharray: "4 4" };
  const chartDotRadius = isCoarsePointer ? 7 : 4;
  const chartActiveDotRadius = isCoarsePointer ? 11 : 7;
  const renderChartDateTick = useCallback(
    (props: any) => {
      const x = Number(props?.x ?? 0);
      const y = Number(props?.y ?? 0);
      const label = String(props.payload?.value ?? "").slice(0, 5);
      const index = props.index ?? 0;
      const lastIndex = Math.max(0, chartData.length - 1);
      const anchor = index === 0 ? "start" : index === lastIndex ? "end" : "middle";

      return (
        <text x={x} y={y + 16} fill={chartDateTickColor} fontSize={11} textAnchor={anchor}>
          {label}
        </text>
      );
    },
    [chartData.length, chartDateTickColor],
  );
  const renderPressureDot = useCallback(
    (color: string, radius: number) =>
      (props: any) => {
        const cx = Number(props?.cx ?? 0);
        const cy = Number(props?.cy ?? 0);
        const index = Number(props?.index ?? 0);
        const isLast = index === Math.max(0, chartData.length - 1);
        const x = cx + (isLast ? -4 : 0);
        return <circle cx={x} cy={cy} r={radius} fill={color} stroke={chartDotBorderColor} strokeWidth={2} />;
      },
    [chartData.length, chartDotBorderColor],
  );
  const renderSysDot = useMemo(
    () => renderPressureDot("var(--theme-chart-sys)", chartDotRadius),
    [renderPressureDot, chartDotRadius],
  );
  const renderDiaDot = useMemo(
    () => renderPressureDot("var(--theme-chart-dia)", chartDotRadius),
    [renderPressureDot, chartDotRadius],
  );
  const renderSysActiveDot = useMemo(
    () => renderPressureDot("var(--theme-chart-sys)", chartActiveDotRadius),
    [renderPressureDot, chartActiveDotRadius],
  );
  const renderDiaActiveDot = useMemo(
    () => renderPressureDot("var(--theme-chart-dia)", chartActiveDotRadius),
    [renderPressureDot, chartActiveDotRadius],
  );

  const latestReading = readings[0] ?? null;
  const latestDisplayValues = latestReading ? getDisplayReadingValues(latestReading) : null;
  const latestPulseCategory =
    latestDisplayValues ? getPulseCategory(latestDisplayValues.pulse) : null;
  const latestPressureCategory =
    latestDisplayValues
      ? getPressureCategory(latestDisplayValues.systolic, latestDisplayValues.diastolic)
      : null;
  const streak = useMemo(() => calculateStreak(readings), [readings]);
  const streakGraphic = getStreakGraphic(streak.current, streak.hasTodayEntry);
  const localNow = new Date();
  const welcomeLine = useMemo(
    () => getWelcomeLine(userData?.name ?? "Użytkowniku", userData?.loginCount ?? 0),
    [userData?.name, userData?.loginCount],
  );
  const isUserDataLoading = isAuthenticated && userData === undefined;
  useEffect(() => {
    if (!isCoarsePointer || currentTab !== "analytics") {
      setIsMobileChartTooltipVisible(false);
    }
  }, [isCoarsePointer, currentTab, timeRange]);

  if (isAuthLoading) {
    return (
      <div
        className={`h-[100dvh] flex items-center justify-center ${isActiveThemeLight ? "theme-mono-light" : ""}`}
        style={{ ...themeCssVars, backgroundColor: "var(--theme-bg)" }}
      >
        <div className="w-full max-w-[430px] px-6 space-y-4">
          <SkeletonBar className="h-9 w-48" />
          <SkeletonBar className="h-28 w-full" />
          <SkeletonBar className="h-44 w-full" />
        </div>
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen view={authView} onChangeView={setAuthView} theme={currentTheme} />;
  }

  return (
    <div
      ref={appScrollRef}
      className={`h-[100dvh] overflow-y-auto overscroll-none touch-pan-y pb-32 relative ${isActiveThemeLight ? "theme-mono-light" : ""}`}
      style={{
        ...themeCssVars,
        backgroundColor: "var(--theme-bg)",
        fontFamily: "-apple-system, SF Pro Display, system-ui",
      }}
    >
      <BackgroundPaths />

      <div className="max-w-[430px] mx-auto relative z-10">
        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="animate-scale-in">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: "var(--theme-success-soft)", backdropFilter: "blur(24px)" }}
              >
                <Check className="w-12 h-12" style={{ color: "var(--theme-success)", strokeWidth: 3 }} />
              </div>
            </div>
          </div>
        )}

        {dataSyncError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-3 w-full max-w-[420px]">
            <div
              className="rounded-2xl border text-sm px-4 py-3 flex items-start justify-between gap-3"
              style={{
                borderColor: "var(--theme-warning-border)",
                background: "var(--theme-warning-soft)",
                color: "var(--theme-warning)",
              }}
            >
              <span>{dataSyncError}</span>
              <button
                type="button"
                className="opacity-75 hover:opacity-100"
                onClick={() => setDataSyncError(null)}
                aria-label="Zamknij komunikat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {showSettings && (
          <div
            className="fixed inset-0 z-50 p-4 flex items-end sm:items-center justify-center"
            style={{
              backgroundColor: settingsOverlayTint,
              backdropFilter: "blur(10px) saturate(145%)",
              WebkitBackdropFilter: "blur(10px) saturate(145%)",
              transform: settingsOverlayRepaintTransform,
              willChange: "transform, background-color, backdrop-filter",
            }}
            onClick={() => {
              void handleCloseSettings();
            }}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void handleCloseSettings();
              }}
              className="absolute z-[60] w-10 h-10 rounded-xl border border-white/12 bg-white/10 hover:bg-white/15 transition-colors flex items-center justify-center text-white/80 hover:text-white"
              style={{
                top: "calc(env(safe-area-inset-top, 0px) + 12px)",
                right: "calc(env(safe-area-inset-right, 0px) + 12px)",
              }}
              aria-label="Zamknij ustawienia"
            >
              <X className="w-5 h-5" />
            </button>
            <div
              className="w-full max-w-md"
              onClick={(event) => event.stopPropagation()}
            >
              <GlassCard className="max-h-[82vh] overflow-y-auto p-0">
                <div className="px-5 py-4 border-b border-white/10">
                  <div>
                    <p className="text-white text-lg font-semibold">Ustawienia</p>
                    <p className="text-white/45 text-xs">Konto i preferencje użytkownika</p>
                  </div>
                </div>

                <div className="px-5 py-5 space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-white text-sm font-semibold mb-1">{userData?.name}</p>
                    <p className="text-white/50 text-xs">{userData?.email}</p>
                  </div>

                  <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                    <div>
                      <p className="text-white text-lg font-semibold leading-tight">Ręka dominująca</p>
                      <p className="text-white/45 text-xs mt-1">Domyślna ręka pomiaru to ręka niedominująca</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(["right", "left"] as Handedness[]).map((hand) => {
                        const isSelected = draftDominantHand === hand;
                        return (
                          <button
                            key={hand}
                            type="button"
                            onClick={() => {
                              if (draftDominantHand !== hand) {
                                setIsSettingsDirty(true);
                                setDraftDominantHand(hand);
                              }
                            }}
                            className="h-11 rounded-xl border text-sm font-medium transition-colors"
                            style={{
                              borderColor: isSelected
                                ? "var(--theme-accent-border)"
                                : isActiveThemeLight
                                  ? "rgba(0,0,0,0.16)"
                                  : "rgba(255,255,255,0.12)",
                              background: isSelected
                                ? "var(--theme-accent-soft)"
                                : isActiveThemeLight
                                  ? "rgba(0,0,0,0.04)"
                                  : "rgba(255,255,255,0.04)",
                              color: isSelected
                                ? "var(--theme-accent-muted)"
                                : isActiveThemeLight
                                  ? "rgba(22,22,22,0.78)"
                                  : "rgba(255,255,255,0.78)",
                            }}
                          >
                            {hand === "right" ? "Praworęczny/a" : "Leworęczny/a"}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-white/45 text-xs">
                      Domyślna ręka pomiarowa: {getArmLabel(getPreferredArmFromHandedness(draftDominantHand))}
                    </p>
                  </section>

                  <SettingsSection
                    title="Progi ciśnienia"
                    description="Wpływa na klasyfikację odczytów i analizę"
                    isOpen={settingsSections.pressure}
                    onToggle={() => toggleSettingsSection("pressure")}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <SettingsField
                        label="Niskie SYS (<)"
                        value={draftPreferences.pressure.lowSys}
                        onChange={(next) =>
                          updatePressureDraft("lowSys", numberFromInput(next, draftPreferences.pressure.lowSys))
                        }
                      />
                      <SettingsField
                        label="Niskie DIA (<)"
                        value={draftPreferences.pressure.lowDia}
                        onChange={(next) =>
                          updatePressureDraft("lowDia", numberFromInput(next, draftPreferences.pressure.lowDia))
                        }
                      />
                      <SettingsField
                        label="Prawidłowe SYS od (>=)"
                        value={draftPreferences.pressure.elevatedSys}
                        onChange={(next) =>
                          updatePressureDraft("elevatedSys", numberFromInput(next, draftPreferences.pressure.elevatedSys))
                        }
                      />
                      <SettingsField
                        label="Wysokie prawidłowe SYS od (>=)"
                        value={draftPreferences.pressure.high1Sys}
                        onChange={(next) =>
                          updatePressureDraft("high1Sys", numberFromInput(next, draftPreferences.pressure.high1Sys))
                        }
                      />
                      <SettingsField
                        label="Wysokie prawidłowe DIA od (>=)"
                        value={draftPreferences.pressure.high1Dia}
                        onChange={(next) =>
                          updatePressureDraft("high1Dia", numberFromInput(next, draftPreferences.pressure.high1Dia))
                        }
                      />
                      <SettingsField
                        label="Nadciśnienie SYS od (>=)"
                        value={draftPreferences.pressure.high2Sys}
                        onChange={(next) =>
                          updatePressureDraft("high2Sys", numberFromInput(next, draftPreferences.pressure.high2Sys))
                        }
                      />
                      <SettingsField
                        label="Nadciśnienie DIA od (>=)"
                        value={draftPreferences.pressure.high2Dia}
                        onChange={(next) =>
                          updatePressureDraft("high2Dia", numberFromInput(next, draftPreferences.pressure.high2Dia))
                        }
                      />
                      <SettingsField
                        label="Kryzys SYS od (>=)"
                        value={draftPreferences.pressure.high3Sys}
                        onChange={(next) =>
                          updatePressureDraft("high3Sys", numberFromInput(next, draftPreferences.pressure.high3Sys))
                        }
                      />
                      <SettingsField
                        label="Kryzys DIA od (>=)"
                        value={draftPreferences.pressure.high3Dia}
                        onChange={(next) =>
                          updatePressureDraft("high3Dia", numberFromInput(next, draftPreferences.pressure.high3Dia))
                        }
                      />
                    </div>
                  </SettingsSection>

                  <SettingsSection
                    title="Zakres pulsu"
                    description="Wpływa na etykiety i statystyki"
                    isOpen={settingsSections.pulse}
                    onToggle={() => toggleSettingsSection("pulse")}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <SettingsField
                        label="Niski puls (<)"
                        value={draftPreferences.pulse.low}
                        onChange={(next) =>
                          updatePulseDraft("low", numberFromInput(next, draftPreferences.pulse.low))
                        }
                      />
                      <SettingsField
                        label="Wysoki puls (>)"
                        value={draftPreferences.pulse.high}
                        onChange={(next) =>
                          updatePulseDraft("high", numberFromInput(next, draftPreferences.pulse.high))
                        }
                      />
                    </div>
                  </SettingsSection>

                  <section
                    className="rounded-2xl border p-4 space-y-3.5"
                    style={{
                      borderColor: isActiveThemeLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.10)",
                      background: isActiveThemeLight ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.02)",
                      boxShadow: isActiveThemeLight ? "0 10px 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.72)" : undefined,
                    }}
                  >
                    <div>
                      <p className="text-white text-lg font-semibold leading-tight">Motyw aplikacji</p>
                      <p className="text-white/45 text-xs mt-1">Wybierz wariant kolorystyczny interfejsu</p>
                    </div>

                    <div
                      className="rounded-2xl p-1.5 overflow-hidden"
                      style={{
                        border: isActiveThemeLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.08)",
                        background: isActiveThemeLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.03)",
                        boxShadow: isActiveThemeLight ? "inset 0 1px 0 rgba(255,255,255,0.62)" : undefined,
                      }}
                    >
                      <div className="grid grid-cols-5 gap-2">
                        {THEME_IDS.map((themeOptionId) => {
                          const palette = APP_THEME_PALETTES[themeOptionId];
                          const isSelected = draftThemeId === themeOptionId;

                          return (
                            <button
                              key={themeOptionId}
                              type="button"
                              onClick={() => {
                                if (draftThemeId !== themeOptionId) {
                                  setIsSettingsDirty(true);
                                  setDraftThemeId(themeOptionId);
                                }
                              }}
                              aria-label={`Motyw ${palette.label}`}
                              className="relative w-full min-w-0 aspect-square rounded-xl border transition-all duration-200 ease-out hover:-translate-y-[1px] active:scale-[0.98]"
                              style={{
                                borderColor: isSelected
                                  ? isActiveThemeLight
                                    ? "rgba(0,0,0,0.55)"
                                    : "var(--theme-accent-border)"
                                  : isActiveThemeLight
                                    ? "rgba(0,0,0,0.18)"
                                    : "rgba(255,255,255,0.16)",
                                background: palette.swatchA,
                                boxShadow: isSelected
                                  ? isActiveThemeLight
                                    ? "0 0 0 2px rgba(0,0,0,0.12), 0 8px 14px rgba(0,0,0,0.16)"
                                    : "0 0 0 2px var(--theme-accent-soft), 0 8px 14px rgba(0,0,0,0.32)"
                                  : isActiveThemeLight
                                    ? "0 2px 6px rgba(0,0,0,0.10)"
                                    : "0 2px 8px rgba(0,0,0,0.22)",
                              }}
                            >
                              <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                                <span className="absolute inset-0" style={{ backgroundColor: palette.swatchA }} />
                                <span
                                  className="absolute inset-0"
                                  style={{
                                    backgroundColor: palette.swatchB,
                                    clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                                  }}
                                />
                              </span>
                              {isSelected && (
                                <span
                                  className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full"
                                  style={{
                                    background: palette.accent,
                                    border: `1px solid ${withAlpha(palette.onAccent, 0.32, "rgba(0,0,0,0.22)")}`,
                                  }}
                                >
                                  <Check
                                    className="w-2.5 h-2.5"
                                    style={{ color: palette.onAccent, strokeWidth: 3 }}
                                  />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <div className="pt-1 flex flex-col items-center gap-3">
                    <div className="w-full max-w-[280px]">
                      <SettingsActionButton
                        icon={Download}
                        onClick={() => {
                          setExportDateFrom(toDateInput(addDays(new Date(), -29)));
                          setExportDateTo(toDateInput(new Date()));
                          setShowExportModal(true);
                        }}
                      >
                        Raport lekarza
                      </SettingsActionButton>
                    </div>
                    <div className="w-full max-w-[280px]">
                      <SettingsActionButton icon={KeyRound} onClick={() => setShowChangePasswordModal(true)}>
                        Zmień hasło
                      </SettingsActionButton>
                    </div>
                    <div className="w-full max-w-[280px]">
                      <SettingsActionButton icon={UserX} onClick={() => setShowDeleteAccountModal(true)}>
                        Usuń konto
                      </SettingsActionButton>
                    </div>
                    <div className="w-full max-w-[280px]">
                      <SettingsActionButton icon={LogOut} onClick={handleLogout}>
                        Wyloguj się
                      </SettingsActionButton>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {pendingDeleteReadingId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
            <div className="w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
              <GlassCard className="p-5">
                <h3 className="text-white text-lg font-semibold mb-2">Usuń pomiar</h3>
                <p className="text-white/65 text-sm mb-5">Czy na pewno chcesz usunąć ten pomiar?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDeleteReadingId(null);
                      setOpenSwipeReadingId(null);
                    }}
                    className="h-11 rounded-xl border border-white/10 bg-white/5 text-white/85 hover:bg-white/10 transition-colors"
                    disabled={isDeletingReading}
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleConfirmDeleteReading();
                    }}
                    className="h-11 rounded-xl border transition-colors"
                    style={{
                      borderColor: "var(--theme-danger-border)",
                      background: "var(--theme-danger-soft)",
                      color: "var(--theme-danger)",
                    }}
                    disabled={isDeletingReading}
                  >
                    {isDeletingReading ? "Usuwanie..." : "Usuń"}
                  </button>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {showChangePasswordModal && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center"
            onClick={() => setShowChangePasswordModal(false)}
          >
            <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-white text-lg font-semibold">Zmień hasło</h3>
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Obecne hasło</Label>
                  <Input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(event) => setCurrentPasswordInput(event.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Nowe hasło</Label>
                  <Input
                    type="password"
                    value={newPasswordInput}
                    onChange={(event) => setNewPasswordInput(event.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Powtórz nowe hasło</Label>
                  <Input
                    type="password"
                    value={confirmNewPasswordInput}
                    onChange={(event) => setConfirmNewPasswordInput(event.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordModal(false)}
                    className="h-11 rounded-xl border border-white/10 bg-white/5 text-white/85 hover:bg-white/10 transition-colors"
                    disabled={isChangingPassword}
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleChangePassword();
                    }}
                    className="h-11 rounded-xl border transition-colors"
                    style={{
                      borderColor: "var(--theme-accent-border)",
                      background: "var(--theme-accent-soft)",
                      color: "var(--theme-accent-muted)",
                    }}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? "Zmiana..." : "Zmień"}
                  </button>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {showExportModal && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center"
            onClick={() => setShowExportModal(false)}
          >
            <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-white text-lg font-semibold">Raport dla lekarza</h3>
                <p className="text-white/65 text-sm">
                  Wybierz zakres dat. Raport zawiera średnie, odchylenia i listę anomalii.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/55 text-sm mb-2 block">Od</Label>
                    <Input
                      type="date"
                      value={exportDateFrom}
                      max={exportDateTo}
                      onChange={(event) => setExportDateFrom(event.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white/55 text-sm mb-2 block">Do</Label>
                    <Input
                      type="date"
                      value={exportDateTo}
                      min={exportDateFrom}
                      onChange={(event) => setExportDateTo(event.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void handleExportData("csv");
                    }}
                    className="h-11 rounded-xl border border-white/10 bg-white/5 text-white/85 hover:bg-white/10 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                    disabled={isExporting}
                  >
                    {isExporting ? "Tworzenie..." : "Eksport CSV"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleExportData("pdf");
                    }}
                    className="h-11 rounded-xl border transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                    style={{
                      borderColor: "var(--theme-accent-border)",
                      background: "var(--theme-accent-soft)",
                      color: "var(--theme-accent-muted)",
                    }}
                    disabled={isExporting}
                  >
                    {isExporting ? "Tworzenie..." : "Eksport PDF"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.03] text-white/75 text-sm hover:bg-white/[0.07] transition-colors"
                  disabled={isExporting}
                >
                  Anuluj
                </button>
              </GlassCard>
            </div>
          </div>
        )}

        {showDeleteAccountModal && (
          <div
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center"
            onClick={() => setShowDeleteAccountModal(false)}
          >
            <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: "var(--theme-danger)" }}>
                  Usuń konto
                </h3>
                <p className="text-white/70 text-sm">
                  Usuniemy Twoje konto i wszystkie pomiary. Tej operacji nie da się cofnąć.
                </p>
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Wpisz USUN, aby potwierdzić</Label>
                  <Input
                    type="text"
                    value={deleteAccountConfirmText}
                    onChange={(event) => setDeleteAccountConfirmText(event.target.value)}
                    className="bg-white/5 border-white/10 text-white uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteAccountModal(false)}
                    className="h-11 rounded-xl border border-white/10 bg-white/5 text-white/85 hover:bg-white/10 transition-colors"
                    disabled={isDeletingAccount}
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteAccount();
                    }}
                    className="h-11 rounded-xl border transition-colors"
                    style={{
                      borderColor: "var(--theme-danger-border)",
                      background: "var(--theme-danger-soft)",
                      color: "var(--theme-danger)",
                    }}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? "Usuwanie..." : "Usuń konto"}
                  </button>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {currentTab === "dashboard" && (
          <div className="p-6 space-y-6">
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-white text-3xl font-bold mb-1">{welcomeLine}</h1>
                <p className="text-white/55 text-base">{formatDate(localNow)}</p>
              </div>
              <button
                onClick={() => {
                  setDataSyncError(null);
                  setShowSettings(true);
                }}
                className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
                aria-label="Otwórz ustawienia użytkownika"
              >
                <Settings className="w-5 h-5 text-white/80" />
              </button>
            </div>

            {isUserDataLoading ? (
              <>
                <SkeletonBar className="h-20 w-full" />
                <SkeletonBar className="h-64 w-full" />
                <SkeletonBar className="h-56 w-full" />
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center" role="img" aria-label={streakGraphic.alt}>
                      <streakGraphic.icon
                        className="w-7 h-7 shrink-0"
                        strokeWidth={2.2}
                        style={{
                          color: streakGraphic.color,
                          filter: `drop-shadow(0 0 12px ${streakGraphic.glow})`,
                        }}
                      />
                    </span>
                    <div>
                      <p className="text-white text-sm font-medium">Passa</p>
                      <p className="text-white/45 text-xs">rekord: {formatDaysLabel(streak.best)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-2xl font-semibold tabular-nums leading-none">{formatValueOrDash(streak.current)}</p>
                    <p className="text-white/45 text-xs">{streak.hasTodayEntry ? "dzisiaj ok" : "brak dziś"}</p>
                  </div>
                </div>

                {readings.length === 0 ? (
                  <GlassCard>
                    <div className="text-center py-8">
                      <Heart className="w-16 h-16 mx-auto mb-4 text-white/30" />
                      <h3 className="text-white text-xl font-semibold mb-2">Brak pomiarów</h3>
                      <p className="text-white/55 mb-6">Dodaj swój pierwszy pomiar ciśnienia</p>
                      <LiquidButton onClick={() => setCurrentTab("add")} variant="default" size="sm">
                        Dodaj pomiar
                      </LiquidButton>
                    </div>
                  </GlassCard>
                ) : (
                  <>
                    <GlassCard>
                      <h2 className="text-white/55 text-sm font-medium mb-4">Ostatni pomiar</h2>
                      <div className="flex items-center justify-center mb-4 tabular-nums">
                        <span className="text-white font-bold" style={{ fontSize: "72px", letterSpacing: "-2px" }}>
                          {formatValueOrDash(latestDisplayValues?.systolic)}
                        </span>
                        <span className="text-white/55 font-bold text-5xl mx-2">/</span>
                        <span className="text-white font-bold" style={{ fontSize: "72px", letterSpacing: "-2px" }}>
                          {formatValueOrDash(latestDisplayValues?.diastolic)}
                        </span>
                      </div>

                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Heart className="w-5 h-5 text-white/55" />
                        <span className="text-white text-2xl font-semibold tabular-nums">{formatValueOrDash(latestDisplayValues?.pulse)}</span>
                        <span className="text-white/55 text-lg">bpm</span>
                      </div>
                      {latestPulseCategory && (
                        <p
                          className="text-sm text-center mb-3"
                          style={{ color: getPulseCategoryColor(latestPulseCategory) }}
                        >
                          {getPulseCategoryLabel(latestPulseCategory)}
                        </p>
                      )}
                      {latestReading?.secondArm && (
                        <p className="text-white/55 text-center text-sm mb-3">
                          Średnia z 2 rąk · {getArmLabel(latestReading.arm)} + {getArmLabel(latestReading.secondArm.arm)}
                        </p>
                      )}

                      <div className="flex justify-center mb-3">
                        {latestPressureCategory && <CategoryBadge category={latestPressureCategory} />}
                      </div>

                      <p className="text-white/30 text-center text-sm">
                        {latestReading ? `${formatTime(latestReading.timestamp)} • ${formatDate(latestReading.timestamp)}` : "--"}
                      </p>
                    </GlassCard>

                  </>
                )}
              </>
            )}
          </div>
        )}

        {currentTab === "add" && (
          <div className="p-6 space-y-6">
            <GlassCard>
              <h2 className="text-white text-2xl font-bold mb-6 text-center">Nowy pomiar</h2>
              <p className="mb-4 text-center text-xs text-white/35">{getArmLabel(preferredMeasurementArm)}</p>
              <div className="flex justify-center gap-2 mb-6 w-full max-w-[320px] mx-auto">
                <ScrollPicker value={systolic} onChange={setSystolic} min={60} max={250} label="SYS" isLightTheme={isActiveThemeLight} />
                <ScrollPicker value={diastolic} onChange={setDiastolic} min={40} max={150} label="DIA" isLightTheme={isActiveThemeLight} />
                <ScrollPicker value={pulse} onChange={setPulse} min={30} max={200} label="PULS" isLightTheme={isActiveThemeLight} />
              </div>

              <button
                type="button"
                onClick={() => setEnableSecondArm((prev) => !prev)}
                className="w-full h-11 rounded-xl border text-sm font-medium transition-colors"
                style={{
                  borderColor: enableSecondArm
                    ? "var(--theme-accent-border)"
                    : isActiveThemeLight
                      ? "rgba(0,0,0,0.16)"
                      : "rgba(255,255,255,0.12)",
                  background: enableSecondArm
                    ? "var(--theme-accent-soft)"
                    : isActiveThemeLight
                      ? "rgba(0,0,0,0.04)"
                      : "rgba(255,255,255,0.04)",
                  color: enableSecondArm
                    ? "var(--theme-accent-muted)"
                    : isActiveThemeLight
                      ? "rgba(22,22,22,0.78)"
                      : "rgba(255,255,255,0.78)",
                }}
              >
                {enableSecondArm ? "Usuń drugi pomiar ręki" : "Dodaj pomiar drugiej ręki (opcjonalnie)"}
              </button>

              {enableSecondArm && (
                <div className="mt-5">
                  <p className="mb-4 text-center text-xs text-white/35">{getArmLabel(secondaryMeasurementArm)}</p>
                  <div className="flex justify-center gap-2 w-full max-w-[320px] mx-auto">
                    <ScrollPicker
                      value={secondArmSystolic}
                      onChange={setSecondArmSystolic}
                      min={60}
                      max={250}
                      label="SYS"
                      isLightTheme={isActiveThemeLight}
                    />
                    <ScrollPicker
                      value={secondArmDiastolic}
                      onChange={setSecondArmDiastolic}
                      min={40}
                      max={150}
                      label="DIA"
                      isLightTheme={isActiveThemeLight}
                    />
                    <ScrollPicker
                      value={secondArmPulse}
                      onChange={setSecondArmPulse}
                      min={30}
                      max={200}
                      label="PULS"
                      isLightTheme={isActiveThemeLight}
                    />
                  </div>
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <div className="space-y-4">
                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Data i godzina</Label>
                  <DateTimePicker value={readingDate} onChange={setReadingDate} />
                </div>

                <div>
                  <Label className="text-white/55 text-sm mb-2 block">Notatka (opcjonalnie)</Label>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value.slice(0, 240))}
                    placeholder="Dodaj notatkę..."
                    maxLength={240}
                    className="bg-white/5 border-white/10 text-white text-base min-h-[100px] resize-none"
                  />
                  <p className="text-white/30 text-xs mt-1 text-right">{note.length}/240</p>
                </div>
              </div>
            </GlassCard>

            <LiquidButton onClick={handleAddReading} className="w-full" variant="default">
              Zapisz pomiar
            </LiquidButton>
          </div>
        )}

        {currentTab === "history" && (
          <div className="p-6 space-y-5">
            <h1 className="text-white text-3xl font-bold mb-6 pt-4">Historia</h1>
            {isUserDataLoading ? (
              <>
                <SkeletonBar className="h-28 w-full" />
                <SkeletonBar className="h-28 w-full" />
                <SkeletonBar className="h-28 w-full" />
              </>
            ) : readings.length === 0 ? (
              <GlassCard>
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-white/30" />
                  <p className="text-white/70 text-base font-medium">Brak pomiarów.</p>
                  <button
                    type="button"
                    className="mt-3 text-sm transition-colors opacity-90 hover:opacity-100"
                    style={{ color: "var(--theme-info)" }}
                    onClick={() => setCurrentTab("add")}
                  >
                    Dodaj pierwszy pomiar →
                  </button>
                </div>
              </GlassCard>
            ) : (
              readings.map((reading) => {
                const secondArm = reading.secondArm;
                const hasSecondArm = Boolean(secondArm);
                const displaySystolic = secondArm
                  ? Math.round((reading.systolic + secondArm.systolic) / 2)
                  : reading.systolic;
                const displayDiastolic = secondArm
                  ? Math.round((reading.diastolic + secondArm.diastolic) / 2)
                  : reading.diastolic;
                const displayPulse = secondArm
                  ? Math.round((reading.pulse + secondArm.pulse) / 2)
                  : reading.pulse;
                const displayPulseCategory = getPulseCategory(displayPulse);
                const pulseValueColor =
                  displayPulseCategory === "normal"
                    ? isActiveThemeLight
                      ? "rgba(18,18,18,0.66)"
                      : "rgba(255,255,255,0.66)"
                    : getPulseCategoryColor(displayPulseCategory);
                const pulseLabelColor =
                  displayPulseCategory === "normal"
                    ? isActiveThemeLight
                      ? "rgba(18,18,18,0.52)"
                      : "rgba(255,255,255,0.52)"
                    : getPulseCategoryColor(displayPulseCategory);
                const isExpanded = expandedHistoryReadingIds.has(reading.id);
                const pressureCategory = getPressureCategory(displaySystolic, displayDiastolic);
                const primaryArmLabel = getArmLabel(reading.arm);
                const secondaryArmLabel = secondArm ? getArmLabel(secondArm.arm) : "";

                return (
                  <SwipeDeleteCard
                    key={reading.id}
                    isOpen={openSwipeReadingId === reading.id}
                    onOpenChange={(nextOpen) => {
                      setOpenSwipeReadingId((prev) => {
                        if (nextOpen) return reading.id;
                        return prev === reading.id ? null : prev;
                      });
                    }}
                    onRequestDelete={() => {
                      if (isDeletingReading) return;
                      setOpenSwipeReadingId(null);
                      setPendingDeleteReadingId(reading.id);
                    }}
                    disabled={isDeletingReading || pendingDeleteReadingId !== null}
                  >
                    <GlassCard className="relative p-5">
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-white/42 text-xs sm:text-sm tracking-[0.01em] whitespace-nowrap">
                            {formatTime(reading.timestamp)} • {formatDate(reading.timestamp)}
                          </p>
                          {hasSecondArm && (
                            <span className="rounded-full border border-white/12 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55 tracking-wide">
                              2 ręce
                            </span>
                          )}
                        </div>
                        <div className="flex items-end gap-2 mb-2.5 flex-wrap">
                          <span className="text-white text-[44px] font-bold tabular-nums leading-[0.92] tracking-[-0.02em]">
                            {formatValueOrDash(displaySystolic)}/{formatValueOrDash(displayDiastolic)}
                          </span>
                          <span
                            className="text-[36px] whitespace-nowrap tabular-nums leading-[0.94]"
                            style={{ color: pulseValueColor }}
                          >
                            · {formatValueOrDash(displayPulse)} bpm
                          </span>
                        </div>
                        <div className="mb-2.5 flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-[11px] tracking-wide" style={{ color: pulseLabelColor }}>
                            {getPulseCategoryLabel(displayPulseCategory)}
                          </p>
                          <CategoryBadge category={pressureCategory} />
                        </div>

                        {secondArm ? (
                          <>
                            <div className="mb-0.5 flex items-center justify-between gap-2">
                              <p className="text-white/34 text-xs leading-5">
                                {primaryArmLabel} + {secondaryArmLabel}
                              </p>
                              <button
                                type="button"
                                onClick={() => toggleHistoryReadingDetails(reading.id)}
                                onPointerDown={(event) => event.stopPropagation()}
                                data-no-swipe="true"
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] hover:bg-white/[0.05] transition-colors"
                                style={{ color: "var(--theme-info)" }}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? "Ukryj" : "Szczegóły"}
                                <ChevronDown
                                  className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="space-y-1 mb-1.5">
                                <p className="text-white/45 text-xs tracking-[0.01em]">
                                  {getArmLabel(reading.arm)}: {formatValueOrDash(reading.systolic)}/
                                  {formatValueOrDash(reading.diastolic)} • {formatValueOrDash(reading.pulse)} bpm
                                </p>
                                <p className="text-white/45 text-xs tracking-[0.01em]">
                                  {getArmLabel(secondArm.arm)}: {formatValueOrDash(secondArm.systolic)}/
                                  {formatValueOrDash(secondArm.diastolic)} • {formatValueOrDash(secondArm.pulse)} bpm
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-white/34 text-xs mb-1">{getArmLabel(reading.arm)}</p>
                        )}

                        {reading.note && <p className="text-white/32 text-xs mt-2">{reading.note}</p>}
                      </div>
                    </GlassCard>
                  </SwipeDeleteCard>
                );
              })
            )}
          </div>
        )}

        {currentTab === "analytics" && (
          <div className="p-6 space-y-6">
            <h1 className="text-white text-3xl font-bold mb-6 pt-4">Analiza</h1>

            <div className="flex gap-2 justify-center">
              {(["7d", "30d", "3m", "all"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: timeRange === range ? "var(--theme-accent)" : isActiveThemeLight ? "rgba(0,0,0,0.05)" : "rgba(255, 255, 255, 0.06)",
                    color: timeRange === range ? "var(--theme-on-accent)" : isActiveThemeLight ? "rgba(20,20,20,0.74)" : "#FFFFFF",
                    border: `1px solid ${timeRange === range ? "var(--theme-accent)" : isActiveThemeLight ? "rgba(0,0,0,0.12)" : "rgba(255, 255, 255, 0.10)"}`,
                  }}
                >
                  {range === "all" ? "Wszystko" : range}
                </button>
              ))}
            </div>

            {isUserDataLoading ? (
              <>
                <SkeletonBar className="h-40 w-full" />
                <SkeletonBar className="h-72 w-full" />
              </>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <GlassCard>
                    <p className="text-white/55 text-sm mb-2">Średnia SYS</p>
                    <p className="text-white text-3xl font-bold tabular-nums">{formatValueOrDash(stats.avgSys)}</p>
                  </GlassCard>
                  <GlassCard>
                    <p className="text-white/55 text-sm mb-2">Średnia DIA</p>
                    <p className="text-white text-3xl font-bold tabular-nums">{formatValueOrDash(stats.avgDia)}</p>
                  </GlassCard>
                  <GlassCard>
                    <p className="text-white/55 text-sm mb-2">Średni puls</p>
                    <p className="text-white text-3xl font-bold tabular-nums">{formatValueOrDash(stats.avgPulse)}</p>
                  </GlassCard>
                  <GlassCard>
                    <p className="text-white/55 text-sm mb-2">% prawidłowych</p>
                    <p className="text-white text-3xl font-bold tabular-nums">{formatPercentOrDash(stats.normalPercent)}</p>
                  </GlassCard>
                </div>

                <GlassCard>
                  <h3 className="text-white text-lg font-semibold mb-1">Wykres ciśnienia</h3>
                  {isCoarsePointer && (
                    <p className="text-white/55 text-xs mb-3">
                      Przytrzymaj punkt, aby zobaczyć szczegóły. Po puszczeniu podgląd znika.
                    </p>
                  )}
                  {filteredReadings.length <= 1 ? (
                    <p className="text-white/65 text-sm">Dodaj więcej pomiarów aby zobaczyć trend.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={isCoarsePointer ? 280 : 250}>
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                        style={isCoarsePointer ? { touchAction: "none" } : undefined}
                        onTouchStart={handleMobileChartTouchUpdate}
                        onTouchMove={handleMobileChartTouchUpdate}
                        onTouchEnd={handleMobileChartTouchRelease}
                      >
                        <defs>
                          <linearGradient id="sysTunnelGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--theme-chart-sys)" stopOpacity={0.05} />
                            <stop offset="50%" stopColor="var(--theme-chart-sys)" stopOpacity={0.14} />
                            <stop offset="100%" stopColor="var(--theme-chart-sys)" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="diaTunnelGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--theme-chart-dia)" stopOpacity={0.05} />
                            <stop offset="50%" stopColor="var(--theme-chart-dia)" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="var(--theme-chart-dia)" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        {sysTunnelRange.y2 > sysTunnelRange.y1 && (
                          <ReferenceArea y1={sysTunnelRange.y1} y2={sysTunnelRange.y2} fill="url(#sysTunnelGradient)" ifOverflow="hidden" />
                        )}
                        {diaTunnelRange.y2 > diaTunnelRange.y1 && (
                          <ReferenceArea y1={diaTunnelRange.y1} y2={diaTunnelRange.y2} fill="url(#diaTunnelGradient)" ifOverflow="hidden" />
                        )}
                        {sysTunnelRange.y2 > sysTunnelRange.y1 && (
                          <ReferenceLine
                            y={sysTunnelRange.y1}
                            stroke="var(--theme-chart-sys-soft)"
                            strokeDasharray="5 5"
                            ifOverflow="hidden"
                          />
                        )}
                        {sysTunnelRange.y2 > sysTunnelRange.y1 && (
                          <ReferenceLine
                            y={sysTunnelRange.y2}
                            stroke="var(--theme-chart-sys-soft)"
                            strokeDasharray="5 5"
                            ifOverflow="hidden"
                          />
                        )}
                        {diaTunnelRange.y2 > diaTunnelRange.y1 && (
                          <ReferenceLine
                            y={diaTunnelRange.y1}
                            stroke="var(--theme-chart-dia-soft)"
                            strokeDasharray="5 5"
                            ifOverflow="hidden"
                          />
                        )}
                        {diaTunnelRange.y2 > diaTunnelRange.y1 && (
                          <ReferenceLine
                            y={diaTunnelRange.y2}
                            stroke="var(--theme-chart-dia-soft)"
                            strokeDasharray="5 5"
                            ifOverflow="hidden"
                          />
                        )}
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis
                          dataKey="date"
                          stroke={chartAxisColor}
                          interval={xAxisTickInterval}
                          tickMargin={10}
                          minTickGap={12}
                          tick={renderChartDateTick}
                        />
                        <YAxis
                          stroke={chartAxisColor}
                          style={{ fontSize: "12px" }}
                          tick={{ fill: chartAxisColor }}
                          domain={analyticsYDomain}
                          tickCount={6}
                        />
                        <Tooltip
                          trigger={chartTooltipTrigger}
                          active={chartTooltipActive}
                          shared
                          cursor={chartTooltipCursor}
                          content={
                            <PressureTooltipCard
                              pressurePrefs={preferences.pressure}
                              isCoarsePointer={isCoarsePointer}
                              isLightTheme={isActiveThemeLight}
                            />
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="sys"
                          name="SYS"
                          stroke="var(--theme-chart-sys)"
                          strokeWidth={3}
                          dot={renderSysDot}
                          activeDot={renderSysActiveDot}
                          style={{ filter: "drop-shadow(0 0 8px var(--theme-chart-sys-glow))" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="dia"
                          name="DIA"
                          stroke="var(--theme-chart-dia)"
                          strokeWidth={3}
                          dot={renderDiaDot}
                          activeDot={renderDiaActiveDot}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </GlassCard>

              </>
            ) : (
              <GlassCard>
                <p className="text-white/65">Brak danych do analizy.</p>
              </GlassCard>
            )}
          </div>
        )}

        <div
          className="fixed bottom-0 left-0 right-0 z-40"
          style={{
            maxWidth: "430px",
            margin: "0 auto",
          }}
        >
          <InteractiveMenu
            items={menuItems}
            accentColor={currentTheme.accent}
            activeIndex={tabToIndex[currentTab]}
            onItemClick={handleTabChange}
          />
        </div>
      </div>
    </div>
  );
};

export default BloodPressureApp;
