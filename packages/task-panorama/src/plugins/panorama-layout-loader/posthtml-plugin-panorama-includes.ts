import posthtml from 'posthtml';
import webpack from 'webpack';

const createNodeFilter = (tags: string[]) => (
  node: posthtml.NodeTreeElement,
): node is posthtml.Node =>
  typeof node === 'object' && (tags.length === 0 || tags.includes(node.tag as any));

const getRoot = (tree: posthtml.Api) => tree.find(createNodeFilter(['root']));

const getIncludeRoots = (tree: posthtml.Api) =>
  (getRoot(tree)?.content ?? []).filter(createNodeFilter(['scripts', 'styles']));

export const preserveIncludesBefore: posthtml.Plugin = (tree: posthtml.Api) => {
  getIncludeRoots(tree)
    .flatMap(x => x.content)
    .filter(createNodeFilter(['include']))
    .forEach(node => {
      node.tag = 'panorama-include';
    });
};

export const preserveIncludesAfter: posthtml.Plugin = (tree: posthtml.Api) => {
  getIncludeRoots(tree)
    .flatMap(x => x.content)
    .filter(createNodeFilter(['panorama-include']))
    .forEach(node => {
      node.tag = 'include';
    });
};

export const validateIncludes = (context: webpack.loader.LoaderContext): posthtml.Plugin => (
  tree: posthtml.Api,
) => {
  for (const scope of getIncludeRoots(tree)) {
    for (const node of scope.content) {
      if (typeof node !== 'object') continue;

      if (node.tag !== 'include') {
        context.emitError(new Error(`Unexpected tag '${node.tag}'`));
        continue;
      }

      const { src } = node.attrs;
      if (src === 'error://') continue;
      if (src == null) {
        context.emitError(new Error('<include> tag is missing "src" attribute'));
        continue;
      }

      if (scope.tag === 'styles') {
        if (!src.endsWith('.css') && !src.endsWith('.vcss_c')) {
          context.emitError(new Error(`Dependency '${src}' has invalid extension`));
        }
      } else if (scope.tag === 'scripts') {
        if (!src.endsWith('.js') && !src.endsWith('.vjs_c')) {
          context.emitError(new Error(`Dependency '${src}' has invalid extension`));
        }
      }
    }
  }
};

export const addCommonIncludes = (commons: string[]): posthtml.Plugin => (tree: posthtml.Api) => {
  if (commons.length === 0) return;

  const root = getRoot(tree);
  if (!root) return;

  let scriptsTag = root.content.find(createNodeFilter(['scripts']));
  if (!scriptsTag) {
    scriptsTag = {
      tag: 'scripts',
      attrs: {},
      content: ['\n'],
    };

    root.content = ['\n', scriptsTag, ...root.content];
  }

  scriptsTag.content.push(
    ...commons.flatMap(src => [{ tag: 'include', attrs: { src }, content: [] }, '\n']),
  );
};
