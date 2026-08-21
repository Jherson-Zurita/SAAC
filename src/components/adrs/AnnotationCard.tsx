import React from 'react';
import { MessageSquare, Calendar, User, Tag } from 'lucide-react';
import type { Annotation } from '../../../shared/types';

interface AnnotationCardProps {
  annotation: Annotation;
}

export const AnnotationCard: React.FC<AnnotationCardProps> = ({ annotation }) => {
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--purple)]/40 rounded-xl p-4 shadow-lg space-y-2 transition text-xs font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-[var(--cyan)] shrink-0" />
          <h4 className="font-bold text-[var(--text)]">{annotation.title}</h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--cyan)]/10 text-[var(--cyan)] border border-[var(--cyan)]/20 flex items-center space-x-1">
          <Tag className="w-2.5 h-2.5" />
          <span>{annotation.targetType}: {annotation.targetId}</span>
        </span>
      </div>

      <p className="text-[var(--text)] leading-relaxed font-normal">{annotation.content}</p>

      <div className="flex items-center space-x-3 text-[10px] text-[var(--muted-2)] font-mono pt-1">
        <span className="flex items-center space-x-1">
          <Calendar className="w-3 h-3 text-[var(--muted-2)]" />
          <span>{annotation.createdAt}</span>
        </span>
        <span>•</span>
        <span className="flex items-center space-x-1">
          <User className="w-3 h-3 text-[var(--muted-2)]" />
          <span>{annotation.author}</span>
        </span>
      </div>
    </div>
  );
};
