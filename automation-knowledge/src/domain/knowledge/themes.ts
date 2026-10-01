const LIGHT_PAPER = {
  paper: "#FBFAF4",
  ink: "#232323",
} as const;

export const ARTICLE_THEMES = {
  "ink-teal": {
    label: "Ink Teal",
    light: {
      ...LIGHT_PAPER,
      title: "#244F50",
      h1: "#2F6666",
      h2: "#516D6B",
    },
    dark: {
      paper: "#E7EFEC",
      ink: "#253433",
      title: "#214F50",
      h1: "#2F6666",
      h2: "#587773",
    },
  },
  "slate-blue": {
    label: "Slate Blue",
    light: {
      ...LIGHT_PAPER,
      title: "#31485C",
      h1: "#405D78",
      h2: "#607487",
    },
    dark: {
      paper: "#E9EDF3",
      ink: "#29343F",
      title: "#304E6C",
      h1: "#405F80",
      h2: "#687D93",
    },
  },
  "sepia-brown": {
    label: "Sepia Brown",
    light: {
      ...LIGHT_PAPER,
      title: "#5C4738",
      h1: "#6B5544",
      h2: "#846D5C",
    },
    dark: {
      paper: "#F1E7D9",
      ink: "#3E352E",
      title: "#59402F",
      h1: "#6C523D",
      h2: "#896B50",
    },
  },
  "muted-plum": {
    label: "Muted Plum",
    light: {
      ...LIGHT_PAPER,
      title: "#544458",
      h1: "#65506A",
      h2: "#806E83",
    },
    dark: {
      paper: "#EFE3E9",
      ink: "#3D333B",
      title: "#573E54",
      h1: "#6A5267",
      h2: "#866E82",
    },
  },
  "olive-ink": {
    label: "Olive Ink",
    light: {
      ...LIGHT_PAPER,
      title: "#4A5131",
      h1: "#5D6540",
      h2: "#78805C",
    },
    dark: {
      paper: "#ECEBDF",
      ink: "#35392B",
      title: "#465033",
      h1: "#59633F",
      h2: "#747C5A",
    },
  },
  "blue-gray": {
    label: "Blue Gray",
    light: {
      ...LIGHT_PAPER,
      title: "#354B57",
      h1: "#4A6572",
      h2: "#6A7D85",
    },
    dark: {
      paper: "#F0E7D9",
      ink: "#3B3833",
      title: "#67492D",
      h1: "#7A5937",
      h2: "#987650",
    },
  },
} as const;

export type ArticleTheme = keyof typeof ARTICLE_THEMES;

export const DEFAULT_ARTICLE_THEME: ArticleTheme = "ink-teal";

export const ARTICLE_THEME_OPTIONS = Object.entries(ARTICLE_THEMES).map(([value, definition]) => ({
  value: value as ArticleTheme,
  label: definition.label,
}));

export function resolveArticleTheme(theme?: string): ArticleTheme {
  return theme && theme in ARTICLE_THEMES ? (theme as ArticleTheme) : DEFAULT_ARTICLE_THEME;
}

export function getArticleThemeStyle(theme?: string) {
  const resolved = resolveArticleTheme(theme);
  const definition = ARTICLE_THEMES[resolved];
  return {
    "--article-light-paper": definition.light.paper,
    "--article-light-ink": definition.light.ink,
    "--article-light-title": definition.light.title,
    "--article-light-h1": definition.light.h1,
    "--article-light-h2": definition.light.h2,
    "--article-dark-paper": definition.dark.paper,
    "--article-dark-ink": definition.dark.ink,
    "--article-dark-title": definition.dark.title,
    "--article-dark-h1": definition.dark.h1,
    "--article-dark-h2": definition.dark.h2,
  } as const;
}
