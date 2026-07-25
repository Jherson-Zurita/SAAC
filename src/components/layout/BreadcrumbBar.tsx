import React from 'react';
import { ChevronRight, Sparkles, Box, Layers, Code2 } from 'lucide-react';
import { useDiagramStore } from '../../stores/useDiagramStore';
import { useUiStore } from '../../stores/useUiStore';

export const BreadcrumbBar: React.FC = () => {
  const { breadcrumbs, navigateToBreadcrumb } = useDiagramStore();
  const { activeMainTab } = useUiStore();

  if (activeMainTab !== 'c4') return null;

  const getIconForLevel = (level: 1 | 2 | 3 | 4) => {
    switch (level) {
      case 1:
        return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
      case 2:
        return <Box className="w-3.5 h-3.5 text-blue-400" />;
      case 3:
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      case 4:
        return <Code2 className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <nav className="h-8 bg-[#0e1017] border-b border-[#1f2433] px-3 flex items-center space-x-1.5 text-xs select-none">
      <div className="flex items-center space-x-1 text-gray-500 font-semibold uppercase tracking-wider text-[10px] mr-2">
        <span>Navegación C4:</span>
      </div>

      {breadcrumbs.map((item, idx) => {
        const isLast = idx === breadcrumbs.length - 1;

        return (
          <React.Fragment key={idx}>
            <button
              onClick={() => navigateToBreadcrumb(idx)}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded transition ${
                isLast
                  ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a1e2c]'
              }`}
            >
              {getIconForLevel(item.level)}
              <span>{item.label}</span>
            </button>

            {!isLast && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
