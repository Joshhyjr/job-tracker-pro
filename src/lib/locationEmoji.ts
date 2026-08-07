const COUNTRY_FLAG_EMOJIS: Record<string, string> = {
  australia: "🇦🇺",
  brazil: "🇧🇷",
  canada: "🇨🇦",
  croatia: "🇭🇷",
  france: "🇫🇷",
  germany: "🇩🇪",
  india: "🇮🇳",
  ireland: "🇮🇪",
  italy: "🇮🇹",
  japan: "🇯🇵",
  mexico: "🇲🇽",
  netherlands: "🇳🇱",
  nigeria: "🇳🇬",
  "south africa": "🇿🇦",
  "united kingdom": "🇬🇧",
  "united arab emirates": "🇦🇪",
  uae: "🇦🇪",
  uk: "🇬🇧",
  "united states": "🇺🇸",
  "united states of america": "🇺🇸",
  usa: "🇺🇸",
};

// Remote applications use a laptop while recognized countries use their flag.
export function getLocationEmoji(location: string) {
  const normalizedLocation = location.trim().toLocaleLowerCase();
  if (normalizedLocation === "remote") return "💻";
  return COUNTRY_FLAG_EMOJIS[normalizedLocation] ?? "🌐";
}
