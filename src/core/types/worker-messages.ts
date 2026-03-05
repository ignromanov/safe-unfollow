import type { AccountBadges } from './badges';

// V3 App state for hash routing
export enum AppState {
  HERO = 'HERO',
  WIZARD = 'WIZARD',
  UPLOAD = 'UPLOAD',
  RESULTS = 'RESULTS',
  SAMPLE = 'SAMPLE',
  PRIVACY = 'PRIVACY',
  TERMS = 'TERMS',
}

// Wizard step data
export interface WizardStep {
  id: number;
  title: string;
  description: string;
  visual?: string;
  externalLink?: string;
  isWarning?: boolean;
}

export interface FilterCache {
  key: string;
  result: AccountBadges[];
  timestamp: number;
}

export interface FilterMessage {
  type: 'filter';
  accounts: AccountBadges[];
  searchQuery: string;
  activeFilters: string[];
}

export interface FilterResult {
  type: 'result';
  filteredAccounts: AccountBadges[];
  processingTime: number;
}

// Optimized worker messages (Proposals 1, 2, 3)
export interface InitMessage {
  type: 'init';
  accounts: AccountBadges[];
}

export interface InitCompleteMessage {
  type: 'init-complete';
  accountCount: number;
  badgeCount: number;
  prefixCount: number;
  trigramCount: number;
  initTime: number;
}

export interface OptimizedFilterMessage {
  type: 'filter';
  searchQuery: string;
  activeFilters: string[];
}

export interface ResetMessage {
  type: 'reset';
}

export interface ResetCompleteMessage {
  type: 'reset-complete';
}

export interface StatsMessage {
  type: 'stats';
}

export interface StatsResultMessage {
  type: 'stats-result';
  initialized: boolean;
  accountCount: number;
  badgeCount: number;
  prefixCount: number;
  trigramCount: number;
  initTimestamp: number;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
}

export type WorkerMessage = InitMessage | OptimizedFilterMessage | ResetMessage | StatsMessage;

export type WorkerResponse =
  | { type: 'ready' }
  | InitCompleteMessage
  | FilterResult
  | ResetCompleteMessage
  | StatsResultMessage
  | ErrorMessage;
