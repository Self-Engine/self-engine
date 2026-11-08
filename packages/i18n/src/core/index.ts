export { BASE_LANGUAGE, LANGUAGES, LANGUAGE_TAGS, type Language } from "./languages.ts";
export { resolveAppLanguage } from "./resolve-app-language.ts";
export {
  activateLanguage,
  createI18n,
  loadAppCatalog,
  type CatalogLoader,
  type I18n,
  type MessageDescriptor,
  type Messages,
} from "./translation.ts";
