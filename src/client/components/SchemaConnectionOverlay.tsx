import React from 'react';
export interface FieldConnection {
  originalFieldId: string;
  editedFieldId: string;
  origElementId: string;
  editElementId: string;
  status?: string;
  isManual?: boolean;
  isCrossRecord?: boolean;
  originalRecordName?: string;
  editedRecordName?: string;
  originalFieldName?: string;
  editedFieldName?: string;
  originalNamespace?: string;
  editedNamespace?: string;
  meta?: {
    ts_ms: number;
    default: number;
    type: 'cross-record move' | 'added' | 'identical' | 'modified';
  };
}
// Interface definition ends above
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
      type?: string;
      ts_ms?: number;
      default?: number;
      isCrossRecord?: boolean;
      originalRecordName?: string;
      editedRecordName?: string;
      originalFieldName?: string;
      editedFieldName?: string;
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
      type?: string;
      ts_ms?: number;
      default?: number;
      isCrossRecord?: boolean;
      originalRecordName?: string;
      editedRecordName?: string;
      originalFieldName?: string;
      editedFieldName?: string;
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

      // End at left edge of edited field (pull back slightly for arrowhead)
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
        type: conn.meta?.type,
        isCrossRecord: conn.isCrossRecord,
        originalRecordName: conn.originalRecordName,
        editedRecordName: conn.editedRecordName,
        originalFieldName: conn.originalFieldName,
        editedFieldName: conn.editedFieldName,
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
        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur1" />
          <feGaussianBlur stdDeviation="14" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Softer glow for selected state */}
        <filter id="selectedGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur1" />
          <feGaussianBlur stdDeviation="10" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ─── Arrowhead markers ─── */}

        {/* Default teal arrowhead */}
        <marker
          id="arrowTeal"
          viewBox="0 0 12 8"
          refX="11"
          refY="4"
          markerWidth="12"
          markerHeight="8"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 12 4 L 0 8 z" fill="#10b981" />
        </marker>

        {/* Selected (orange/amber) arrowhead */}
        <marker
          id="arrowSelected"
          viewBox="0 0 14 10"
          refX="13"
          refY="5"
          markerWidth="14"
          markerHeight="10"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 14 5 L 0 10 z" fill="#0a0a0a" />
        </marker>

        {/* Cross-record / manual dashed arrow (green) */}
        <marker
          id="arrowGreen"
          viewBox="0 0 12 8"
          refX="11"
          refY="4"
          markerWidth="12"
          markerHeight="8"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 12 4 L 0 8 z" fill="#34d399" />
        </marker>

        {/* Added connections arrowhead */}
        <marker
          id="arrowAdded"
          viewBox="0 0 12 8"
          refX="11"
          refY="4"
          markerWidth="12"
          markerHeight="8"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 12 4 L 0 8 z" fill="#10b981" />
        </marker>

        {/* Identical connections arrowhead */}
        <marker
          id="arrowIdentical"
          viewBox="0 0 12 8"
          refX="11"
          refY="4"
          markerWidth="12"
          markerHeight="8"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 12 4 L 0 8 z" fill="#818cf8" opacity="0.7" />
        </marker>

        {/* Modified connections arrowhead */}
        <marker
          id="arrowModified"
          viewBox="0 0 12 8"
          refX="11"
          refY="4"
          markerWidth="12"
          markerHeight="8"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 12 4 L 0 8 z" fill="#ef4444" />
        </marker>

        {/* ─── Line gradients ─── */}

        {/* Gradient for subtle standard line */}
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
        </linearGradient>

        {/* Gradient for cross‑record move connections */}
        <linearGradient id="moveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d946ef" stopOpacity="1" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="1" />
        </linearGradient>

        <linearGradient id="lineGradGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
        </linearGradient>

        {/* Selected line – solid black */}
        <linearGradient id="lineGradSelected" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#000000" stopOpacity="1" />
          <stop offset="100%" stopColor="#0a0a0a" stopOpacity="1" />
        </linearGradient>

        {/* Gradient for added connections */}
        <linearGradient id="addedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
        </linearGradient>

        {/* Gradient for identical connections */}
        <linearGradient id="identicalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.6" />
        </linearGradient>

        {/* Gradient for modified connections */}
        <linearGradient id="modifiedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
        </linearGradient>
      </defs>

      {paths.map((p) => {
        const isSelected = selectedConnectionId === p.id;

        // Determine which arrowhead marker to use
        const markerId = isSelected
          ? 'url(#arrowSelected)'
          : p.isManual
          ? 'url(#arrowGreen)'
          : p.type === 'added'
          ? 'url(#arrowAdded)'
          : p.type === 'identical'
          ? 'url(#arrowIdentical)'
          : p.type === 'modified'
          ? 'url(#arrowModified)'
          : 'url(#arrowTeal)';

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

            {/* ── Selected state: orange glow aura ── */}
            {isSelected && (
              <>
                {/* Outer wide glow */}
                <path
                  d={p.d}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="12"
                  filter="url(#selectedGlow)"
                  opacity="0.35"
                />
                {/* Inner glow */}
                <path
                  d={p.d}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="6"
                  filter="url(#selectedGlow)"
                  opacity="0.6"
                />
              </>
            )}

            {/* ── Unselected cross-record / manual subtle glow ── */}
            {(p.isCrossRecord || p.isManual) && !isSelected && (
              <path d={p.d} fill="none" stroke="url(#lineGradGlow)" strokeWidth="6" filter="url(#neonGlow)" opacity="0.25" />
            )}

            {/* ── Main visible connector line ── */}
            <path
              d={p.d}
              fill="none"
              stroke={isSelected ? 'url(#lineGradSelected)' :
                p.isManual ? 'url(#lineGradGlow)' :
                p.type === 'added' ? 'url(#addedGrad)' :
                p.type === 'identical' ? 'url(#identicalGrad)' :
                p.type === 'modified' ? 'url(#modifiedGrad)' :
                'url(#lineGrad)'}
              strokeWidth={isSelected ? '3.5' : p.isManual ? '2' : '1.6'}
              strokeDasharray={p.isManual && !isSelected ? '6 4' : undefined}
              strokeLinecap="round"
              markerEnd={markerId}
              className="transition-all duration-200"
              onClick={() => onSelectConnection?.(isSelected ? null : p.id)}
            />

            {/* ── Source dot (small circle at origin) ── */}
            <circle
              cx={p.origPoint.x}
              cy={p.origPoint.y}
              r={isSelected ? 5 : 3}
              fill={isSelected ? '#0a0a0a' : '#6366f1'}
              stroke={isSelected ? '#fbbf24' : '#4f46e5'}
              strokeWidth={isSelected ? 2 : 1}
              opacity={isSelected ? 1 : 0.7}
            />

            {/* ── Cross-record tooltip card when selected ── */}
            {p.isCrossRecord && isSelected && (
              <foreignObject
                x={(p.origPoint.x + p.editPoint.x) / 2 - 165}
                y={(p.origPoint.y + p.editPoint.y) / 2 - 70}
                width="330"
                height="140"
                style={{ overflow: 'visible' }}
              >
                <div
                  style={{
                    background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
                    border: '1.5px solid #f59e0b',
                    borderRadius: '10px',
                    padding: '0',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    boxShadow: '0 0 24px rgba(245,158,11,0.25), 0 8px 32px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: 'linear-gradient(90deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
                    borderBottom: '1px solid rgba(245,158,11,0.25)',
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 800, letterSpacing: '0.5px' }}>
                      CROSS-RECORD LINK DETECTED
                    </span>
                  </div>
                  {/* Body */}
                  <div style={{ padding: '12px 14px 14px' }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>Source: </span>
                      <span style={{ color: '#fb923c', fontSize: 12, fontWeight: 600 }}>
                        {p.originalRecordName}.{p.originalFieldName}
                      </span>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>Target: </span>
                      <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600 }}>
                        {p.editedRecordName}.{p.editedFieldName}
                      </span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 10, lineHeight: '1.5' }}>
                      Field restructured across record boundaries.
                      <br />
                      Bi-directional lineage preserved for
                      <br />
                      <span style={{ color: '#34d399' }}>✓ BigQuery ETL</span>
                      {' '}
                      <span style={{ color: '#34d399' }}>✓ Data Reconciliation</span>
                    </div>
                  </div>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
};
