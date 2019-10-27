import webpack from 'webpack';

interface SourcePosition {
  line: number;
  column?: number;
}

interface RealDependencyLocation {
  start: SourcePosition;
  end?: SourcePosition;
  index?: number;
}

interface SynteticDependencyLocation {
  name: string;
  index?: number;
}

type DependencyLocation = SynteticDependencyLocation | RealDependencyLocation;

declare class ModuleDependency extends webpack.compilation.Dependency {
  // TODO: Should be in Dependency
  loc?: DependencyLocation;

  request: string;
  userRequest: string;
  constructor(request: string);

  getResourceIdentifier(): string;
}

export = ModuleDependency;
