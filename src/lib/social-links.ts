export interface SocialLink {
  label: string;
  href: string | null;
  icon: string;
  description: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'X',
    href: 'https://x.com/nimiqagent',
    icon: 'https://s.magecdn.com/social/tc-x.svg',
    description: 'Updates, support, and launch posts',
  },
  {
    label: 'Discord',
    href: null,
    icon: 'https://s.magecdn.com/social/tc-discord.svg',
    description: 'Reserved for community chat and support',
  },
];
