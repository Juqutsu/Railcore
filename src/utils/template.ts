/** Replaces `{name}` placeholders; unknown ones stay as typed so admins spot their typo. */
export const fillTemplate = (template: string, values: ReadonlyMap<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => values.get(name) ?? match);
