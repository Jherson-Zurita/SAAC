import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { NodePosition } from '../../../shared/types';
import { useDesignStore } from '../../stores/useDesignStore';
import {
  getNodesBounds,
  layoutFragment,
  type DesignFragment,
} from './design-flow';

const NODE_HALF_WIDTH = 112;
const NODE_HALF_HEIGHT = 56;
const FRAGMENT_GAP = 320;

/** Ubica elementos nuevos en el centro visible del lienzo (requiere ReactFlowProvider). */
export function useDesignPlacement() {
  const { screenToFlowPosition } = useReactFlow();
  const insertFragment = useDesignStore((state) => state.insertFragment);
  const focusNodes = useDesignStore((state) => state.focusNodes);

  const getViewportCenter = useCallback((): NodePosition => {
    const element = document.querySelector('.design-canvas__flow');
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    return { x: center.x - NODE_HALF_WIDTH, y: center.y - NODE_HALF_HEIGHT };
  }, [screenToFlowPosition]);

  const getNewNodePosition = useCallback((): NodePosition => {
    const center = getViewportCenter();
    const count = useDesignStore.getState().currentDesign?.nodes.length ?? 0;
    const step = count % 6;
    return { x: center.x + step * 28, y: center.y + step * 28 };
  }, [getViewportCenter]);

  const placeFragment = useCallback(
    (fragment: DesignFragment, at?: NodePosition) => {
      const design = useDesignStore.getState().currentDesign;
      if (!design) return [];

      let origin = at;
      if (!origin) {
        const bounds = getNodesBounds(design.nodes);
        origin = bounds
          ? { x: bounds.maxX + FRAGMENT_GAP, y: bounds.minY }
          : getViewportCenter();
      }

      const inserted = insertFragment(layoutFragment(fragment, origin));
      if (inserted.length > 0) {
        window.setTimeout(() => focusNodes(inserted.map((node) => node.id)), 0);
      }
      return inserted;
    },
    [focusNodes, getViewportCenter, insertFragment]
  );

  return { getViewportCenter, getNewNodePosition, placeFragment };
}
