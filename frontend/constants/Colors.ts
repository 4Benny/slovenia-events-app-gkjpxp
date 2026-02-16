
// ═══════════════════════════════════════════════════════
// 🎨 KJE DOGAJA - DARK IMMERSIVE NIGHTLIFE THEME
// ═══════════════════════════════════════════════════════

// 1. PRIMARY GRADIENT (Vertical Background)
export const primaryGradientStart = '#140B2D';
export const primaryGradientEnd = '#3A0CA3';

// 2. SECONDARY GRADIENT (Hero Sections)
export const secondaryGradientStart = '#3A0CA3';
export const secondaryGradientEnd = '#C918FF';

// 3. ACCENT COLORS
export const accentOrange = '#FFC83D';      // Gold from logo: CTAs, active states, map pins
export const highlightYellow = '#FFE08A';   // Softer gold for micro accents

// 4. SURFACE & BORDERS
export const surfaceDark = '#1E1333';       // Cards
export const surfaceElevated = '#2A244D';   // Elevated surfaces, skeletons
export const surfaceMuted = '#3F3A66';      // Muted badges, placeholders
export const borderSubtle = 'rgba(255,255,255,0.08)';
export const glowOrange = 'rgba(255,200,61,0.35)';

// Status colors
export const successGreen = '#22C55E';
export const dangerRed = '#B91C1C';

// Rating stars
export const starActive = highlightYellow;
export const starInactive = 'rgba(194,183,230,0.35)';

// 5. TEXT COLORS
export const textPrimary = '#FFFFFF';
export const textSecondary = '#C2B7E6';

// 6. BUTTON COLORS
export const btnPrimaryGradientStart = '#C918FF';
export const btnPrimaryGradientEnd = accentOrange;
export const btnPrimaryText = '#FFFFFF';
export const btnSecondaryBorder = 'rgba(255,255,255,0.15)';
export const btnDisabledOpacity = 0.4;

// 7. NAVIGATION (Floating Bottom Navbar)
export const navBg = 'rgba(30,19,51,0.6)';  // Glassmorphism
export const navIconInactive = textSecondary;
export const navIconActiveGradientStart = '#C918FF'; // Magenta
export const navIconActiveGradientEnd = accentOrange;   // Gold

// 8. FAB (Create Event Button)
export const fabGradientStart = '#C918FF';
export const fabGradientEnd = accentOrange;
export const fabGlow = 'rgba(255,200,61,0.5)';

// 9. INPUT FIELDS
export const inputBg = '#1E1333';
export const inputBorderRadius = 20;
export const inputFocusBorder = accentOrange;
export const inputFocusGlow = 'rgba(255,200,61,0.4)';

// 10. SHADOWS & DEPTH
export const cardShadow = '0 10px 30px rgba(0,0,0,0.4)';

// 11. SHAPE SYSTEM
export const borderRadiusCard = 24;
export const borderRadiusBottomSheet = 32;
export const borderRadiusPill = 9999;
export const borderRadiusInput = 20;

// Role badge colors
export const ROLE_COLORS = {
  user: textSecondary,
  organizer: secondaryGradientEnd,
  organizator: secondaryGradientEnd,
  admin: accentOrange,
};

// Slovenian role labels
export const ROLE_LABELS: Record<string, string> = {
  user: "Uporabnik",
  organizer: "Organizator",
  organizator: "Organizator",
  admin: "Admin",
};

// Helper function to get role label
export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || "Uporabnik";
}

// Helper function to get role color
export function getRoleColor(role: string): string {
  return ROLE_COLORS[role as keyof typeof ROLE_COLORS] || ROLE_COLORS.user;
}

