import React from 'react';
import { MessageSquare, Calendar, User, Tag } from 'lucide-react';
import type { Annotation } from '../../../shared/types';

interface AnnotationCardProps {
  annotation: Annotation;
}

export const AnnotationCard: React.FC<AnnotationCardProps> = ({ annotation }) => {
  return (
    <div className="bg-[#121520] border border-[#1e2333] hover:border-[#2a3147] rounded-xl p-4 shadow-lg space-y-2 transition text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
          <h4 className="font-bold text-gray-100">{annotation.title}</h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center space-x-1">
          <Tag className="w-2.5 h-2.5" />
          <span>{annotation.targetType}: {annotation.targetId}</span>
        </span>
      </div>

      <p className="text-gray-300 leading-relaxed font-normal">{annotation.content}</p>

      <div className="flex items-center space-x-3 text-[10px] text-gray-500 font-mono pt-1">
        <span className="flex items-center space-x-1">
          <Calendar className="w-3 h-3 text-gray-600" />
          <span>{annotation.createdAt}</span>
        </span>
        <span>•</span>
        <span className="flex items-center space-x-1">
          <User className="w-3 h-3 text-gray-600" />
          <span>{annotation.author}</span>
        </span>
      </div>
    </div>
  );
};
