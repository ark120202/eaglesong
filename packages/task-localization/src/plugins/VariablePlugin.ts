import { ServiceErrorReporter } from '@eaglesong/helper-task';
import _ from 'lodash';
import { Hooks, LocalizationPluginApi } from '../service';
import { FlatLocalizationFiles } from '../types';

const VARIABLE_REGEXP = /#{([$\w]+)}/g;

function findString(files: FlatLocalizationFiles, token: string) {
  for (const [fileName, file] of Object.entries(files)) {
    if (file[token] != null) {
      return { fileName, value: file[token] };
    }
  }
}

function localize(
  files: FlatLocalizationFiles,
  fileName: string,
  key: string,
  value: string,
  keyStack: string[],
  error: ServiceErrorReporter,
): string {
  const firstKey = _.defaultTo(keyStack[0], key);
  return value.replace(VARIABLE_REGEXP, (fullMatch: string, variable: string) => {
    const found = findString(files, variable);
    if (found == null) {
      error(fileName, `${firstKey} > can't resolve variable "${variable}"`, 'warning');
      return fullMatch;
    }

    let variableValue = found.value;
    const variableFileName = found.fileName;

    if (VARIABLE_REGEXP.test(variableValue)) {
      if (keyStack.includes(key)) {
        error(fileName, `${firstKey} > recursive variable "${variable}"`);
        return fullMatch;
      }

      keyStack.push(key);
      variableValue = localize(files, variableFileName, variable, variableValue, keyStack, error);
    }

    return variableValue;
  });
}

export function VariablePlugin(hooks: Hooks, { error }: LocalizationPluginApi) {
  hooks.postprocess.tap('VariablePlugin', files => {
    _.each(files, (file, fileName) =>
      _.each(file, (value, key) => {
        file[key] = localize(files, fileName, key, value, [], error);
      }),
    );
  });

  // Don't localize strings consisting only of variables
  hooks.push.tap('VariablePlugin', files =>
    _.each(files, file =>
      _.each(file, (v, k) => (v.replace(VARIABLE_REGEXP, '').length > 0 ? null : delete file[k])),
    ),
  );
}