// ═══════════════════════════════════════════════════════
// THEME CONFIGURATION (Dark Immersive Nightlife)
// ═══════════════════════════════════════════════════════
export const Colors = {
  light: {
    // Using dark theme for both (dark-first UI)
    text: textPrimary,
    background: primaryGradientStart,
    tint: accentOrange,
    icon: textSecondary,
    tabIconDefault: navIconInactive,
    tabIconSelected: accentOrange,
    primary: secondaryGradientEnd,
    secondary: accentOrange,
    accent: accentOrange,
    card: surfaceDark,
    border: borderSubtle,
    notification: accentOrange,
    
    // Gradient colors
    primaryGradientStart,
    primaryGradientEnd,
    secondaryGradientStart,
    secondaryGradientEnd,
    
    // Accent colors
    accentOrange,
    highlightYellow,
    
    // Surface & borders
    surfaceDark,
    borderSubtle,
    glowOrange,
    
    // Text colors
    textPrimary,
    textSecondary,
    
    // Button colors
    btnPrimaryGradientStart,
    btnPrimaryGradientEnd,
    btnPrimaryText,
    btnSecondaryBorder,
    btnDisabledOpacity,
    
    // Navigation
    navBg,
    navIconInactive,
    navIconActiveGradientStart,
    navIconActiveGradientEnd,
    
    // FAB
    fabGradientStart,
    fabGradientEnd,
    fabGlow,
    
    // Input
    inputBg,
    inputFocusBorder,
    inputFocusGlow,
    
    // Shapes
    borderRadiusCard,
    borderRadiusBottomSheet,
    borderRadiusPill,
    borderRadiusInput,
  },
  dark: {
    // Same as light (dark-first UI)
    text: textPrimary,
    background: primaryGradientStart,
    tint: accentOrange,
    icon: textSecondary,
    tabIconDefault: navIconInactive,
    tabIconSelected: accentOrange,
    primary: secondaryGradientEnd,
    secondary: accentOrange,
    accent: accentOrange,
    card: surfaceDark,
    border: borderSubtle,
    notification: accentOrange,
    
    // Gradient colors
    primaryGradientStart,
    primaryGradientEnd,
    secondaryGradientStart,
    secondaryGradientEnd,
    
    // Accent colors
    accentOrange,
    highlightYellow,
    
    // Surface & borders
    surfaceDark,
    borderSubtle,
    glowOrange,
    
    // Text colors
    textPrimary,
    textSecondary,
    
    // Button colors
    btnPrimaryGradientStart,
    btnPrimaryGradientEnd,
    btnPrimaryText,
    btnSecondaryBorder,
    btnDisabledOpacity,
    
    // Navigation
    navBg,
    navIconInactive,
    navIconActiveGradientStart,
    navIconActiveGradientEnd,
    
    // FAB
    fabGradientStart,
    fabGradientEnd,
    fabGlow,
    
    // Input
    inputBg,
    inputFocusBorder,
    inputFocusGlow,
    
    // Shapes
    borderRadiusCard,
    borderRadiusBottomSheet,
    borderRadiusPill,
    borderRadiusInput,
  },
};

export const backgroundColors = [
  "#fef2f2",
  "#fee2e2",
  "#fecaca",
  "#fca5a5",
  "#f87171",
  "#ef4444",
  "#dc2626",
  "#b91c1c",
  "#991b1b",
  "#7f1d1d",

  "#fff7ed",
  "#ffedd5",
  "#fed7aa",
  "#fdba74",
  "#fb923c",
  "#f97316",
  "#ea580c",
  "#c2410c",
  "#9a3412",
  "#7c2d12",

  "#fffbeb",
  "#fef3c7",
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#b45309",
  "#92400e",
  "#78350f",

  "#fefce8",
  "#fef9c3",
  "#fef08a",
  "#fde047",
  "#facc15",
  "#eab308",
  "#ca8a04",
  "#a16207",
  "#854d0e",
  "#713f12",

  "#f7fee7",
  "#ecfccb",
  "#d9f99d",
  "#bef264",
  "#a3e635",
  "#84cc16",
  "#65a30d",
  "#4d7c0f",
  "#3f6212",
  "#365314",

  "#f0fdf4",
  "#dcfce7",
  "#bbf7d0",
  "#86efac",
  "#4ade80",
  "#22c55e",
  "#16a34a",
  "#15803d",
  "#166534",
  "#14532d",

  "#ecfdf5",
  "#d1fae5",
  "#a7f3d0",
  "#6ee7b7",
  "#34d399",
  "#10b981",
  "#059669",
  "#047857",
  "#065f46",
  "#064e3b",

  "#f0fdfa",
  "#ccfbf1",
  "#99f6e4",
  "#5eead4",
  "#2dd4bf",
  "#14b8a6",
  "#0d9488",
  "#0f766e",
  "#115e59",
  "#134e4a",

  "#f0f9ff",
  "#e0f2fe",
  "#bae6fd",
  "#7dd3fc",
  "#38bdf8",
  "#0ea5e9",
  "#0284c7",
  "#0369a1",
  "#075985",
  "#0c4a6e",

  "#eff6ff",
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",

  "#eef2ff",
  "#e0e7ff",
  "#c7d2fe",
  "#a5b4fc",
  "#818cf8",
  "#6366f1",
  "#4f46e5",
  "#4338ca",
  "#3730a3",
  "#312e81",

  "#f5f3ff",
  "#ede9fe",
  "#ddd6fe",
  "#c4b5fd",
  "#a78bfa",
  "#8b5cf6",
  "#7c3aed",
  "#6d28d9",
  "#5b21b6",
  "#4c1d95",

  "#faf5ff",
  "#f3e8ff",
  "#e9d5ff",
  "#d8b4fe",
  "#c084fc",
  "#a855f7",
  "#9333ea",
  "#7e22ce",
  "#6b21a8",
  "#581c87",

  "#fdf4ff",
  "#fae8ff",
  "#f5d0fe",
  "#f0abfc",
  "#e879f9",
  "#d946ef",
  "#c026d3",
  "#a21caf",
  "#86198f",
  "#701a75",

  "#fdf2f8",
  "#fce7f3",
  "#fbcfe8",
  "#f9a8d4",
  "#f472b6",
  "#ec4899",
  "#db2777",
  "#be185d",
  "#9d174d",
  "#831843",

  "#fff1f2",
  "#ffe4e6",
  "#fecdd3",
  "#fda4af",
  "#fb7185",
  "#f43f5e",
  "#e11d48",
  "#be123c",
  "#9f1239",
  "#881337",
];

