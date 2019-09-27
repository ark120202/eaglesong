export interface MakeRelativePathsCache {
  relativePaths?: Map<string, Map<string, string>>;
}

export function makePathsRelative(
  context: string,
  identifier: string,
  cache?: MakeRelativePathsCache,
): string;

export function contextify(context: string, request: string): string;
