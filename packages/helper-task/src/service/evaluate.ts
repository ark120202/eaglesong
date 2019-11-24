import { ServicePluginApi } from './plugin';

export interface FunctionApi extends ServicePluginApi {
  fileName: string;
}

export async function evaluateServiceScript(
  api: ServicePluginApi,
  file: Record<string, unknown>,
  fileName: string,
) {
  const functionApi: FunctionApi = { ...api, fileName };
  await Promise.all(
    Object.entries(file)
      .filter((x): x is [string, (...args: any) => any] => typeof x[1] === 'function')
      .map(async ([key, value]) => {
        try {
          file[key] = await value(functionApi);
          if (file[key] == null) api.error(fileName, `${key}() returned ${file[key]}`);
        } catch (error) {
          api.error(fileName, error.message);
        }
      }),
  );
}
