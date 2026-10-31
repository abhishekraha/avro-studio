import React from 'react';

/**
 * Simple overlay that shows connection metadata when a line is selected.
 * Props:
 *  - meta: object containing type, ts_ms, default (optional fields)
 *  - point: screen coordinates (x, y) where the tooltip should be anchored.
 */
interface ConnectionMetaOverlayProps {
  meta: {
    type?: string;
    ts_ms?: number;
    default?: number;
  };
  point: { x: number; y: number };
}

export const ConnectionMetaOverlay: React.FC<ConnectionMetaOverlayProps> = ({ meta, point }) => {
  // Position the tooltip slightly offset from the point to avoid covering the line.
  const style: React.CSSProperties = {
    position: 'absolute',
    left: point.x + 8,
    top: point.y - 24,
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    pointerEvents: 'none',
    zIndex: 20,
  };

  return (
    <div style={style}>
      {meta.type && <div>Type: {meta.type}</div>}
      {meta.ts_ms !== undefined && <div>TS: {meta.ts_ms}</div>}
      {meta.default !== undefined && <div>Default: {meta.default}</div>}
    </div>
  );
};
