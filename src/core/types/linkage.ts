/**
 * Type of linkage relationship between fields in original and edited schemas.
 */
export type LinkType =
  | 'identical'
  | 'moved'
  | 'renamed'
  | 'moved-renamed'
  | 'type-changed'
  | 'added'
  | 'deleted';

/**
 * Origin of the linkage determination.
 */
export type LinkSource = 'auto' | 'manual';

/**
 * Schema field reference endpoint within a linkage relationship.
 */
export interface LinkageEndpoint {
  namespace?: string;
  recordName: string;
  fieldName: string;
  /** Lowercase namespace.record.field identity used for comparison/export. */
  identityKey?: string;
  cleanType: string;
  id: string;
}

/**
 * Single linkage entry mapping an original field to an edited field (or representing addition/deletion).
 */
export interface LinkageEntry {
  linkType: LinkType;
  linkSource: LinkSource;
  original?: LinkageEndpoint;
  edited?: LinkageEndpoint;
}

/**
 * Payload exported when generating linkage report / migration mapping.
 */
export interface LinkageExport {
  exportedAt: string;
  schemaName: string;
  linkages: LinkageEntry[];
}
