declare module "twitter-text" {
  export function extractHashtags(text: string): string[];

  export function extractMentions(text: string): string[];
  export function autoLink(text: string, options?: any): string;
  export function extractUrls(text: string): string[];

  const _default: {
    extractHashtags: typeof extractHashtags;
    extractMentions: typeof extractMentions;
    autoLink: typeof autoLink;
    extractUrls: typeof extractUrls;
  };
  export default _default;
}
