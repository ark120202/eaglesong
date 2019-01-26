import luaparse from 'luaparse';
import path from 'upath';
import { Compilation } from './transpiler/compilation';

export class AppCompilation extends Compilation {
  public commonRoot?: string;

  protected transformLuaFile(filePath: string, fileContent: string) {
    try {
      luaparse.parse(fileContent);
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      this.errors.push({ fileName: filePath, message: err.message });
    }

    return super.transformLuaFile(filePath, fileContent);
  }

  protected getRelativeToRootPath(filePath: string) {
    if (this.commonRoot == null) return super.getRelativeToRootPath(filePath);

    const commonRelativePath = path.relative(this.commonRoot, filePath);
    const isCommon = !commonRelativePath.startsWith('..') && !path.isAbsolute(commonRelativePath);

    return isCommon ? `__common__/${commonRelativePath}` : super.getRelativeToRootPath(filePath);
  }
}
