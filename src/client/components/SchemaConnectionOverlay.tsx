import React from 'react';

export interface FieldConnection {
  originalFieldId: string;
  editedFieldId: string;
  origElementId: string;
  editElementId: string;
  status?: string;
  isManual?: boolean;
}

export interface SchemaConnectionOverlayProps {
  connections: FieldConnection[];
  selectedConnectionId?: string | null;
  onSelectConnection?: (connectionId: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const SchemaConnectionOverlay: React.FC<SchemaConnectionOverlayProps> = ({
  connections,
  selectedConnectionId,
  onSelectConnection,
  containerRef,
}) => {
  const [paths, setPaths] = React.useState<
    Array<{
      id: string;
      d: string;
      origPoint: { x: number; y: number };
      editPoint: { x: number; y: number };
      isManual?: boolean;
    }>
  >([]);

  const calculatePaths = React.useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const computedPaths: Array<{
      id: string;
      d: string;
      origPoint: { x: number; y: number };
      editPoint: { x: number; y: number };
      isManual?: boolean;
    }> = [];

    for (const conn of connections) {
      const origEl = document.getElementById(conn.origElementId);
      const editEl = document.getElementById(conn.editElementId);

      if (!origEl || !editEl) continue;

      const origRect = origEl.getBoundingClientRect();
      const editRect = editEl.getBoundingClientRect();

      // Only draw if both are visible/rendered in DOM
      if (origRect.width === 0 || editRect.width === 0) continue;

      // Start at right edge of original field
      const startX = origRect.right - containerRect.left;
      const startY = origRect.top + origRect.height / 2 - containerRect.top;

      // End at left edge of edited field
      const endX = editRect.left - containerRect.left;
      const endY = editRect.top + editRect.height / 2 - containerRect.top;

      // Smooth horizontal cubic bezier curve
      const curvature = Math.max(30, (endX - startX) * 0.45);
      const cp1X = startX + curvature;
      const cp1Y = startY;
      const cp2X = endX - curvature;
      const cp2Y = endY;

      const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      computedPaths.push({
        id: `${conn.originalFieldId}::${conn.editedFieldId}`,
        d,
        origPoint: { x: startX, y: startY },
        editPoint: { x: endX, y: endY },
        isManual: conn.isManual,
      });
    }

    setPaths(computedPaths);
  }, [connections, containerRef]);

  React.useEffect(() => {
    calculatePaths();

    // Listen to resize and scroll events
    window.addEventListener('resize', calculatePaths);
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', calculatePaths, true);
    }

    const timer = setInterval(calculatePaths, 300);

    return () => {
      window.removeEventListener('resize', calculatePaths);
      if (container) {
        container.removeEventListener('scroll', calculatePaths, true);
      }
      clearInterval(timer);
    };
  }, [calculatePaths, containerRef]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10 w-full h-full overflow-visible"
      style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.5))' }}
    >
      <defs>
        {/* Glow filter for selected/clicked line */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradient for subtle standard line */}
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
        </linearGradient>

        {/* Gradient for glowing active line */}
        <linearGradient id="lineGradActive" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="1" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
        </linearGradient>
      </defs>

      {paths.map((p) => {
        const isSelected = selectedConnectionId === p.id;

        return (
          <g key={p.id} className="pointer-events-auto cursor-pointer">
            {/* Wider transparent hit area for easy clicking */}
            <path
              d={p.d}
              fill="none"
              stroke="transparent"
              strokeWidth="16"
              onClick={() => onSelectConnection?.(isSelected ? null : p.id)}
            />

            {/* Glowing prominent blur aura when selected */}
            {isSelected && (
              <>
                <path
                  d={p.d}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="8"
                  filter="url(#glow)"
                  opacity="0.9"
                />
                <path
                  d={p.d}
                  fill="none"
                  stroke="#67e8f9"
                  strokeWidth="5"
                  filter="url(#glow)"
                  opacity="1"
                />
              </>
            )}

            {/* Visible connector line */}
            <path
              d={p.d}
              fill="none"
              stroke={isSelected ? 'url(#lineGradActive)' : 'url(#lineGrad)'}
              strokeWidth={isSelected ? '3.5' : '1.2'}
              strokeDasharray={p.isManual && !isSelected ? '4 3' : undefined}
              className="transition-all duration-200"
              onClick={() => onSelectConnection?.(isSelected ? null : p.id)}
            />

            {/* End point dots */}
            <circle
              cx={p.origPoint.x}
              cy={p.origPoint.y}
              r={isSelected ? 5 : 2}
              fill={isSelected ? '#a5b4fc' : '#6366f1'}
              opacity={isSelected ? 1 : 0.6}
            />
            <circle
              cx={p.editPoint.x}
              cy={p.editPoint.y}
              r={isSelected ? 5 : 2}
              fill={isSelected ? '#6ee7b7' : '#10b981'}
              opacity={isSelected ? 1 : 0.6}
            />
          </g>
        );
      })}
    </svg>
  );
};
