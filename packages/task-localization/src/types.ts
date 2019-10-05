import { DotaLanguage, languages } from '@dota-data/localization/files';
import { NamedType } from '@eaglesong/helper-task';

export { DotaLanguage };
export const isDotaLanguage = (language: string): language is DotaLanguage =>
  languages.includes(language as any);

export type Files<T> = Record<string, T> & NamedType;
export type Multilingual<T> = Partial<Record<DotaLanguage, T>> & NamedType;

export type LocalizationFile = Record<string, any> & NamedType;
export type LocalizationFiles = Files<LocalizationFile> & NamedType;

export type FlatLocalizationFile = Record<string, string> & NamedType;
export type FlatLocalizationFiles = Files<FlatLocalizationFile> & NamedType;
