import chalk from 'chalk';
import terminalLink from 'terminal-link';
import uniqueString from 'unique-string';

// https://steamcommunity.com/comment/Announcement/formattinghelp
const noparseRegEx = /\[noparse\](.*?)\[\/noparse\]/g;
const textPatterns: { regex: RegExp; replacer(...matches: string[]): string }[] = [
  { regex: /\[h1\](.*?)\[\/h1\]/g, replacer: chalk.cyan },
  { regex: /\[b\](.*?)\[\/b\]/g, replacer: chalk.bold },
  { regex: /\[u\](.*?)\[\/u\]/g, replacer: chalk.underline },
  { regex: /\[i\](.*?)\[\/i\]/g, replacer: chalk.italic },
  { regex: /\[strike\](.*?)\[\/strike\]/g, replacer: chalk.strikethrough },
  { regex: /\[spoiler\](.*?)\[\/spoiler\]/g, replacer: chalk.bgWhite },
  { regex: /\[url(?:=(.*?))?\](.*?)\[\/url\]/g, replacer: (url, x) => terminalLink(x, url) },
];

export function colorizeSteamFormatting(text: string) {
  const skipped: { content: string; placeholder: string }[] = [];
  text = text.replace(noparseRegEx, (_fullMatch, content: string) => {
    const placeholder = `colorizeSteamFormatting_${uniqueString()}`;
    skipped.push({ content, placeholder });
    return placeholder;
  });

  textPatterns.forEach(
    ({ regex, replacer }) =>
      (text = text.replace(regex, (_fullMatch, ...args) => replacer(...args.slice(0, -2)))),
  );

  skipped.forEach(({ content, placeholder }) => (text = text.replace(placeholder, content)));

  return text;
}
