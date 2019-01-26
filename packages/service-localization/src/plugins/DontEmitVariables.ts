import { Hooks } from '..';

export async function DontEmitVariables(hooks: Hooks) {
  hooks.emit.tap('DontEmitVariables', file =>
    Object.keys(file).forEach(k => (k.startsWith('$') ? delete file[k] : null)),
  );
}
