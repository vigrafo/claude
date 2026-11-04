/**
 * Europäische Länder- und Gebietsauswahl (unabhängig von vorhandenen Gruppen).
 * Quelle: ISO 3166-1 (Stand der Codes laut ISO-Online-Browsing-Platform) und gängige
 * geografische Europaabgrenzung; Kosovo mit nutzerseitig üblichem Code „XK“ (kein offizieller ISO-Code).
 * Russland (RU) und Belarus (BY) sind als Standorte vollständig ausgeschlossen (Produktvorgabe).
 * Datenlücken: siehe docs/regions.md.
 */

export type CountryKind = "state" | "territory" | "transcontinental";

export interface CountryDef {
  code: string;
  nameDe: string;
  kind: CountryKind;
}

export const EXCLUDED_COUNTRY_CODES = new Set(["RU", "BY"]);

export const EUROPE: CountryDef[] = [
  { code: "AL", nameDe: "Albanien", kind: "state" },
  { code: "AD", nameDe: "Andorra", kind: "state" },
  { code: "AM", nameDe: "Armenien", kind: "transcontinental" },
  { code: "AZ", nameDe: "Aserbaidschan", kind: "transcontinental" },
  { code: "BE", nameDe: "Belgien", kind: "state" },
  { code: "BA", nameDe: "Bosnien und Herzegowina", kind: "state" },
  { code: "BG", nameDe: "Bulgarien", kind: "state" },
  { code: "DK", nameDe: "Dänemark", kind: "state" },
  { code: "DE", nameDe: "Deutschland", kind: "state" },
  { code: "EE", nameDe: "Estland", kind: "state" },
  { code: "FO", nameDe: "Färöer", kind: "territory" },
  { code: "FI", nameDe: "Finnland", kind: "state" },
  { code: "FR", nameDe: "Frankreich", kind: "state" },
  { code: "GE", nameDe: "Georgien", kind: "transcontinental" },
  { code: "GI", nameDe: "Gibraltar", kind: "territory" },
  { code: "GR", nameDe: "Griechenland", kind: "state" },
  { code: "GG", nameDe: "Guernsey", kind: "territory" },
  { code: "IE", nameDe: "Irland", kind: "state" },
  { code: "IS", nameDe: "Island", kind: "state" },
  { code: "IM", nameDe: "Isle of Man", kind: "territory" },
  { code: "IT", nameDe: "Italien", kind: "state" },
  { code: "JE", nameDe: "Jersey", kind: "territory" },
  { code: "KZ", nameDe: "Kasachstan", kind: "transcontinental" },
  { code: "XK", nameDe: "Kosovo", kind: "state" },
  { code: "HR", nameDe: "Kroatien", kind: "state" },
  { code: "LV", nameDe: "Lettland", kind: "state" },
  { code: "LI", nameDe: "Liechtenstein", kind: "state" },
  { code: "LT", nameDe: "Litauen", kind: "state" },
  { code: "LU", nameDe: "Luxemburg", kind: "state" },
  { code: "MT", nameDe: "Malta", kind: "state" },
  { code: "MD", nameDe: "Moldau", kind: "state" },
  { code: "MC", nameDe: "Monaco", kind: "state" },
  { code: "ME", nameDe: "Montenegro", kind: "state" },
  { code: "NL", nameDe: "Niederlande", kind: "state" },
  { code: "MK", nameDe: "Nordmazedonien", kind: "state" },
  { code: "NO", nameDe: "Norwegen", kind: "state" },
  { code: "AT", nameDe: "Österreich", kind: "state" },
  { code: "PL", nameDe: "Polen", kind: "state" },
  { code: "PT", nameDe: "Portugal", kind: "state" },
  { code: "RO", nameDe: "Rumänien", kind: "state" },
  { code: "SM", nameDe: "San Marino", kind: "state" },
  { code: "SE", nameDe: "Schweden", kind: "state" },
  { code: "CH", nameDe: "Schweiz", kind: "state" },
  { code: "RS", nameDe: "Serbien", kind: "state" },
  { code: "SK", nameDe: "Slowakei", kind: "state" },
  { code: "SI", nameDe: "Slowenien", kind: "state" },
  { code: "ES", nameDe: "Spanien", kind: "state" },
  { code: "SJ", nameDe: "Spitzbergen und Jan Mayen", kind: "territory" },
  { code: "CZ", nameDe: "Tschechien", kind: "state" },
  { code: "TR", nameDe: "Türkei", kind: "transcontinental" },
  { code: "UA", nameDe: "Ukraine", kind: "state" },
  { code: "HU", nameDe: "Ungarn", kind: "state" },
  { code: "VA", nameDe: "Vatikanstadt", kind: "state" },
  { code: "GB", nameDe: "Vereinigtes Königreich", kind: "state" },
  { code: "CY", nameDe: "Zypern", kind: "transcontinental" },
  { code: "AX", nameDe: "Ålandinseln", kind: "territory" },
];

