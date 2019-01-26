import _ from 'lodash';
import posthtml from 'posthtml';

const xmlCommentRegex = /^<!--(.*?)-->$/s;
export function banTextNodes(emitError: (message: Error) => void): posthtml.Plugin {
  return (tree: posthtml.Api) => {
    tree.match(/^\s*[^\s]/, node => {
      const content = node.trim();
      if (xmlCommentRegex.test(content)) return node;

      emitError(new Error(`Text node '${content}' is not allowed.`));

      const xmlContent = _.escape(content).replace(/\\/g, '\\\\\\\\');
      return {
        attrs: {
          style: 'color: red; font-size: 32px;',
          text: `Error: text node '${xmlContent}' is not allowed.`,
        },
        content: [],
        tag: 'Label',
      };
    });

    return tree;
  };
}
