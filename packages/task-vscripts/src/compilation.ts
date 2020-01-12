import * as ts from 'typescript';
import path from 'upath';
import { Compilation, CompilationHost } from './transpiler/compilation';

export class CustomCompilation extends Compilation {
  private readonly realRootDir: string;
  private readonly commonDir: string;
  constructor(program: ts.Program, host?: CompilationHost) {
    super(program, host);
    this.realRootDir = program.getCurrentDirectory();
    this.commonDir = path.resolve(this.realRootDir, '../common');
  }

  protected toOutputStructure(filePath: string) {
    // TODO: Use project references instead?

    const rootDirRelative = path.relative(this.realRootDir, filePath);
    if (!rootDirRelative.startsWith('..') && !path.isAbsolute(rootDirRelative)) {
      return super.toOutputStructure(path.join(this.rootDir, rootDirRelative));
    }

    const commonRelative = path.relative(this.commonDir, filePath);
    if (!commonRelative.startsWith('..') && !path.isAbsolute(commonRelative)) {
      return super.toOutputStructure(path.join(this.rootDir, '__common__', commonRelative));
    }

    return super.toOutputStructure(filePath);
  }
}
