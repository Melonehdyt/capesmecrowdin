import type { AppData, Language, Project, StringEntry, User, TranslationStatus } from "./types.js";

const tw = (c: string) => `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${c}.svg`;
const minutes = (n: number) => Date.now() - n * 60_000;

function lang(code: string, name: string, native: string, flag: string, source = false): Language {
  return { code, name, native, flag, source };
}

export const LANGUAGES: Language[] = [
  lang("en", "English", "English", tw("1f1fa-1f1f8"), true),
  lang("cs", "Czech", "Čeština", tw("1f1e8-1f1ff")),
  lang("da", "Danish", "Dansk", tw("1f1e9-1f1f0")),
  lang("de", "German", "Deutsch", tw("1f1e9-1f1ea")),
  lang("el", "Greek", "Ελληνικά", tw("1f1ec-1f1f7")),
  lang("es-ES", "Spanish", "Español", tw("1f1ea-1f1f8")),
  lang("fr", "French", "Français", tw("1f1eb-1f1f7")),
  lang("he", "Hebrew", "עברית", tw("1f1ee-1f1f1")),
  lang("hi", "Hindi", "हिन्दी", tw("1f1ee-1f1f3")),
  lang("id", "Indonesian", "Bahasa Indonesia", tw("1f1ee-1f1e9")),
  lang("it", "Italian", "Italiano", tw("1f1ee-1f1f9")),
  lang("ja", "Japanese", "日本語", tw("1f1ef-1f1f5")),
  lang("ko", "Korean", "한국어", tw("1f1f0-1f1f7")),
  lang("nl", "Dutch", "Nederlands", tw("1f1f3-1f1f1")),
  lang("pl", "Polish", "Polski", tw("1f1f5-1f1f1")),
  lang("pt-BR", "Portuguese (Brazil)", "Português (Brasil)", tw("1f1e7-1f1f7")),
  lang("pt-PT", "Portuguese (Portugal)", "Português (Portugal)", tw("1f1f5-1f1f9")),
  lang("ro", "Romanian", "Română", tw("1f1f7-1f1f4")),
  lang("ru", "Russian", "Русский", tw("1f1f7-1f1fa")),
  lang("sv-SE", "Swedish", "Svenska", tw("1f1f8-1f1ea")),
  lang("tr", "Turkish", "Türkçe", tw("1f1f9-1f1f7")),
  lang("uk", "Ukrainian", "Українська", tw("1f1fa-1f1e6")),
  lang("zh-CN", "Chinese (Simplified)", "简体中文", tw("1f1e8-1f1f3")),
  lang("zh-TW", "Chinese (Traditional)", "繁體中文", tw("1f1f9-1f1fc")),
];

export const USERS: User[] = [
  { id: "u_admin", username: "capes_admin", displayName: "Capes Admin", role: "admin", languages: [], joinedAt: minutes(90_000) },
  { id: "u_manager", username: "localize_lead", displayName: "Localization Lead", role: "manager", languages: [], joinedAt: minutes(52_000) },
  { id: "u_proof", username: "mira.dev", displayName: "Mira", role: "proofreader", languages: ["de", "fr", "nl"], joinedAt: minutes(41_000) },
  { id: "u_trans", username: "spanish_park", displayName: "Spanish Park", role: "translator", languages: ["es-ES", "pt-BR"], joinedAt: minutes(33_000) },
  { id: "u_kael", username: "kael_tt", displayName: "Kael", role: "translator", languages: ["ja", "ko"], joinedAt: minutes(28_000) },
  { id: "u_lucas", username: "lucasbr", displayName: "Lucas", role: "translator", languages: ["pt-BR"], joinedAt: minutes(22_000) },
  { id: "u_claire", username: "claire_fr", displayName: "Claire", role: "proofreader", languages: ["fr", "it"], joinedAt: minutes(19_000) },
  { id: "u_yuki", username: "yuki.jp", displayName: "Yuki", role: "translator", languages: ["ja"], joinedAt: minutes(11_000) },
];

