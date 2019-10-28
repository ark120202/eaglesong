import { Hooks, Plugin } from '../service';

export const DoNotEmitVariablesPlugin: Plugin = (hooks: Hooks) => {
  hooks.emit.tap('DoNotEmitVariablesPlugin', file => {
    for (const key of Object.keys(file)) {
      if (key.startsWith('$')) {
        delete file[key];
      }
    }
  });
};
