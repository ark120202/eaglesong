import * as ts from 'typescript';
import path from 'upath';
import { Compilation, CompilationHost } from './transpiler/compilation';

export class CustomCompilation extends Compilation {
  constructor(
    program: ts.Program,
    host: CompilationHost | undefined,
    private readonly commonRoot?: string,
  ) {
    super(program, host);
  }

  protected toOutputStructure(filePath: string) {
    if (this.commonRoot) {
      const commonRelativePath = path.relative(this.commonRoot, filePath);
      if (!commonRelativePath.startsWith('..') && !path.isAbsolute(commonRelativePath)) {
        return super.toOutputStructure(path.join(this.rootDir, `__common__/${commonRelativePath}`));
      }
    }

    return super.toOutputStructure(filePath);
  }
}
