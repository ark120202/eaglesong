export const isBasePanel = (p: any): p is PanelBase =>
  p.paneltype != null && p.prototype === undefined && p.RunScriptInPanelContext !== undefined;
export const isPanelLike = (p: any): p is Panel =>
  p.paneltype != null && p.prototype === undefined && p.FindChildrenWithClassTraverse !== undefined;
export const isPanel = (p: PanelBase): p is Panel => p.paneltype === 'Panel';
export const isLabel = (p: PanelBase): p is LabelPanel => p.paneltype === 'Label';
export const isCustomUIElement = (p: PanelBase): p is Panel => p.paneltype === 'CustomUIElement';

export const panelToString = (p: PanelBase, depth = 5) => {
  let str = `<${p.paneltype}`;
  if (isPanelLike(p) && p.id) {
    str += ` id="${p.id}"`;
  }
  if (isCustomUIElement(p)) {
    str += ` layoutfile="${p.layoutfile}"`;
  }
  if (isLabel(p)) {
    str += ` text="${p.text}"`;
  }

  if (!isPanelLike(p) || p.GetChildCount() === 0) {
    str += ' />';
  } else {
    str += '>';
    const childCount = p.GetChildCount();
    if (depth > 0) {
      for (let i = 0; i < childCount; i += 1) {
        str += '\n  ';
        str += panelToString(p.GetChild(i), depth - 1).replace(/\n/g, '\n  ');
      }
    } else {
      str += `\n  { ${childCount} children }`;
    }

    str += `\n</${p.paneltype}>`;
  }
  return str;
};

const baseLog = console.log;
console.log = (...args: any[]) =>
  baseLog(...args.map(x => (isBasePanel(x) ? panelToString(x) : x)));
