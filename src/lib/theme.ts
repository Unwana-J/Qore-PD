export const THEME_COLORS = [
  'indigo', 'teal', 'emerald', 'rose', 'amber', 'sky', 'violet', 'orange', 'pink', 'slate'
] as const;

export type ThemeColor = typeof THEME_COLORS[number];

export const getThemeClasses = (color: string) => {
  const base = color || 'indigo';
  
  // Dynamic class generation to avoid massive boilerplate
  return {
    bg: `bg-${base}-600`,
    text: `text-${base}-600`,
    border: `border-${base}-600`,
    hoverBg: `hover:bg-${base}-700`,
    hoverText: `hover:text-${base}-600`,
    hoverBorder: `hover:border-${base}-300`,
    lightBg: base === 'slate' ? 'bg-slate-50' : `bg-${base}-50`,
    lightText: `text-${base}-600`,
    lightBorder: `border-${base}-100`,
    groupHoverText: `group-hover:text-${base}-600`,
    ring: `focus:ring-${base}-500/20`,
    shadow: `shadow-${base}-200`,
    borderLight: `border-${base}-100`,
    hoverLightBg: `hover:bg-${base}-50`,
    focusBorder: `focus:border-${base}-500`,
    ringStatic: `ring-${base}-500`,
    borderStatic: `border-${base}-200`
  };
};
