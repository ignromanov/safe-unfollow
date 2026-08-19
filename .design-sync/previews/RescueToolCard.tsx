import { BarChart3, CalendarDays } from 'lucide-react';
import { RescueToolCard } from 'safe-unfollow';

// Real tool entries from src/lib/rescue-plan/tools.ts. Reads useTranslation
// ('results') for badge label, price, social proof and description with no
// fallback strings — see learnings if this renders raw i18n keys.
export function Recommended() {
  return (
    <div className="max-w-xs">
      <RescueToolCard
        tool={{
          id: 'publer',
          name: 'Publer',
          descKey: 'rescue.tools.publer',
          icon: CalendarDays,
          url: 'https://publer.io',
          color: 'text-indigo-500',
          category: 'scheduling',
          pricing: 'freemium',
          priceKey: 'rescue.price.freePlan',
          socialKey: 'rescue.social.usersPubler',
          badge: 'new',
        }}
        index={0}
        onToolClick={() => {}}
      />
    </div>
  );
}

export function SecondaryWithPopularBadge() {
  return (
    <div className="max-w-xs">
      <RescueToolCard
        tool={{
          id: 'predis',
          name: 'Predis.ai',
          descKey: 'rescue.tools.predis',
          icon: BarChart3,
          url: 'https://predis.ai',
          color: 'text-blue-500',
          category: 'content',
          pricing: 'freemium',
          priceKey: 'rescue.price.freePlan',
          socialKey: 'rescue.social.adsPredis',
          badge: 'popular',
        }}
        index={1}
        onToolClick={() => {}}
      />
    </div>
  );
}
