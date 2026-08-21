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
        return <Sparkles className="w-3.5 h-3.5 text-[var(--cyan)]" />;
      case 2:
        return <Box className="w-3.5 h-3.5 text-[var(--purple)]" />;
      case 3:
        return <Layers className="w-3.5 h-3.5 text-[var(--purple)]" />;
      case 4:
        return <Code2 className="w-3.5 h-3.5 text-[var(--green)]" />;
    }
  };

  return (
    <nav
      className="h-8 bg-[var(--panel)] border-b border-[var(--border)] px-3 flex items-center space-x-1.5 text-xs select-none overflow-hidden font-sans transition-colors duration-200"
      aria-label="Navegación jerárquica C4"
    >
      <div className="flex items-center space-x-1 text-[var(--muted)] font-semibold uppercase tracking-wider text-[10px] mr-2">
        <span>Navegación C4:</span>
      </div>

      {breadcrumbs.map((item, idx) => {
        const isLast = idx === breadcrumbs.length - 1;

        return (
          <React.Fragment key={idx}>
            <button
              type="button"
              onClick={() => navigateToBreadcrumb(idx)}
              aria-current={isLast ? 'page' : undefined}
              className={`flex min-w-0 items-center space-x-1 px-2 py-0.5 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]/60 ${
                isLast
                  ? 'bg-[var(--purple-soft)] text-[var(--purple)] font-semibold border border-[var(--purple-border)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)]'
              }`}
            >
              {getIconForLevel(item.level)}
              <span className="truncate whitespace-nowrap">{item.label}</span>
            </button>

            {!isLast && <ChevronRight className="w-3.5 h-3.5 text-[var(--muted-2)]" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
