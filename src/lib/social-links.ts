import Icon, { type IconName } from '@/components/Icon';

export interface SocialLink {
  label: string;
  href: string | null;
  icon: IconName;
  description: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'X (Twitter)',
    href: 'https://x.com/nimiqagent',
    icon: 'x-twitter',
    description: 'Updates, support, and launch posts',
  },
  {
    label: 'Discord',
    href: null,
    icon: 'discord',
    description: 'Reserved for community chat and support',
  },
];
