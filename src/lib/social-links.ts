export interface SocialLink {
  label: string;
  href: string | null;
  description: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'X',
    href: 'https://x.nimiqagent',
    description: 'Updates, support, and launch posts',
  },
  {
    label: 'Instagram',
    href: null,
    description: 'Reserved for visuals and product updates',
  },
  {
    label: 'Discord',
    href: null,
    description: 'Reserved for community chat and support',
  },
];
