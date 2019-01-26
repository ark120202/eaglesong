import { ServicePluginApi } from './plugin';

export interface FunctionApi extends ServicePluginApi {
  fileName: string;
  triggerChange(): void;
}

export async function evaluateFile(
  pluginApi: ServicePluginApi,
  file: Record<string, unknown>,
  fileName: string,
) {
  const functionApi: FunctionApi = {
    ...pluginApi,
    fileName,
    triggerChange: () => pluginApi.triggerChange(fileName),
  };

  await Promise.all(
    Object.entries(file)
      .filter((x): x is [string, (...args: any) => any] => typeof x[1] === 'function')
      .map(async ([key, value]) => {
        try {
          file[key] = await value(functionApi);
          if (file[key] == null) pluginApi.error(fileName, `${key}() returned ${file[key]}`);
        } catch (err) {
          pluginApi.error(fileName, err.message);
        }
      }),
  );
}
