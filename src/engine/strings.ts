// UI string tables per locale — the single home for every user-facing label,
// menu hint, stat name, and message the shell paints. Pure and below the seam:
// views take the sub-table they need (`stringsFor(locale).results`, …) and stay
// snapshot-testable; the shell picks the table from the active locale and swaps
// it on `l`. Adding a locale = adding one table here (the interface keeps them
// exhaustive — a missing key fails typecheck).

import type { Locale } from "./locale";
import type { RacerId } from "./race_progress";

/** Post-run results panel: the five headline stat labels + the slow-pairs head. */
export interface ResultsStrings {
  readonly wpm: string;
  readonly rawWpm: string;
  readonly accuracy: string;
  readonly mistakes: string;
  readonly completion: string;
  readonly slowestPairs: string;
}

/** Profile screen: title, stat labels, the trend headline words, empty message. */
export interface ProfileStrings {
  readonly title: string;
  readonly sessions: string;
  readonly empty: string;
  readonly wpm: string;
  readonly accuracy: string;
  readonly best: string;
  readonly avg: string;
  readonly recent: string;
  readonly closeHint: string;
}

/** Header status line above the typing surface. */
export interface HeaderStrings {
  readonly ready: string;
  readonly typing: string;
  /** Post-run banner, e.g. "Time! 30s drill complete — ". */
  readonly done: (seconds: number) => string;
  readonly quitHint: string;
}

/** Persistent footer: state labels + the (localized) key-hint line. */
export interface FooterStrings {
  readonly duration: string;
  readonly category: string;
  readonly theme: string;
  readonly locale: string;
  readonly durationHint: string;
  readonly hints: string;
}

/** Help overlay: title, close hint, and one description per keybinding. The key
 * literals (Tab, ?, 1/2/3, …) are universal and live in the view; only the
 * descriptions are localized here. */
export interface HelpStrings {
  readonly title: string;
  readonly closeHint: string;
  readonly nextExcerpt: string;
  readonly help: string;
  readonly duration: string;
  readonly category: string;
  readonly theme: string;
  readonly locale: string;
  readonly profile: string;
  readonly sources: string;
  readonly quit: string;
  readonly deleteChar: string;
  readonly deleteWord: string;
  readonly deleteToLineStart: string;
  readonly closeOverlay: string;
}

/** Sources screen: title, per-entry framing, empty message, close hint. */
export interface SourcesStrings {
  readonly title: string;
  readonly empty: string;
  readonly closeHint: string;
}

/** Terminal-capability guards (#13): the too-small screen and the pre-boot
 * refusals for a non-TTY / non-raw-mode start. */
export interface TerminalStrings {
  readonly tooSmallTitle: string;
  readonly tooSmallHint: string;
  /** Label preceding the required minimum size (e.g. "minimum 80×24"). */
  readonly minLabel: string;
  /** Label preceding the current size (e.g. "now 60×20"). */
  readonly nowLabel: string;
  readonly notATty: string;
  readonly noRawMode: string;
}

/** Everything the shell and views render, for one locale. */
export interface UIStrings {
  readonly header: HeaderStrings;
  readonly footer: FooterStrings;
  readonly results: ResultsStrings;
  readonly profile: ProfileStrings;
  readonly help: HelpStrings;
  readonly sources: SourcesStrings;
  readonly terminal: TerminalStrings;
  /** Race-lane labels, keyed by racer id (localized in the strip). */
  readonly race: Record<RacerId, string>;
  /** Category-filter display names, keyed by the internal category id. */
  readonly categories: Record<string, string>;
}

