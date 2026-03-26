import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight } from 'lucide-react';

interface DirectionArrowsProps {
  currentDirection: string;
  onDirectionChange: (direction: string) => void;
}

export function DirectionArrows({ currentDirection, onDirectionChange }: DirectionArrowsProps) {
  const directions = [
    { 
      name: 'up-left', 
      icon: ArrowUpLeft, 
      style: { top: '-16px', left: '-16px' }
    },
    { 
      name: 'up', 
      icon: ChevronUp, 
      style: { top: '-16px', left: '50%', transform: 'translateX(-50%)' }
    },
    { 
      name: 'up-right', 
      icon: ArrowUpRight, 
      style: { top: '-16px', right: '-16px' }
    },
    { 
      name: 'left', 
      icon: ChevronLeft, 
      style: { top: '50%', left: '-16px', transform: 'translateY(-50%)' }
    },
    { 
      name: 'right', 
      icon: ChevronRight, 
      style: { top: '50%', right: '-16px', transform: 'translateY(-50%)' }
    },
    { 
      name: 'down-left', 
      icon: ArrowDownLeft, 
      style: { bottom: '-16px', left: '-16px' }
    },
    { 
      name: 'down', 
      icon: ChevronDown, 
      style: { bottom: '-16px', left: '50%', transform: 'translateX(-50%)' }
    },
    { 
      name: 'down-right', 
      icon: ArrowDownRight, 
      style: { bottom: '-16px', right: '-16px' }
    },
  ];

  return (
    <div className="relative">
      {directions.map(({ name, icon: Icon, style }) => (
        <button
          key={name}
          className={`absolute w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
            currentDirection === name
              ? 'bg-red-500 text-white border-red-600'
              : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
          }`}
          style={style}
          onClick={() => onDirectionChange(name)}
        >
          <Icon className="w-4 h-4 mx-auto" />
        </button>
      ))}
    </div>
  );
}