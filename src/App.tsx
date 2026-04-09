import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Check,
  Clock,
  Download,
  Heart,
  Home,
  LogOut,
  Plus,
  Settings,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BackgroundPaths } from "@/components/ui/background-paths";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiquidButton } from "@/components/ui/liquid-button";
import {
  InteractiveMenu,
  type InteractiveMenuItem,
} from "@/components/ui/modern-mobile-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  addReadingRemote,
  deleteReadingRemote,
  getUserStateRemote,
  requestLoginCodeRemote,
  savePreferencesRemote,
  verifyLoginCodeRemote,
  type RemotePreferences,
  type RemoteReading,
} from "@/lib/convex-api";

type AppTab = "dashboard" | "add" | "history" | "analytics";
type PressureCategory = "normal" | "elevated" | "high1" | "high2" | "high3" | "low";
type PulseCategory = "low" | "normal" | "high";
type TimeRange = "7d" | "30d" | "3m" | "all";
type SettingsSectionKey = "pressure" | "pulse";

interface BloodPressureReading {
  id: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  timestamp: Date;
  note?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  age?: number;
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
    high1Dia: 80,
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

const mapRemotePreferences = (prefs: RemotePreferences): MeasurementPreferences => ({
  pressure: { ...prefs.pressure },
  pulse: { ...prefs.pulse },
});

const mapRemoteReading = (reading: RemoteReading): BloodPressureReading => ({
  id: reading._id,
  systolic: reading.systolic,
  diastolic: reading.diastolic,
  pulse: reading.pulse,
  timestamp: new Date(reading.timestamp),
  note: reading.note,
});

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
  const high1Dia = clamp(candidate.pressure.high1Dia, lowDia + 1, 110, defaults.pressure.high1Dia);
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

const classifyPressure = (sys: number, dia: number, pressurePrefs: PressurePreferences): PressureCategory => {
  if (sys < pressurePrefs.lowSys || dia < pressurePrefs.lowDia) return "low";
  if (sys >= pressurePrefs.high3Sys || dia >= pressurePrefs.high3Dia) return "high3";
  if (sys >= pressurePrefs.high2Sys || dia >= pressurePrefs.high2Dia) return "high2";
  if (sys >= pressurePrefs.high1Sys || dia >= pressurePrefs.high1Dia) return "high1";
  if (sys >= pressurePrefs.elevatedSys && dia < pressurePrefs.high1Dia) return "elevated";
  return "normal";
};

const classifyPulse = (pulse: number, pulsePrefs: PulsePreferences): PulseCategory => {
  if (pulse < pulsePrefs.low) return "low";
  if (pulse > pulsePrefs.high) return "high";
  return "normal";
};

const getCategoryLabel = (category: PressureCategory): string => {
  const labels = {
    normal: "Norma",
    elevated: "Podwyższone",
    high1: "Wysokie I°",
    high2: "Wysokie II°",
    high3: "Wysokie III°",
    low: "Niskie",
  };

  return labels[category];
};

const getPulseCategoryLabel = (category: PulseCategory): string => {
  const labels = {
    low: "Niski puls",
    normal: "Puls w normie",
    high: "Wysoki puls",
  };

  return labels[category];
};

const getPulseCategoryColor = (category: PulseCategory): string => {
  const colors = {
    low: "#64D2FF",
    normal: "rgba(255,255,255,0.55)",
    high: "#FF9F0A",
  };

  return colors[category];
};

const getCategoryStyles = (category: PressureCategory) => {
  const styles = {
    normal: { bg: "rgba(48, 209, 88, 0.20)", text: "#30D158", border: "rgba(48,209,88,0.30)" },
    elevated: { bg: "rgba(255, 214, 10, 0.20)", text: "#FFD60A", border: "rgba(255,214,10,0.30)" },
    high1: { bg: "rgba(255, 159, 10, 0.20)", text: "#FF9F0A", border: "rgba(255,159,10,0.30)" },
    high2: { bg: "rgba(255, 69, 58, 0.20)", text: "#FF453A", border: "rgba(255,69,58,0.30)" },
    high3: { bg: "rgba(255, 69, 58, 0.20)", text: "#FF453A", border: "rgba(255,69,58,0.30)" },
    low: { bg: "rgba(100, 210, 255, 0.20)", text: "#64D2FF", border: "rgba(100,210,255,0.30)" },
  };

  return styles[category];
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

const getStreakGraphic = (current: number, hasTodayEntry: boolean): { src: string; alt: string } => {
  if (current >= 30) {
    return {
      src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3c6.png",
      alt: "Trofeum passy",
    };
  }
  if (current >= 14) {
    return {
      src: hasTodayEntry
        ? "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png"
        : "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2728.png",
      alt: "Wysoka passa",
    };
  }
  if (current >= 7) {
    return {
      src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/26a1.png",
      alt: "Solidna passa",
    };
  }
  if (current >= 3) {
    return {
      src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f31f.png",
      alt: "Dobra passa",
    };
  }
  if (current >= 1) {
    return {
      src: hasTodayEntry
        ? "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png"
        : "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f642.png",
      alt: "Początek passy",
    };
  }
  return {
    src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png",
    alt: "Nowa passa",
  };
};

const getWelcomeLine = (name: string, isReturning: boolean, loginCount: number | null) => {
  const firstName = name.trim().split(" ")[0] || "Użytkowniku";
  const variantsReturning = [
    `${firstName}, dobrze Cię znów widzieć`,
    `${firstName} wraca — świetnie`,
    `${firstName}, lecimy dalej z pomiarami`,
  ];
  const variantsNew = [
    `Witaj, ${firstName}`,
    `Cześć ${firstName}, miło Cię poznać`,
    `${firstName}, zaczynamy Twoją historię pomiarów`,
  ];

  if (isReturning || (loginCount ?? 0) > 1) {
    return variantsReturning[(loginCount ?? 2) % variantsReturning.length];
  }
  return variantsNew[(loginCount ?? 1) % variantsNew.length];
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

const ScrollPicker: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
}> = ({ value, onChange, min, max, label }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inertiaRafRef = useRef<number | null>(null);
  const snapAnimRafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const stableFramesRef = useRef(0);
  const shouldSnapAfterReleaseRef = useRef(false);
  const isInteractingRef = useRef(false);
  const values = useMemo(() => Array.from({ length: max - min + 1 }, (_, i) => min + i), [max, min]);
  const itemHeight = 56;
  const containerHeight = 240;
  const spacerHeight = (containerHeight - itemHeight) / 2;
  const [internalValue, setInternalValue] = useState(value);

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

  const animateSnapTo = (targetTop: number) => {
    if (!containerRef.current) return;
    if (snapAnimRafRef.current !== null) {
      window.cancelAnimationFrame(snapAnimRafRef.current);
      snapAnimRafRef.current = null;
    }

    const startTop = containerRef.current.scrollTop;
    const distance = targetTop - startTop;
    const absDistance = Math.abs(distance);

    if (absDistance < 1.5) {
      containerRef.current.scrollTop = targetTop;
      return;
    }

    const durationMs = Math.min(760, Math.max(420, 420 + absDistance * 4));
    const startedAt = performance.now();
    const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

    const step = (timestamp: number) => {
      if (!containerRef.current) {
        snapAnimRafRef.current = null;
        return;
      }

      const progress = Math.min((timestamp - startedAt) / durationMs, 1);
      const eased = easeInOutSine(progress);
      containerRef.current.scrollTop = startTop + distance * eased;

      if (progress < 1) {
        snapAnimRafRef.current = window.requestAnimationFrame(step);
      } else {
        snapAnimRafRef.current = null;
      }
    };

    snapAnimRafRef.current = window.requestAnimationFrame(step);
  };

  const snapToClosest = (behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) return;
    const index = getNearestIndex(containerRef.current.scrollTop);
    const snappedValue = values[index];
    const targetTop = index * itemHeight;
    const distance = Math.abs(containerRef.current.scrollTop - targetTop);

    if (behavior === "auto" || distance < 6) {
      containerRef.current.scrollTop = targetTop;
    } else {
      animateSnapTo(targetTop);
    }

    if (snappedValue !== undefined) {
      setInternalValue(snappedValue);
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
      if (snapAnimRafRef.current !== null) {
        window.cancelAnimationFrame(snapAnimRafRef.current);
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
    }

    if (!isInteractingRef.current && shouldSnapAfterReleaseRef.current && inertiaRafRef.current === null) {
      startInertiaWatcher();
    }
  };

  const handleInteractionStart = () => {
    isInteractingRef.current = true;
    shouldSnapAfterReleaseRef.current = false;
    if (inertiaRafRef.current !== null) {
      window.cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
    if (snapAnimRafRef.current !== null) {
      window.cancelAnimationFrame(snapAnimRafRef.current);
      snapAnimRafRef.current = null;
    }
  };

  const handleInteractionEnd = () => {
    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;
    shouldSnapAfterReleaseRef.current = true;
    startInertiaWatcher();
  };

  const handleWheel = () => {
    shouldSnapAfterReleaseRef.current = true;
    startInertiaWatcher();
  };

  return (
    <div className="flex flex-col items-center">
      <div className="text-white/55 text-sm mb-2 font-medium">{label}</div>
      <div className="relative h-[240px] w-[100px]">
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
          className="h-full overflow-y-scroll scrollbar-hide"
          style={{
            WebkitOverflowScrolling: "touch",
            maskImage: "linear-gradient(to bottom, transparent 0%, white 25%, white 75%, transparent 100%)",
          }}
        >
          <div style={{ height: spacerHeight }} />
          {values.map((val) => (
            <div
              key={val}
              className="flex items-center justify-center transition-all duration-300 ease-out"
              style={{
                height: itemHeight,
                fontSize: val === internalValue ? "56px" : val >= internalValue - 1 && val <= internalValue + 1 ? "30px" : "22px",
                opacity: val === internalValue ? 1 : val >= internalValue - 1 && val <= internalValue + 1 ? 0.55 : 0.2,
                fontWeight: val === internalValue ? 650 : 420,
                lineHeight: 0.95,
                color: "#FFFFFF",
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
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
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
      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
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

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`rounded-3xl p-6 ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.06)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.10)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
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
    className="w-full h-16 rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white text-xl font-semibold inline-flex items-center justify-center gap-2 transition-colors"
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
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(safeValue));

  useEffect(() => {
    if (isOpen) {
      setVisibleMonth(startOfMonth(safeValue));
    }
  }, [isOpen, safeValue]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const selectedDayStamp = startOfLocalDay(safeValue).getTime();
  const todayStamp = startOfLocalDay(new Date()).getTime();

  const setSelectedDay = (day: Date) => {
    onChange(mergeDateAndTime(safeValue, toDateInput(day)));
  };

  const changeHours = (delta: number) => {
    const next = new Date(safeValue);
    next.setHours((next.getHours() + delta + 24) % 24);
    onChange(next);
  };

  const changeMinutes = (delta: number) => {
    const next = new Date(safeValue);
    next.setMinutes(next.getMinutes() + delta);
    onChange(next);
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
              onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))}
              className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
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

              return (
                <button
                  key={cell.date.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(cell.date)}
                  className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-[#0A84FF] text-white"
                      : isToday
                        ? "border border-[#0A84FF]/60 text-[#7AB8FF]"
                        : cell.inCurrentMonth
                          ? "text-white/85 hover:bg-white/8"
                          : "text-white/30 hover:bg-white/5"
                  }`}
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

const BloodPressureApp: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<AppTab>("dashboard");
  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataSyncError, setDataSyncError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [loginCode, setLoginCode] = useState("");
  const [isCodeStage, setIsCodeStage] = useState(false);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [loginCount, setLoginCount] = useState<number | null>(null);

  const [systolic, setSystolic] = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [pulse, setPulse] = useState(72);
  const [readingDate, setReadingDate] = useState(new Date());
  const [note, setNote] = useState("");

  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSections, setSettingsSections] = useState<Record<SettingsSectionKey, boolean>>({
    pressure: false,
    pulse: false,
  });
  const [preferences, setPreferences] = useState<MeasurementPreferences>(defaultMeasurementPreferences);
  const [draftPreferences, setDraftPreferences] = useState<MeasurementPreferences>(preferences);

  const menuItems: InteractiveMenuItem[] = [
    { label: "Dashboard", icon: Home },
    { label: "Dodaj", icon: Plus },
    { label: "Historia", icon: Clock },
    { label: "Analiza", icon: TrendingUp },
  ];

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
    if (showSettings) {
      setDraftPreferences(preferences);
      setSettingsSections({
        pressure: false,
        pulse: false,
      });
    }
  }, [showSettings, preferences]);

  const numberFromInput = (valueAsNumber: number, fallback: number) =>
    Number.isFinite(valueAsNumber) ? valueAsNumber : fallback;

  const updatePulseDraft = <K extends keyof PulsePreferences>(key: K, value: number) => {
    setDraftPreferences((prev) => ({
      ...prev,
      pulse: {
        ...prev.pulse,
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

  const applyPressureRangeDraft = (next: {
    lowSys: number;
    lowDia: number;
    highSys: number;
    highDia: number;
  }) => {
    const elevatedSys = Math.max(next.lowSys + 1, next.highSys - 10);
    const high2Sys = Math.max(next.highSys + 1, next.highSys + 10);
    const high3Sys = Math.max(high2Sys + 1, next.highSys + 30);
    const high2Dia = Math.max(next.highDia + 1, next.highDia + 10);
    const high3Dia = Math.max(high2Dia + 1, next.highDia + 20);

    setDraftPreferences((prev) => ({
      ...prev,
      pressure: {
        ...prev.pressure,
        lowSys: next.lowSys,
        lowDia: next.lowDia,
        elevatedSys,
        high1Sys: next.highSys,
        high1Dia: next.highDia,
        high2Sys,
        high2Dia,
        high3Sys,
        high3Dia,
      },
    }));
  };

  const handleRequestLoginCode = async () => {
    if (!email.trim()) {
      setDataSyncError("Podaj adres e-mail.");
      return;
    }
    if (!name.trim()) {
      setDataSyncError("Podaj imię.");
      return;
    }
    const parsedAge = Number.parseInt(age, 10);
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 120) {
      setDataSyncError("Podaj poprawny wiek (18-120).");
      return;
    }
    setIsSyncing(true);
    setDataSyncError(null);

    try {
      const result = await requestLoginCodeRemote(email.trim());
      setIsCodeStage(true);
      setLoginCode("");
      setDevCodeHint(result.devCode);
      setDataSyncError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się wysłać kodu logowania.";
      setDataSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVerifyLogin = async () => {
    if (!email.trim() || !loginCode.trim()) {
      setDataSyncError("Wpisz kod z e-maila.");
      return;
    }
    setIsSyncing(true);
    setDataSyncError(null);

    try {
      const parsedAge = Number.parseInt(age, 10);
      const safeAge = Number.isFinite(parsedAge) ? Math.max(18, Math.min(120, parsedAge)) : undefined;
      const auth = await verifyLoginCodeRemote(email.trim(), loginCode.trim(), name.trim() || undefined, safeAge);
      setUser({
        id: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        age: auth.user.age,
      });
      setIsReturningUser(auth.isReturning);
      setLoginCount(auth.loginCount);

      const remoteState = await getUserStateRemote(auth.user.id);
      setIsAuthenticated(true);
      setReadings(
        remoteState.readings
          .map(mapRemoteReading)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      );
      setPreferences(
        remoteState.preferences
          ? normalizeMeasurementPreferences(mapRemotePreferences(remoteState.preferences))
          : defaultMeasurementPreferences
      );
      setEmail(auth.user.email);
      setName(auth.user.name);
      setAge(auth.user.age ? String(auth.user.age) : "");
      setIsCodeStage(false);
      setLoginCode("");
      setDevCodeHint(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się zalogować.";
      setDataSyncError(message);
      setReadings([]);
      setPreferences(defaultMeasurementPreferences);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    setShowSettings(false);
    setIsAuthenticated(false);
    setUser(null);
    setName("");
    setAge("");
    setEmail("");
    setCurrentTab("dashboard");
    setReadings([]);
    setIsCodeStage(false);
    setLoginCode("");
    setDevCodeHint(null);
    setIsReturningUser(false);
    setLoginCount(null);
    setDataSyncError(null);
    setIsSyncing(false);
  };

  const handleSavePreferences = async () => {
    const normalized = normalizeMeasurementPreferences(draftPreferences);
    if (!user) return;

    try {
      await savePreferencesRemote(user.id, normalized);
      setPreferences(normalized);
      setShowSettings(false);
      setDataSyncError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się zapisać progów.";
      setDataSyncError(message);
    }
  };

  const handleCloseSettings = async () => {
    const normalized = normalizeMeasurementPreferences(draftPreferences);
    setPreferences(normalized);
    setDraftPreferences(normalized);
    setShowSettings(false);
    if (!user) return;
    try {
      await savePreferencesRemote(user.id, normalized);
      setDataSyncError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się zapisać progów.";
      setDataSyncError(message);
    }
  };

  const handleResetPreferences = () => {
    setDraftPreferences(defaultMeasurementPreferences);
  };

  const handleExportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      user,
      preferences,
      readings: readings.map((reading) => ({
        ...reading,
        timestamp: reading.timestamp.toISOString(),
        pressureCategory: classifyPressure(reading.systolic, reading.diastolic, preferences.pressure),
        pulseCategory: classifyPulse(reading.pulse, preferences.pulse),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cisnienie-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const getPressureCategory = (sys: number, dia: number) => classifyPressure(sys, dia, preferences.pressure);
  const getPulseCategory = (pulseValue: number) => classifyPulse(pulseValue, preferences.pulse);

  const handleAddReading = async () => {
    if (!user) return;

    try {
      const saved = await addReadingRemote(user.id, {
        systolic,
        diastolic,
        pulse,
        timestamp: readingDate.toISOString(),
        note: note.trim() || undefined,
      });

      setReadings((prev) => [mapRemoteReading(saved), ...prev]);
      setShowSuccess(true);
      setDataSyncError(null);

      setTimeout(() => {
        setShowSuccess(false);
        setCurrentTab("dashboard");
        setNote("");
        setSystolic(120);
        setDiastolic(80);
        setPulse(72);
        setReadingDate(new Date());
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się zapisać pomiaru.";
      setDataSyncError(message);
    }
  };

  const handleDeleteReading = async (id: string) => {
    if (!user) return;

    try {
      await deleteReadingRemote(user.id, id);
      setReadings((prev) => prev.filter((reading) => reading.id !== id));
      setDataSyncError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się usunąć pomiaru.";
      setDataSyncError(message);
    }
  };

  const filteredReadings = useMemo(() => {
    const rangeStart = getRangeStart(timeRange, new Date());
    const inRange = rangeStart
      ? readings.filter((reading) => reading.timestamp.getTime() >= rangeStart.getTime())
      : readings;
    return [...inRange].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [readings, timeRange]);

  const chartData = useMemo(() => {
    const dailyMap = new Map<number, { sysSum: number; diaSum: number; pulseSum: number; count: number }>();

    for (const reading of filteredReadings) {
      const dayStamp = startOfLocalDay(reading.timestamp).getTime();
      const current = dailyMap.get(dayStamp);
      if (current) {
        current.sysSum += reading.systolic;
        current.diaSum += reading.diastolic;
        current.pulseSum += reading.pulse;
        current.count += 1;
      } else {
        dailyMap.set(dayStamp, {
          sysSum: reading.systolic,
          diaSum: reading.diastolic,
          pulseSum: reading.pulse,
          count: 1,
        });
      }
    }

    const points = Array.from(dailyMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayStamp, bucket]) => ({
        date: formatDate(new Date(dayStamp)),
        sys: Math.round(bucket.sysSum / bucket.count),
        dia: Math.round(bucket.diaSum / bucket.count),
        pulse: Math.round(bucket.pulseSum / bucket.count),
      }));

    const maxPoints: Record<TimeRange, number> = {
      "7d": 7,
      "30d": 30,
      "3m": 90,
      all: 180,
    };

    return points.slice(-maxPoints[timeRange]);
  }, [filteredReadings, timeRange]);

  const stats = useMemo(() => {
    if (filteredReadings.length === 0) return null;

    const avgSys = Math.round(filteredReadings.reduce((sum, reading) => sum + reading.systolic, 0) / filteredReadings.length);
    const avgDia = Math.round(filteredReadings.reduce((sum, reading) => sum + reading.diastolic, 0) / filteredReadings.length);
    const avgPulse = Math.round(filteredReadings.reduce((sum, reading) => sum + reading.pulse, 0) / filteredReadings.length);
    const normalCount = filteredReadings.filter(
      (reading) => classifyPressure(reading.systolic, reading.diastolic, preferences.pressure) === "normal"
    ).length;
    const normalPercent = Math.round((normalCount / filteredReadings.length) * 100);

    return { avgSys, avgDia, avgPulse, normalPercent };
  }, [filteredReadings, preferences.pressure]);

  const latestPulseCategory =
    readings.length > 0 ? getPulseCategory(readings[0].pulse) : null;
  const streak = useMemo(() => calculateStreak(readings), [readings]);
  const streakGraphic = getStreakGraphic(streak.current, streak.hasTodayEntry);
  const localNow = new Date();
  const welcomeLine = getWelcomeLine(user?.name ?? "Użytkowniku", isReturningUser, loginCount);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ backgroundColor: "#0A0A0A" }}>
        <BackgroundPaths />
        <div className="w-full max-w-md relative z-10">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255, 255, 255, 0.06)" }}>
              <Heart className="w-10 h-10" style={{ color: "#FF453A" }} />
            </div>
          </div>

          <GlassCard>
            <h1 className="text-3xl font-bold text-white text-center mb-1">Logowanie</h1>
            <p className="text-center text-white/55 text-sm mb-6">Kod potwierdzający wysyłamy na e-mail.</p>

            <div className="space-y-4">
              {!isCodeStage && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-white/55 text-sm mb-2 block">Imię</Label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[#0A84FF]"
                      placeholder="Twoje imię"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-white/55 text-sm mb-2 block">Wiek (18+)</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={18}
                      max={120}
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[#0A84FF]"
                      placeholder="np. 34"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-white/55 text-sm mb-2 block">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[#0A84FF]"
                  placeholder="twoj@email.pl"
                />
              </div>

              {isCodeStage && (
                <div className="space-y-2">
                  <Label className="text-white/55 text-sm mb-2 block">Kod z e-maila</Label>
                  <Input
                    type="text"
                    value={loginCode}
                    onChange={(event) => setLoginCode(event.target.value.replace(/\s+/g, ""))}
                    className="bg-white/5 border-white/10 text-white text-lg h-12 focus:border-[#0A84FF] tracking-[0.3em] uppercase"
                    placeholder="123456"
                    maxLength={6}
                  />
                  {devCodeHint && (
                    <p className="text-[#7AB8FF] text-xs">
                      Tryb developerski: kod to <span className="font-semibold">{devCodeHint}</span>
                    </p>
                  )}
                </div>
              )}

              <LiquidButton
                onClick={isCodeStage ? handleVerifyLogin : handleRequestLoginCode}
                className="w-full"
                variant="default"
                disabled={isSyncing}
              >
                {isSyncing
                  ? "Łączenie z bazą..."
                  : isCodeStage
                    ? "Potwierdź i wejdź"
                    : "Wyślij kod logowania"}
              </LiquidButton>
              {isCodeStage && (
                <button
                  onClick={() => {
                    setIsCodeStage(false);
                    setLoginCode("");
                    setDevCodeHint(null);
                  }}
                  className="w-full text-center text-white/55 text-sm hover:text-white/75 transition-colors"
                >
                  Zmień e-mail
                </button>
              )}
              {dataSyncError && (
                <p className="text-[#FF9F0A] text-sm text-center">{dataSyncError}</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-24 relative"
      style={{ backgroundColor: "#0A0A0A", fontFamily: "-apple-system, SF Pro Display, system-ui" }}
    >
      <BackgroundPaths />

      <div className="max-w-[430px] mx-auto relative z-10">
        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="animate-scale-in">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: "rgba(48, 209, 88, 0.30)", backdropFilter: "blur(24px)" }}
              >
                <Check className="w-12 h-12" style={{ color: "#30D158", strokeWidth: 3 }} />
              </div>
            </div>
          </div>
        )}

        {showSettings && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center"
            onClick={() => {
              void handleCloseSettings();
            }}
          >
            <div
              className="w-full max-w-md"
              onClick={(event) => event.stopPropagation()}
            >
              <GlassCard className="max-h-[82vh] overflow-y-auto p-0">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-white text-lg font-semibold">Ustawienia</p>
                    <p className="text-white/45 text-xs">Dopasuj progi klasyfikacji</p>
                  </div>
                  <button
                    onClick={() => {
                      void handleCloseSettings();
                    }}
                    className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-white/65 hover:text-white"
                    aria-label="Zamknij ustawienia"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 py-5 space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-white text-sm font-semibold mb-1">{user?.name}</p>
                    <p className="text-white/50 text-xs">{user?.email}</p>
                  </div>

                  <SettingsSection
                    title="Zakres ciśnienia"
                    description="Podaj granice niskiego i wysokiego ciśnienia — klasyfikacja wylicza się automatycznie"
                    isOpen={settingsSections.pressure}
                    onToggle={() => toggleSettingsSection("pressure")}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <SettingsField
                        label="Niskie SYS (<)"
                        value={draftPreferences.pressure.lowSys}
                        onChange={(next) =>
                          applyPressureRangeDraft({
                            lowSys: numberFromInput(next, draftPreferences.pressure.lowSys),
                            lowDia: draftPreferences.pressure.lowDia,
                            highSys: draftPreferences.pressure.high1Sys,
                            highDia: draftPreferences.pressure.high1Dia,
                          })
                        }
                      />
                      <SettingsField
                        label="Niskie DIA (<)"
                        value={draftPreferences.pressure.lowDia}
                        onChange={(next) =>
                          applyPressureRangeDraft({
                            lowSys: draftPreferences.pressure.lowSys,
                            lowDia: numberFromInput(next, draftPreferences.pressure.lowDia),
                            highSys: draftPreferences.pressure.high1Sys,
                            highDia: draftPreferences.pressure.high1Dia,
                          })
                        }
                      />
                      <SettingsField
                        label="Wysokie SYS (>=)"
                        value={draftPreferences.pressure.high1Sys}
                        onChange={(next) =>
                          applyPressureRangeDraft({
                            lowSys: draftPreferences.pressure.lowSys,
                            lowDia: draftPreferences.pressure.lowDia,
                            highSys: numberFromInput(next, draftPreferences.pressure.high1Sys),
                            highDia: draftPreferences.pressure.high1Dia,
                          })
                        }
                      />
                      <SettingsField
                        label="Wysokie DIA (>=)"
                        value={draftPreferences.pressure.high1Dia}
                        onChange={(next) =>
                          applyPressureRangeDraft({
                            lowSys: draftPreferences.pressure.lowSys,
                            lowDia: draftPreferences.pressure.lowDia,
                            highSys: draftPreferences.pressure.high1Sys,
                            highDia: numberFromInput(next, draftPreferences.pressure.high1Dia),
                          })
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

                  <div className="pt-1 flex flex-col items-center gap-3">
                    <div className="w-full max-w-[280px]">
                      <SettingsActionButton icon={Download} onClick={handleExportData}>
                        Eksport danych
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

        {currentTab === "dashboard" && (
          <div className="p-6 space-y-6">
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-white text-3xl font-bold mb-1">{welcomeLine}</h1>
                <p className="text-white/55 text-base">{formatDate(localNow)}</p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
                aria-label="Otwórz ustawienia użytkownika"
              >
                <Settings className="w-5 h-5 text-white/80" />
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={streakGraphic.src}
                  alt={streakGraphic.alt}
                  className="w-10 h-10 object-contain"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <p className="text-white text-sm font-medium">Passa</p>
                  <p className="text-white/45 text-xs">rekord: {streak.best} dni</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-2xl font-semibold tabular-nums leading-none">{streak.current}</p>
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
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-white font-bold" style={{ fontSize: "72px", letterSpacing: "-2px" }}>
                      {readings[0].systolic}
                    </span>
                    <span className="text-white/55 font-bold text-5xl mx-2">/</span>
                    <span className="text-white font-bold" style={{ fontSize: "72px", letterSpacing: "-2px" }}>
                      {readings[0].diastolic}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Heart className="w-5 h-5 text-white/55" />
                    <span className="text-white text-2xl font-semibold">{readings[0].pulse}</span>
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

                  <div className="flex justify-center mb-3">
                    <CategoryBadge category={getPressureCategory(readings[0].systolic, readings[0].diastolic)} />
                  </div>

                  <p className="text-white/30 text-center text-sm">
                    {formatTime(readings[0].timestamp)} • {formatDate(readings[0].timestamp)}
                  </p>
                </GlassCard>

                {readings.length > 1 && (
                  <GlassCard>
                    <h2 className="text-white text-lg font-semibold mb-4">Ostatnie 7 dni</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData.slice(-7)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.30)" style={{ fontSize: "12px" }} />
                        <YAxis stroke="rgba(255,255,255,0.30)" style={{ fontSize: "12px" }} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(255, 255, 255, 0.06)",
                            backdropFilter: "blur(24px)",
                            border: "1px solid rgba(255, 255, 255, 0.10)",
                            borderRadius: "12px",
                            color: "#FFFFFF",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="sys"
                          stroke="#0A84FF"
                          strokeWidth={2}
                          dot={{ fill: "#0A84FF", strokeWidth: 2, stroke: "#FFFFFF", r: 4 }}
                          style={{ filter: "drop-shadow(0 0 6px #0A84FF)" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="dia"
                          stroke="#FF9F0A"
                          strokeWidth={2}
                          dot={{ fill: "#FF9F0A", strokeWidth: 2, stroke: "#FFFFFF", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassCard>
                )}
              </>
            )}
          </div>
        )}

        {currentTab === "add" && (
          <div className="p-6 space-y-6">
            <GlassCard>
              <h2 className="text-white text-2xl font-bold mb-6 text-center">Nowy pomiar</h2>
              <div className="flex justify-center gap-3 mb-6">
                <ScrollPicker value={systolic} onChange={setSystolic} min={60} max={250} label="SYS" />
                <ScrollPicker value={diastolic} onChange={setDiastolic} min={40} max={150} label="DIA" />
                <ScrollPicker value={pulse} onChange={setPulse} min={30} max={200} label="PULS" />
              </div>
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
          <div className="p-6 space-y-4">
            <h1 className="text-white text-3xl font-bold mb-6 pt-4">Historia</h1>
            {readings.length === 0 ? (
              <GlassCard>
                <p className="text-white/55 text-center py-8">Brak pomiarów</p>
              </GlassCard>
            ) : (
              readings.map((reading) => (
                <GlassCard key={reading.id} className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white/55 text-sm mb-2">{formatTime(reading.timestamp)}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white text-3xl font-bold">
                          {reading.systolic}/{reading.diastolic}
                        </span>
                        <span
                          className="text-lg whitespace-nowrap"
                          style={{ color: getPulseCategoryColor(getPulseCategory(reading.pulse)) }}
                        >
                          • {reading.pulse} bpm
                        </span>
                      </div>
                      <p
                        className="text-xs mb-2"
                        style={{ color: getPulseCategoryColor(getPulseCategory(reading.pulse)) }}
                      >
                        {getPulseCategoryLabel(getPulseCategory(reading.pulse))}
                      </p>

                      {reading.note && <p className="text-white/30 text-sm italic mt-2">{reading.note}</p>}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <CategoryBadge category={getPressureCategory(reading.systolic, reading.diastolic)} />
                      <button
                        onClick={() => handleDeleteReading(reading.id)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-white/55" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ))
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
                    background: timeRange === range ? "#0A84FF" : "rgba(255, 255, 255, 0.06)",
                    color: "#FFFFFF",
                    border: `1px solid ${timeRange === range ? "#0A84FF" : "rgba(255, 255, 255, 0.10)"}`,
                  }}
                >
                  {range === "all" ? "Wszystko" : range}
                </button>
              ))}
            </div>

            {stats && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <GlassCard>
                    <p className="text-white/55 text-sm mb-2">Średnia SYS</p>
                    <p className="text-white text-3xl font-bold">{stats.avgSys}</p>
                  </GlassCard>
                  <GlassCard>
                    <p className="text-white/55 text-sm mb-2">Średnia DIA</p>
                    <p className="text-white text-3xl font-bold">{stats.avgDia}</p>
                  </GlassCard>
                  <GlassCard>
                    <p className="text-white/55 text-sm mb-2">Średni puls</p>
                    <p className="text-white text-3xl font-bold">{stats.avgPulse}</p>
                  </GlassCard>
                  <GlassCard>
                    <p className="text-white/55 text-sm mb-2">% w normie</p>
                    <p className="text-white text-3xl font-bold">{stats.normalPercent}%</p>
                  </GlassCard>
                </div>

                <GlassCard>
                  <h3 className="text-white text-lg font-semibold mb-4">Wykres ciśnienia</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.30)" style={{ fontSize: "11px" }} />
                      <YAxis stroke="rgba(255,255,255,0.30)" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255, 255, 255, 0.06)",
                          backdropFilter: "blur(24px)",
                          border: "1px solid rgba(255, 255, 255, 0.10)",
                          borderRadius: "12px",
                          color: "#FFFFFF",
                        }}
                      />
                      <ReferenceLine y={120} stroke="rgba(255,255,255,0.20)" strokeDasharray="3 3" />
                      <ReferenceLine y={80} stroke="rgba(255,255,255,0.20)" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="sys"
                        stroke="#0A84FF"
                        strokeWidth={2}
                        dot={{ fill: "#0A84FF", strokeWidth: 2, stroke: "#FFFFFF", r: 4 }}
                        style={{ filter: "drop-shadow(0 0 6px #0A84FF)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="dia"
                        stroke="#FF9F0A"
                        strokeWidth={2}
                        dot={{ fill: "#FF9F0A", strokeWidth: 2, stroke: "#FFFFFF", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </GlassCard>

              </>
            )}
          </div>
        )}

        <div
          className="fixed bottom-0 left-0 right-0"
          style={{
            maxWidth: "430px",
            margin: "0 auto",
          }}
        >
          <InteractiveMenu
            items={menuItems}
            accentColor="#0A84FF"
            activeIndex={tabToIndex[currentTab]}
            onItemClick={handleTabChange}
          />
        </div>
      </div>
    </div>
  );
};

export default BloodPressureApp;