const EN: UIStrings = {
  header: {
    ready: "ready",
    typing: "typing",
    done: (seconds) => `Time! ${seconds}s drill complete — `,
    quitHint: "Ctrl-C to quit",
  },
  footer: {
    duration: "Duration",
    category: "Category",
    theme: "Theme",
    locale: "Locale",
    durationHint: "1/2/3 duration",
    hints:
      "Tab next · ? help · c category · t theme · l locale · p profile · " +
      "s sources · Bksp char · Ctrl-Bksp word · Ctrl-U line · q/Ctrl-C quit",
  },
  results: {
    wpm: "WPM",
    rawWpm: "Raw WPM",
    accuracy: "Accuracy",
    mistakes: "Mistakes",
    completion: "Completion",
    slowestPairs: "Slowest pairs",
  },
  profile: {
    title: "Profile",
    sessions: "Sessions",
    empty: "No sessions yet — finish a run to see your trends.",
    wpm: "WPM",
    accuracy: "Accuracy",
    best: "best",
    avg: "avg",
    recent: "recent",
    closeHint: "Profile · any key to close · Ctrl-C quit",
  },
  help: {
    title: "Keybindings",
    closeHint: "Help · ↑/↓ scroll · Esc or q to close · Ctrl-C quit",
    nextExcerpt: "next excerpt",
    help: "this help",
    duration: "duration 15 / 30 / 60s",
    category: "cycle category",
    theme: "toggle theme",
    locale: "toggle locale",
    profile: "profile & trends",
    sources: "excerpt sources",
    quit: "quit",
    deleteChar: "delete character",
    deleteWord: "delete word",
    deleteToLineStart: "delete to line start",
    closeOverlay: "close overlay",
  },
  sources: {
    title: "Sources",
    empty: "No excerpts loaded.",
    closeHint: "Sources · ↑/↓ scroll · Esc or q to close · Ctrl-C quit",
  },
  terminal: {
    tooSmallTitle: "Terminal too small",
    tooSmallHint: "Resize the window to continue.",
    minLabel: "minimum",
    nowLabel: "now",
    notATty:
      "tuiper needs an interactive terminal (TTY). Run it directly in a " +
      "terminal, not through a pipe or redirect.",
    noRawMode:
      "tuiper needs raw-mode keyboard input, which this terminal does not " +
      "provide. Try a different terminal.",
  },
  race: { slow: "Slow", you: "You", fast: "Fast" },
  categories: {
    random: "random",
    scifi: "scifi",
    fantasy: "fantasy",
    biography: "biography",
  },
};

const PT_BR: UIStrings = {
  header: {
    ready: "pronto",
    typing: "digitando",
    done: (seconds) => `Tempo! Treino de ${seconds}s concluído — `,
    quitHint: "Ctrl-C para sair",
  },
  footer: {
    duration: "Duração",
    category: "Categoria",
    theme: "Tema",
    locale: "Idioma",
    durationHint: "1/2/3 duração",
    hints:
      "Tab próximo · ? ajuda · c categoria · t tema · l idioma · p perfil · " +
      "s fontes · Bksp caractere · Ctrl-Bksp palavra · Ctrl-U linha · q/Ctrl-C sair",
  },
  results: {
    wpm: "PPM",
    rawWpm: "PPM bruto",
    accuracy: "Precisão",
    mistakes: "Erros",
    completion: "Conclusão",
    slowestPairs: "Pares mais lentos",
  },
  profile: {
    title: "Perfil",
    sessions: "Sessões",
    empty: "Nenhuma sessão ainda — conclua um treino para ver suas tendências.",
    wpm: "PPM",
    accuracy: "Precisão",
    best: "melhor",
    avg: "média",
    recent: "recente",
    closeHint: "Perfil · qualquer tecla para fechar · Ctrl-C sair",
  },
  help: {
    title: "Atalhos",
    closeHint: "Ajuda · ↑/↓ rolar · Esc ou q para fechar · Ctrl-C sair",
    nextExcerpt: "próximo trecho",
    help: "esta ajuda",
    duration: "duração 15 / 30 / 60s",
    category: "trocar categoria",
    theme: "trocar tema",
    locale: "trocar idioma",
    profile: "perfil e tendências",
    sources: "fontes dos trechos",
    quit: "sair",
    deleteChar: "apagar caractere",
    deleteWord: "apagar palavra",
    deleteToLineStart: "apagar até o início da linha",
    closeOverlay: "fechar sobreposição",
  },
  sources: {
    title: "Fontes",
    empty: "Nenhum trecho carregado.",
    closeHint: "Fontes · ↑/↓ rolar · Esc ou q para fechar · Ctrl-C sair",
  },
  terminal: {
    tooSmallTitle: "Terminal pequeno demais",
    tooSmallHint: "Redimensione a janela para continuar.",
    minLabel: "mínimo",
    nowLabel: "agora",
    notATty:
      "tuiper precisa de um terminal interativo (TTY). Execute-o diretamente " +
      "em um terminal, não através de um pipe ou redirecionamento.",
    noRawMode:
      "tuiper precisa de entrada de teclado em modo raw, que este terminal " +
      "não oferece. Tente outro terminal.",
  },
  race: { slow: "Lento", you: "Você", fast: "Rápido" },
  categories: {
    random: "aleatório",
    scifi: "ficção",
    fantasy: "fantasia",
    biography: "biografia",
  },
};

const TABLES: Record<Locale, UIStrings> = { en: EN, "pt-BR": PT_BR };

/** The UI strings for a locale. Total over `Locale`, so every locale is covered. */
export function stringsFor(locale: Locale): UIStrings {
  return TABLES[locale];
}
