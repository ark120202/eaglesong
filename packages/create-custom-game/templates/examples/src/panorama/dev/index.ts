function patchConsole() {
  (Object.keys(console) as (keyof typeof console)[])
    .filter(<T>(k: T | 'Console'): k is T => k !== 'Console')
    .forEach(
      method =>
        (console[method] = (...args: any[]) =>
          $.AsyncWebRequest('http://127.0.0.1:34754/console', {
            type: 'POST',
            data: { args, method },
          })),
    );
}

if (process.env.NODE_ENV === 'development') patchConsole();
