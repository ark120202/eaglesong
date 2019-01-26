import { DotaLanguage, languages } from '@dota-data/localization/files';

export { DotaLanguage };
export function isDotaLanguage(language: string): language is DotaLanguage {
  return languages.includes(language as any);
}

export interface Files<T> extends Record<string, T> {}
export type Multilingual<T> = Partial<Record<DotaLanguage, T>>;

export interface LocalizationFile extends Record<string, any> {}
export interface LocalizationFiles extends Files<LocalizationFile> {}

export interface FlatLocalizationFile extends Record<string, string> {}
export interface FlatLocalizationFiles extends Files<FlatLocalizationFile> {}
