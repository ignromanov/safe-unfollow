import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HelpButtonProps {
  onClick: () => void;
}

export function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 transition-all duration-200 hover:scale-105"
      onClick={onClick}
      aria-label="Open help guide"
    >
      <HelpCircle className="h-4 w-4" />
      Help
    </Button>
  );
}
