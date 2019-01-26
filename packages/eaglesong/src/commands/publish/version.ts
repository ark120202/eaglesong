import chalk from 'chalk';
import semver from 'semver';

export { eq, gt, lt, neq } from 'semver';

type ReleaseType = semver.ReleaseType | 'same';
const isValidReleaseType = (t: string): t is ReleaseType => RELEASE_TYPES.includes(t);
export const RELEASE_TYPES = [
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
  'prerelease',
  'same',
];

export const isValidNumber = (version: string) => semver.valid(version) != null;
export const isValidInput = (input: string) => isValidNumber(input) || isValidReleaseType(input);

export function prettyDiff(oldVersion: string, versionInput: string) {
  const newVersion = bump(oldVersion, versionInput);

  let firstVersionChange = false;
  const oldVersionComponents = oldVersion.split('.');
  return newVersion
    .split('.')
    .map((newPart, i) => {
      const oldPart = oldVersionComponents[i];
      if (newPart !== oldPart && !firstVersionChange) {
        firstVersionChange = true;
        return `${chalk.dim.cyan(newPart)}`;
      }
      if (newPart.indexOf('-') >= 1) {
        const preVersion = newPart.split('-');
        return `${chalk.dim.cyan(`${preVersion[0]}-${preVersion[1]}`)}`;
      }
      return chalk.reset.dim(newPart);
    })
    .join(chalk.reset.dim('.'));
}

export function bump(currentVersion: string, versionInput: string) {
  if (!isValidNumber(currentVersion)) throw new Error(`Version ${currentVersion} is invalid`);
  if (!isValidInput(versionInput)) throw new Error(`Version input ${versionInput} is invalid`);

  if (!isValidReleaseType(versionInput)) return versionInput;
  return versionInput === 'same' ? currentVersion : semver.inc(currentVersion, versionInput)!;
}
