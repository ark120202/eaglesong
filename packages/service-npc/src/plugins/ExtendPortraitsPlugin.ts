import portraits from '@dota-data/scripts/files/portraits';
import { Hooks } from '..';

export function ExtendPortraitsPlugin(hooks: Hooks) {
  hooks.transform.tap('ExtendPortraitsPlugin', (files, group) => {
    if (group !== 'portraits') return;
    files.___base___ = portraits;
  });
}
