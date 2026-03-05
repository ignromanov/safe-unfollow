/**
 * Rescue Plan Module
 *
 * Monetization system for segmented affiliate banners.
 * Shows relevant tools based on user's account health and size.
 */

// Types
export type {
  LossSeverity,
  AccountSize,
  ToolCategory,
  UserSegment,
  RescueTool,
  SegmentKey,
  SeverityStyle,
  ToolBadge,
} from './types';

// Segmentation
export {
  computeSeverity,
  computeSize,
  computeSegment,
  getSegmentKey,
  SEVERITY_STYLES,
  SHOW_DELAY_BY_SEVERITY,
} from './segmentation';

// Tools
export { getToolsForSegment } from './tools';

// i18n Keys
export { getTitleKey, getSubtitleKey } from './i18n-keys';
