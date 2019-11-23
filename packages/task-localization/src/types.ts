import { NamedType } from '@eaglesong/helper-task';
import { DotaLanguage, isDotaLanguage } from 'dota-data/lib/localization';

export { DotaLanguage, isDotaLanguage };

export type Files<T> = Record<string, T> & NamedType;
export type Multilingual<T> = Partial<Record<DotaLanguage, T>> & NamedType;

export type LocalizationFile = Record<string, any> & NamedType;
export type LocalizationFiles = Files<LocalizationFile> & NamedType;

export type FlatLocalizationFile = Record<string, string> & NamedType;
export type FlatLocalizationFiles = Files<FlatLocalizationFile> & NamedType;
