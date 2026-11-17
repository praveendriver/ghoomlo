/** A festive look for a travel window, picked from words in its name. */
export type Theme = { emoji: string; tone: string };

const THEMES: [RegExp, Theme][] = [
  [/christmas|xmas/i, { emoji: "🎄", tone: "christmas" }],
  [/diwali|deepavali/i, { emoji: "🪔", tone: "diwali" }],
  [/holi\b/i, { emoji: "🎨", tone: "holi" }],
  [/dussehra|dasara|vijaya|puja|navratri|autumn/i, { emoji: "🏵️", tone: "dussehra" }],
  [/sankranti|pongal|lohri|kite/i, { emoji: "🪁", tone: "kite" }],
  [/republic|independence|gandhi/i, { emoji: "🇮🇳", tone: "tricolour" }],
  [/id-ul|eid|bakrid|muharram|milad/i, { emoji: "🌙", tone: "moon" }],
  [/good friday|easter/i, { emoji: "🕊️", tone: "spring" }],
  [/buddha|mahavir|guru nanak/i, { emoji: "🪷", tone: "lotus" }],
  [/janmashtami/i, { emoji: "🦚", tone: "peacock" }],
  [/ram navami/i, { emoji: "🏹", tone: "dussehra" }],
  [/winter/i, { emoji: "❄️", tone: "winter" }],
  [/summer/i, { emoji: "☀️", tone: "summer" }],
  [/spring/i, { emoji: "🌸", tone: "spring" }],
  [/mid-?term|term break/i, { emoji: "🎒", tone: "term" }],
];

export function themeFor(label: string, kind: string): Theme {
  if (kind === "custom") return { emoji: "✈️", tone: "custom" };
  return THEMES.find(([re]) => re.test(label))?.[1] ?? { emoji: "🧳", tone: "plain" };
}