export const emojies = [
  // Fruits
  "🍏",
  "🍎",
  "🍐",
  "🍊",
  "🍋",
  "🍌",
  "🍉",
  "🍇",
  "🍓",
  "🫐",
  "🍈",
  "🍒",
  "🍑",
  "🥭",
  "🍍",
  "🥥",
  "🥝",

  // Vegetables
  "🍅",
  "🍆",
  "🥑",
  "🥦",
  "🥬",
  "🥒",
  "🌶",
  "🫑",
  "🌽",
  "🥕",
  "🥔",
  "🧄",
  "🧅",
  "🍄",

  // Breads & Bakery
  "🍞",
  "🥖",
  "🥨",
  "🥐",
  "🥯",

  // Dairy & Eggs
  "🧀",
  "🥚",
  "🍳",
  "🥞",
  "🧇",

  // Meats
  "🥓",
  "🥩",
  "🍗",
  "🍖",

  // Fast Foods
  "🌭",
  "🍔",
  "🍟",
  "🍕",

  // Wraps, Sandwiches & Ethnic Foods
  "🥪",
  "🌮",
  "🌯",
  "🫔",
  "🥙",
  "🧆",

  // Pasta, Rice & Asian Foods
  "🍜",
  "🍝",
  "🍣",
  "🍤",
  "🍙",
  "🍚",
  "🍛",
  "🍲",
  "🥘",
  "🥗",

  // Snacks & Misc
  "🍿",
  "🧈",
  "🥫",
  "🍱",
  "🥮",
  "🍠",
  "🍥",
  "🥟",
  "🥠",
  "🥡",

  // Desserts & Sweets
  "🍦",
  "🍧",
  "🍨",
  "🍩",
  "🍪",
  "🧁",
  "🍰",
  "🎂",
  "🍮",
  "🍭",
  "🍬",
  "🍫",
  "🍯",

  // Nuts
  "🥜",
  "🌰",

  // Drinks
  "🥛",
  "🧃",
  "🧉",
  "🥤",
  "🍶",
  "🍵",
  "🍺",
  "🍻",
  "🥂",
  "🍷",
  "🍸",
  "🍹",
  "🥃",
  "🍾",
  "☕️",
  "🫖",

  // Utensils & Condiments
  "🥄",
  "🍴",
  "🍽",
  "🥢",
  "🧂",

  // Shopping & Payment
  "🛒",
  "🛍️",
  "🧺",
  "💳",
  "💸",
  "💵",
  "💰",
  "💲",
  "🧾",
  "🔖",
  "🏪",
  "🏬",
  "🏦",
  "🏧",
  "📦",
  "📮",
  "🏷️",

  // Organizational / Utility
  "✅",
  "📋",
  "📜",
  "✏️",
  "📝",
  "🔍",
  "📆",
  "⏰",
  "📱",
  "💻",
  "🌐",
  "🔗",
  "🔒",
  "🔑",
  "🗃️",
  "🗂️",
  "🔄",
  "💡",
  "⭐️",
  "📌",
  "📍",
  "📊",
  "💯",
  "🎉",
  "🎊",
  "🎁",
  "🏆",
  "⚖️",
  "🏠",

  // Transportation & Movement (for shopping trips)
  "🚗",
  "🏃‍♂️",
  "🏃‍♀️",
  "🚶‍♂️",
  "🚶‍♀️",

  // Clothing (Items to buy)
  "👕",
  "👖",
  "👗",
  "👔",
  "🩳",
  "👠",
  "👟",
  "🧥",
  "🧤",
  "🧣",
  "🧦",
  "🎒",
  "👜",
  "👛",
  "👓",
  "🕶️",
  "👒",

  // Household Items (Things you might add to a shopping list)
  "🪣",
  "🪑",
  "🛋️",
  "🚪",
  "🪟",
  "🏺",
  "🖼️",
  "📺",
  "📻",
  "🔌",
  "🧴",
  "🪥",
  "🧹",
  "🧽",
  "🗑️",
  "🪒",
  "💊",
  "💉",
  "🩹",
  "❤️",
  "💔",
  "💘",
  "💙",
  "💚",
  "💛",
  "💜",
];