function entry(
  file: string,
  key: string,
  ctx: string,
  max: number,
  source: string,
  tr: Record<string, string>,
  status: Record<string, TranslationStatus>
): StringEntry {
  const translations: StringEntry["translations"] = {};
  for (const code of Object.keys(tr)) {
    translations[code] = { text: tr[code], status: status[code] || "translated" };
  }
  return { file, key, context: ctx, max, source, translations };
}

function seedStrings(): StringEntry[] {
  return [
    entry("navigation.json", "nav.home", "Main navigation link", 16, "Home",
      { "es-ES": "Inicio", fr: "Accueil", de: "Startseite", "pt-BR": "Início", it: "Home", ru: "Главная", ja: "ホーム", pl: "Strona główna", nl: "Home", tr: "Ana sayfa", "zh-CN": "首页" },
      { "es-ES": "approved", fr: "approved", de: "approved", "pt-BR": "translated", it: "translated", ru: "translated", ja: "approved", pl: "translated", nl: "translated", tr: "translated", "zh-CN": "translated" }),
    entry("navigation.json", "nav.capes", "Main navigation link", 18, "Cape Rankings",
      { "es-ES": "Ranking de capas", fr: "Classement des capes", de: "Cape-Rangliste", "pt-BR": "Ranking de capes", ja: "ケープランキング" },
      { "es-ES": "approved", fr: "translated", de: "approved", "pt-BR": "translated", ja: "translated" }),
    entry("navigation.json", "nav.compare", "Main navigation link", 20, "Compare accounts",
      { "es-ES": "Comparar cuentas", fr: "Comparer les comptes", de: "Konten vergleichen", "pt-BR": "Comparar contas" },
      { "es-ES": "approved", fr: "translated", de: "approved", "pt-BR": "translated" }),
    entry("navigation.json", "nav.activity", "Main navigation link", 14, "Activity",
      { "es-ES": "Actividad", fr: "Activité", de: "Aktivität", "pt-BR": "Atividade" },
      { "es-ES": "approved", fr: "approved", de: "approved", "pt-BR": "translated" }),
    entry("home.json", "home.hero.title", "Landing hero heading", 60, "Discover Minecraft capes and top-ranked accounts",
      { "es-ES": "Descubre capas de Minecraft y cuentas destacadas", fr: "Découvrez les capes Minecraft et les comptes les mieux classés", de: "Entdecke Minecraft-Umhänge und Top-Konten", "pt-BR": "Descubra capas de Minecraft e contas mais bem classificadas" },
      { "es-ES": "approved", fr: "translated", de: "translated", "pt-BR": "translated" }),
    entry("home.json", "home.hero.sub", "Landing hero subheading", 140, "Pick capes to filter, or hit View All for the full rankings.",
      { "es-ES": "Elige capas para filtrar o pulsa Ver todo para ver el ranking completo.", fr: "Choisissez des capes pour filtrer, ou cliquez sur Tout voir pour le classement complet.", de: "Wähle Umhänge zum Filtern oder klicke auf Alle anzeigen für die komplette Rangliste." },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("home.json", "home.cta.viewall", "Primary call to action button", 20, "View All",
      { "es-ES": "Ver todo", fr: "Tout voir", de: "Alle anzeigen", "pt-BR": "Ver tudo", ru: "Посмотреть все", ja: "すべて表示" },
      { "es-ES": "approved", fr: "approved", de: "approved", "pt-BR": "translated", ru: "translated", ja: "translated" }),
    entry("home.json", "home.member", "{count} is a number, keep the placeholder", 40, "{count} members online",
      { "es-ES": "{count} miembros en línea", fr: "{count} membres en ligne", de: "{count} Mitglieder online" },
      { "es-ES": "approved", fr: "approved", de: "translated" }),
    entry("capes.json", "capes.filter.title", "Filter panel heading", 24, "Saved filters",
      { "es-ES": "Filtros guardados", fr: "Filtres enregistrés", de: "Gespeicherte Filter" },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("capes.json", "capes.filter.save", "Button to save the current filter", 18, "Save current",
      { "es-ES": "Guardar actual", fr: "Enregistrer", de: "Aktuelles speichern" },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("capes.json", "capes.order.label", "Label for cape ordering dropdown", 16, "Cape order",
      { "es-ES": "Orden de capas", fr: "Ordre des capes", de: "Cape-Reihenfolge" },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("capes.json", "capes.removed.hide", "Radio option", 22, "Hide Removed Capes",
      { "es-ES": "Ocultar capas eliminadas", fr: "Masquer les capes supprimées" },
      { "es-ES": "approved", fr: "translated" }),
    entry("capes.json", "capes.count.label", "Floating label on number input", 22, "Number of Capes",
      { "es-ES": "Número de capas", fr: "Nombre de capes" },
      { "es-ES": "approved", fr: "translated" }),
    entry("account.json", "account.login.title", "Login screen heading", 24, "Edit Profile",
      { "es-ES": "Editar perfil", fr: "Modifier le profil", de: "Profil bearbeiten", "pt-BR": "Editar perfil" },
      { "es-ES": "approved", fr: "approved", de: "translated", "pt-BR": "translated" }),
    entry("account.json", "account.login.submit", "Login button label", 16, "Sign In",
      { "es-ES": "Iniciar sesión", fr: "Connexion", de: "Anmelden", "pt-BR": "Entrar" },
      { "es-ES": "approved", fr: "approved", de: "approved", "pt-BR": "translated" }),
    entry("account.json", "account.logout", "Logout button label", 14, "Log Out",
      { "es-ES": "Cerrar sesión", fr: "Déconnexion", de: "Abmelden" },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("account.json", "account.email", "Email field placeholder", 20, "Email address",
      { "es-ES": "Correo electrónico", fr: "Adresse e-mail", de: "E-Mail-Adresse" },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("errors.json", "error.required", "Validation error message", 40, "This field is required",
      { "es-ES": "Este campo es obligatorio", fr: "Ce champ est obligatoire", de: "Dieses Feld ist erforderlich", "pt-BR": "Este campo é obrigatório" },
      { "es-ES": "approved", fr: "approved", de: "translated", "pt-BR": "translated" }),
    entry("errors.json", "error.notfound", "404 page heading", 30, "Nothing to see here",
      { "es-ES": "No hay nada que ver aquí", fr: "Rien à voir ici", de: "Hier gibt es nichts zu sehen" },
      { "es-ES": "translated", fr: "translated", de: "translated" }),
    entry("errors.json", "error.network", "Shown when the request fails", 60, "Could not reach the server. Try again.",
      { "es-ES": "No se pudo conectar con el servidor. Inténtalo de nuevo.", fr: "Impossible d'atteindre le serveur. Réessayez.", de: "Server nicht erreichbar. Versuche es erneut." },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("footer.json", "footer.privacy", "Footer legal link", 20, "Privacy Policy",
      { "es-ES": "Política de privacidad", fr: "Politique de confidentialité", de: "Datenschutzrichtlinie" },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("footer.json", "footer.api", "Footer developer link", 12, "Capes API",
      { "es-ES": "API de capas", fr: "API des capes", de: "Capes-API" },
      { "es-ES": "approved", fr: "translated", de: "translated" }),
    entry("footer.json", "footer.donate", "Footer support link", 14, "Donate",
      { "es-ES": "Donar", fr: "Faire un don", de: "Spenden" },
      { "es-ES": "approved", fr: "approved", de: "translated" }),
    entry("common.json", "common.copy", "Copy button label", 10, "Copy",
      { "es-ES": "Copiar", fr: "Copier", de: "Kopieren", "pt-BR": "Copiar", ru: "Копировать" },
      { "es-ES": "approved", fr: "approved", de: "approved", "pt-BR": "translated", ru: "translated" }),
  ];
}

function cloneStrings(list: StringEntry[], keep: number): StringEntry[] {
  const out: StringEntry[] = [];
  for (let i = 0; i < keep; i++) {
    const s = list[i % list.length];
    out.push(JSON.parse(JSON.stringify(s)) as StringEntry);
  }
  return out;
}

const MASTER = seedStrings();

export function createSeed(): AppData {
  const base: Omit<Project, "strings" | "languages">[] = [
    { id: "capes-site", name: "Capes.me Website", desc: "Marketing pages, rankings UI and account flows.", icon: "globe", color: "blue", source: "en", members: 214, updated: minutes(12), activity: [] },
    { id: "cape-viewer", name: "Cape Viewer (Desktop)", desc: "Electron desktop app for browsing cape collections.", icon: "monitor", color: "teal", source: "en", members: 88, updated: minutes(60), activity: [] },
    { id: "mobile-app", name: "Capes Mobile", desc: "iOS and Android companion app.", icon: "phone", color: "violet", source: "en", members: 156, updated: minutes(180), activity: [] },
    { id: "api-docs", name: "Capes API Documentation", desc: "Developer portal and API references.", icon: "book", color: "amber", source: "en", members: 42, updated: minutes(1_440), activity: [] },
    { id: "launcher", name: "Launcher Strings", desc: "In-game launcher and mod loader text.", icon: "box", color: "blue", source: "en", members: 301, updated: minutes(2_880), activity: [] },
    { id: "support-kb", name: "Support Knowledge Base", desc: "FAQ, privacy policy and help center articles.", icon: "life", color: "teal", source: "en", members: 27, updated: minutes(5_760), activity: [] },
  ];

  const projects: Project[] = base.map((p, idx) => ({
    ...p,
    languages: idx === 0
      ? ["es-ES", "fr", "de", "pt-BR", "ja", "it", "ru", "nl", "pl", "tr", "zh-CN"]
      : ["es-ES", "fr", "de", "pt-BR"],
    strings: idx === 0 ? cloneStrings(MASTER, MASTER.length) : cloneStrings(MASTER, 8 + idx),
    activity: [
      { kind: "ok", text: "<b>mira.dev</b> approved 24 strings in <b>German</b>", time: minutes(12) },
      { kind: "info", text: "<b>kael_tt</b> translated <b>nav.capes</b> in <b>Japanese</b>", time: minutes(38) },
      { kind: "warn", text: "QA flagged 3 strings with a missing placeholder in <b>French</b>", time: minutes(72) },
      { kind: "info", text: "<b>new locale added:</b> Ukrainian (Українська)", time: minutes(190) },
      { kind: "ok", text: "<b>spanish_park</b> completed <b>errors.json</b>", time: minutes(310) },
    ],
  }));

  return { version: 2, languages: LANGUAGES.map((l) => ({ ...l })), projects, users: USERS.map((u) => ({ ...u })) };
}

export function presetSuggestions(code: string): string[] {
  const map: Record<string, string[]> = {
    "es-ES": ["Inicio", "Descubre capas de Minecraft", "Ver todo", "Guardar actual"],
    fr: ["Accueil", "Découvrez les capes Minecraft", "Tout voir", "Enregistrer"],
    de: ["Startseite", "Entdecke Minecraft-Umhänge", "Alle anzeigen", "Speichern"],
    "pt-BR": ["Início", "Descubra capas de Minecraft", "Ver tudo", "Salvar"],
  };
  return map[code] || [];
}

export function machineTranslation(code: string, sourceText: string): string | null {
  const map: Record<string, string> = {
    "es-ES": "Descubre las capas de Minecraft y las cuentas mejor clasificadas",
    fr: "Découvrez les capes Minecraft et les comptes les mieux classés",
    de: "Entdecke Minecraft-Umhänge und die bestplatzierten Konten",
    "pt-BR": "Descubra capas do Minecraft e contas com melhor classificação",
  };
  if (map[code]) return map[code];
  return `[${code}] ${sourceText}`;
}
