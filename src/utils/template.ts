/** Replaces `{name}` placeholders; unknown ones stay as typed so admins spot their typo. */
export const fillTemplate = (template: string, values: ReadonlyMap<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => values.get(name) ?? match);

/** A filled template as a Discord channel name: one line, at most 100 characters, maybe empty. */
export const fillChannelName = (template: string, values: ReadonlyMap<string, string>) =>
  fillTemplate(template, values).replace(/\s+/g, ' ').trim().slice(0, 100).toWellFormed();
