export type AccentColor = "blueberry" | "cherry" | "kiwi" | "orange";

export type MermaidThemeName = "default" | "dark" | "base" | "forest" | "neutral";

export type MermaidThemeConfig = {
  theme: MermaidThemeName;
  look?: "classic" | "handDrawn";
  themeVariables?: Record<string, string>;
};

// Light-mode custom themes per accent color.
// Dark mode always uses mermaid "dark" theme.
const LIGHT_THEMES: Record<AccentColor, MermaidThemeConfig> = {
  blueberry: { theme: "default" },
  cherry: {
    theme: "base",
    themeVariables: {
      primaryColor:          "#FFD7DC",
      primaryTextColor:      "#5C3D3D",
      primaryBorderColor:    "#E5394F",
      lineColor:             "#C2273C",
      secondaryColor:        "#FFF0F3",
      secondaryBorderColor:  "#E5394F",
      secondaryTextColor:    "#5C3D3D",
      tertiaryColor:         "#FDF5F6",
      tertiaryBorderColor:   "#E5394F",
      tertiaryTextColor:     "#5C3D3D",
      background:            "#FEFAFA",
      mainBkg:               "#FFD7DC",
      nodeBorder:            "#E5394F",
      clusterBkg:            "#FFF0F3",
      clusterBorder:         "#E5394F",
      defaultLinkColor:      "#C2273C",
      titleColor:            "#5C3D3D",
      edgeLabelBackground:   "#FEFAFA",
      textColor:             "#5C3D3D",
      noteBkgColor:          "#FFF0F3",
      noteTextColor:         "#5C3D3D",
      noteBorderColor:       "#E5394F",
    },
  },
  kiwi: {
    theme: "base",
    themeVariables: {
      primaryColor:          "#D4F4D4",
      primaryTextColor:      "#3D5C3D",
      primaryBorderColor:    "#4BA24B",
      lineColor:             "#3A8C3A",
      secondaryColor:        "#EDFAED",
      secondaryBorderColor:  "#4BA24B",
      secondaryTextColor:    "#3D5C3D",
      tertiaryColor:         "#F2FAF2",
      tertiaryBorderColor:   "#4BA24B",
      tertiaryTextColor:     "#3D5C3D",
      background:            "#FAFEFA",
      mainBkg:               "#D4F4D4",
      nodeBorder:            "#4BA24B",
      clusterBkg:            "#EDFAED",
      clusterBorder:         "#4BA24B",
      defaultLinkColor:      "#3A8C3A",
      titleColor:            "#3D5C3D",
      edgeLabelBackground:   "#FAFEFA",
      textColor:             "#3D5C3D",
      noteBkgColor:          "#EDFAED",
      noteTextColor:         "#3D5C3D",
      noteBorderColor:       "#4BA24B",
    },
  },
  orange: {
    theme: "base",
    themeVariables: {
      primaryColor:          "#FFE0B8",
      primaryTextColor:      "#5C4A3D",
      primaryBorderColor:    "#FF8A1E",
      lineColor:             "#E07010",
      secondaryColor:        "#FFF3E8",
      secondaryBorderColor:  "#FF8A1E",
      secondaryTextColor:    "#5C4A3D",
      tertiaryColor:         "#FEF6EF",
      tertiaryBorderColor:   "#FF8A1E",
      tertiaryTextColor:     "#5C4A3D",
      background:            "#FEFBFA",
      mainBkg:               "#FFE0B8",
      nodeBorder:            "#FF8A1E",
      clusterBkg:            "#FFF3E8",
      clusterBorder:         "#FF8A1E",
      defaultLinkColor:      "#E07010",
      titleColor:            "#5C4A3D",
      edgeLabelBackground:   "#FEFBFA",
      textColor:             "#5C4A3D",
      noteBkgColor:          "#FFF3E8",
      noteTextColor:         "#5C4A3D",
      noteBorderColor:       "#FF8A1E",
    },
  },
};

export function getMermaidThemeConfig(accentColor: AccentColor, isDark: boolean, handDrawn = false): MermaidThemeConfig {
  const base: MermaidThemeConfig = isDark ? { theme: "dark" } : (LIGHT_THEMES[accentColor] ?? { theme: "default" });
  if (handDrawn) return { ...base, look: "handDrawn" };
  return base;
}
