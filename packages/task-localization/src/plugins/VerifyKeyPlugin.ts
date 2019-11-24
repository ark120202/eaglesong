import { Plugin } from '../service';

const VALID_LOCALIZATION_KEY_REGEXP = /^[$\w]+$/;

export const VerifyKeyPlugin: Plugin = ({ hooks, error }) => {
  hooks.preprocess.tap('VerifyKeyPlugin', (file, fileName) =>
    Object.keys(file).forEach(key => {
      if (VALID_LOCALIZATION_KEY_REGEXP.test(key)) return;

      error(
        fileName,
        `String ${key} has invalid key. Key may contain only alphanumeric characters and underscores`,
      );
    }),
  );
};
