import parseJson from 'json-parse-better-errors';
import { promisify } from 'util';
import webpack from 'webpack';
import ModuleDependency from 'webpack/lib/dependencies/ModuleDependency';
import { makePathsRelative } from 'webpack/lib/util/identifier';
import WebpackError from 'webpack/lib/WebpackError';
import { XmlChunk } from './HtmlWebpackXmlPlugin';

class PanoramaManifestError extends WebpackError {
  constructor(filename: string, message: string) {
    super();

    this.name = 'PanoramaManifestError';
    this.message = `Panorama manifest ${filename}\n${message}`;

    Error.captureStackTrace(this, this.constructor);
  }
}

class PanoramaEntryDependency extends ModuleDependency {
  public readonly type = 'panorama entry';
  public constructor(request: string) {
    super(request);
  }
}

export interface Entry {
  name: string;
  source: string;
  type?: boolean | string;
}

export class PanoramaEntriesPlugin {
  public constructor(private manifest: string) {}

  public apply(compiler: webpack.Compiler) {
    // FIXME:
    delete compiler.options.entry;

    // @ts-ignore
    const context: string = compiler.context;
    // @ts-ignore
    const readFile: (path: string) => Promise<Buffer> = promisify(
      compiler.inputFileSystem.readFile.bind(compiler.inputFileSystem),
    );

    compiler.hooks.compilation.tap(
      this.constructor.name,
      async (compilation, { normalModuleFactory }) => {
        // @ts-ignore
        compilation.dependencyFactories.set(PanoramaEntryDependency, normalModuleFactory);
      },
    );

    compiler.hooks.make.tapPromise(this.constructor.name, async compilation => {
      // @ts-ignore
      compilation.compilationDependencies.add(this.manifest);
      const result = await readFile(this.manifest);
      let entries: Entry[];
      try {
        entries = parseJson(result.toString('utf8'));
      } catch (err) {
        const manifestPath = makePathsRelative(compiler.options.context, this.manifest);
        compilation.errors.push(new PanoramaManifestError(manifestPath, err.message));
        return;
      }

      await Promise.all(
        entries.map(({ source, name }) => {
          const dep = new PanoramaEntryDependency(source);
          // @ts-ignore
          dep.loc = { name };
          return new Promise<void>(resolve => compilation.addEntry(context, dep, name, resolve));
        }),
      );

      compilation.hooks.reviveChunks.tap(this.constructor.name, chunks => {
        chunks.forEach(chunk => {
          const entry = entries.find(e => e.name === chunk.name);
          if (!entry || entry.type === false) return;

          (chunk as XmlChunk).__type =
            entry.type === true || entry.type == null ? 'HUD' : entry.type;
        });
      });
    });
  }
}
