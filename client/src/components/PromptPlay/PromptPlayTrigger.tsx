import React from 'react';
import { Button } from '@/components/ui/button';
import { usePromptPlay } from './PromptPlayProvider';

interface PromptPlayTriggerProps {
  contextRef?: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export function PromptPlayTrigger({ 
  contextRef, 
  className = "",
  size = "sm"
}: PromptPlayTriggerProps) {
  const { openDrawer, getEventsForContext } = usePromptPlay();

  const handleClick = () => {
    openDrawer(contextRef);
  };

  const hasEvents = contextRef ? getEventsForContext(contextRef).length > 0 : false;

  return (
    <Button
      size={size}
      variant="ghost"
      onClick={handleClick}
      className={`text-amber-600 hover:text-amber-700 hover:bg-amber-50 ${className}`}
      title="Inspect prompt execution"
    >
      <span className={`${hasEvents ? 'animate-pulse' : ''}`}>✨</span>
      {size !== 'sm' && <span className="ml-1">prompt@play</span>}
    </Button>
  );
}