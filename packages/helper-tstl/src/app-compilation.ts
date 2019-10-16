import luaparse from 'luaparse';
import * as ts from 'typescript';
import path from 'upath';
import { Compilation, CompilationHost } from './transpiler/compilation';

export class AppCompilation extends Compilation {
  constructor(
    program: ts.Program,
    host: CompilationHost | undefined,
    private readonly commonRoot?: string,
  ) {
    super(program, host);
  }

  protected transformLuaFile(filePath: string, fileContent: string) {
    try {
      luaparse.parse(fileContent);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      this.errors.push({ fileName: filePath, message: error.message });
    }

    return super.transformLuaFile(filePath, fileContent);
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