export function isAllowedCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  const c = code.toUpperCase();
  return !EXCLUDED_COUNTRY_CODES.has(c) && EUROPE.some((x) => x.code === c);
}

/** Geprüfter lokaler Regionskatalog (Bundesländer/Kantone/Länder). Freieingabe bleibt zusätzlich möglich. */
export const REGIONS: Record<string, { name: string; cities: string[] }[]> = {
  DE: [
    { name: "Baden-Württemberg", cities: ["Stuttgart", "Mannheim", "Karlsruhe", "Freiburg im Breisgau", "Heidelberg", "Ulm"] },
    { name: "Bayern", cities: ["München", "Nürnberg", "Augsburg", "Regensburg", "Würzburg", "Ingolstadt"] },
    { name: "Berlin", cities: ["Berlin"] },
    { name: "Brandenburg", cities: ["Potsdam", "Cottbus", "Frankfurt (Oder)"] },
    { name: "Bremen", cities: ["Bremen", "Bremerhaven"] },
    { name: "Hamburg", cities: ["Hamburg"] },
    { name: "Hessen", cities: ["Frankfurt am Main", "Wiesbaden", "Kassel", "Darmstadt", "Offenbach am Main"] },
    { name: "Mecklenburg-Vorpommern", cities: ["Rostock", "Schwerin", "Greifswald"] },
    { name: "Niedersachsen", cities: ["Hannover", "Braunschweig", "Oldenburg", "Osnabrück", "Göttingen"] },
    { name: "Nordrhein-Westfalen", cities: ["Köln", "Düsseldorf", "Dortmund", "Essen", "Duisburg", "Bochum", "Bielefeld", "Münster", "Aachen"] },
    { name: "Rheinland-Pfalz", cities: ["Mainz", "Ludwigshafen am Rhein", "Koblenz", "Trier", "Kaiserslautern"] },
    { name: "Saarland", cities: ["Saarbrücken", "Neunkirchen", "Homburg"] },
    { name: "Sachsen", cities: ["Leipzig", "Dresden", "Chemnitz", "Zwickau"] },
    { name: "Sachsen-Anhalt", cities: ["Magdeburg", "Halle (Saale)", "Dessau-Roßlau"] },
    { name: "Schleswig-Holstein", cities: ["Kiel", "Lübeck", "Flensburg", "Neumünster"] },
    { name: "Thüringen", cities: ["Erfurt", "Jena", "Gera", "Weimar"] },
  ],
  AT: [
    { name: "Burgenland", cities: ["Eisenstadt"] },
    { name: "Kärnten", cities: ["Klagenfurt am Wörthersee", "Villach"] },
    { name: "Niederösterreich", cities: ["St. Pölten", "Wiener Neustadt"] },
    { name: "Oberösterreich", cities: ["Linz", "Wels", "Steyr"] },
    { name: "Salzburg", cities: ["Salzburg"] },
    { name: "Steiermark", cities: ["Graz", "Leoben"] },
    { name: "Tirol", cities: ["Innsbruck"] },
    { name: "Vorarlberg", cities: ["Bregenz", "Dornbirn", "Feldkirch"] },
    { name: "Wien", cities: ["Wien"] },
  ],
  CH: [
    { name: "Aargau", cities: ["Aarau", "Baden"] },
    { name: "Basel-Stadt", cities: ["Basel"] },
    { name: "Bern", cities: ["Bern", "Biel/Bienne", "Thun"] },
    { name: "Genf", cities: ["Genf"] },
    { name: "Graubünden", cities: ["Chur", "Davos"] },
    { name: "Luzern", cities: ["Luzern"] },
    { name: "St. Gallen", cities: ["St. Gallen"] },
    { name: "Tessin", cities: ["Lugano", "Bellinzona"] },
    { name: "Waadt", cities: ["Lausanne"] },
    { name: "Zürich", cities: ["Zürich", "Winterthur"] },
  ],
  NL: [
    { name: "Noord-Holland", cities: ["Amsterdam", "Haarlem"] },
    { name: "Zuid-Holland", cities: ["Rotterdam", "Den Haag", "Leiden"] },
    { name: "Utrecht", cities: ["Utrecht"] },
    { name: "Noord-Brabant", cities: ["Eindhoven", "Tilburg", "Breda"] },
  ],
};
