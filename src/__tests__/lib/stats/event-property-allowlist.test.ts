import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { AnalyticsEvents, type AnalyticsEventName } from '@/lib/stats/constants';
import { BADGE_SOURCE_FILES } from '@/lib/stats/upload-badge-counts';

/**
 * Event-property allowlist gate (T5 / v1.8 task 09).
 *
 * Every Umami event declared in `AnalyticsEvents` has an explicit set of
 * allowed property keys below. The test parses every non-test `.ts`/`.tsx`
 * file under `src/` with TypeScript's own parser, finds every call to
 * `trackEvent`, `enqueueEvent`, `trackBeacon`, or `trackNavigating`, and
 * asserts that:
 *
 * 1. Every `AnalyticsEvents` value is registered in `ALLOWED_EVENT_PROPERTIES`
 *    (no event can be added without declaring its allowed fields).
 * 2. Every property key emitted at any call site is in that event's allowlist
 *    (adding a new property without updating the allowlist fails the build).
 * 3. No event allowlist contains a globally forbidden PII or cross-session
 *    identity field (`file_hash`, `file_hash_prefix`, `username`, `email`,
 *    `phone`, `license_key`, etc.).
 */

const UPLOAD_ERROR_PROPERTIES = ['upload_id', 'error_message', 'file_size_mb', 'format'] as const;

const BADGE_COUNT_PROPERTIES = Object.keys(BADGE_SOURCE_FILES).map(
  badge => `count_${badge.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)}`
);

const HERO_CTA_PROPERTIES = ['deferred', 'from_path'] as const;

const ALLOWED_EVENT_PROPERTIES: Record<AnalyticsEventName, readonly string[]> = {
  // File Upload
  [AnalyticsEvents.FILE_UPLOAD_START]: ['file_size_mb', 'upload_id'],
  [AnalyticsEvents.FILE_UPLOAD_SUCCESS]: [
    'account_count',
    'from_cache',
    'format',
    'mixed_relationship_formats',
    'duplicate_relationship_shards',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'entry_cta',
    ...BADGE_COUNT_PROPERTIES,
    'archive_scope',
    'upload_id',
  ],
  [AnalyticsEvents.UPLOAD_PARSE_DURATION]: ['duration_bucket', 'outcome', 'upload_id'],

  // Filters
  [AnalyticsEvents.FILTER_CLEAR_ALL]: ['previous_count'],
  [AnalyticsEvents.FILTER_SESSION_SUMMARY]: [
    'filter_session_id',
    'seq',
    'filters_used',
    'max_active',
    'arrived_with',
    'arrived_from',
    'reached_empty',
    'toggle_count',
    'source_mix',
  ],
  [AnalyticsEvents.FILTER_STEP]: [
    'filter_session_id',
    'step',
    'badge',
    'action',
    'source',
    'combination',
    'total_count',
    'resolved',
    'result_count',
    'search_active',
    'predicted_count',
    'replaced',
  ],
  [AnalyticsEvents.FILTER_ANOMALY]: [
    'kind',
    'filter_session_id',
    'step',
    'combination',
    'expected',
    'actual',
    'total_count',
  ],

  // Search
  [AnalyticsEvents.SEARCH_PERFORM]: [
    'query_length',
    'result_count',
    'total_count',
    'has_filters_active',
    'unfiltered_count',
  ],

  // Results interactions
  [AnalyticsEvents.RESULTS_CLICKS_SUMMARY]: [
    'filter_session_id',
    'seq',
    'total_clicks',
    'badge_clicks',
    'time_spent',
  ],

  // Links & locale hint
  [AnalyticsEvents.LINK_CLICK]: ['link_type'],
  [AnalyticsEvents.LOCALE_HINT_VIEW]: ['target_lang', 'path'],
  [AnalyticsEvents.LOCALE_HINT_CLICK]: ['target_lang', 'path'],
  [AnalyticsEvents.LOCALE_HINT_DISMISS]: ['target_lang', 'path'],
  [AnalyticsEvents.CALENDAR_REMINDER_CLICK]: [],

  // Hero CTAs
  [AnalyticsEvents.HERO_CTA_GUIDE]: HERO_CTA_PROPERTIES,
  [AnalyticsEvents.HERO_CTA_SAMPLE]: HERO_CTA_PROPERTIES,
  [AnalyticsEvents.HERO_CTA_UPLOAD_DIRECT]: HERO_CTA_PROPERTIES,
  [AnalyticsEvents.HERO_CTA_CONTINUE]: HERO_CTA_PROPERTIES,

  // Navigation
  [AnalyticsEvents.THEME_TOGGLE]: ['mode'],
  [AnalyticsEvents.CLEAR_DATA]: [],
  [AnalyticsEvents.SAMPLE_DATA_LOAD]: ['account_count', 'load_time_ms'],
  [AnalyticsEvents.LANGUAGE_CHANGE]: ['language'],
  [AnalyticsEvents.GUIDE_OPEN]: ['source', 'step_id'],
  [AnalyticsEvents.PAGE_VIEW]: ['utm_source', 'utm_medium', 'utm_campaign'],
  [AnalyticsEvents.UPLOAD_CLICK]: [],
  [AnalyticsEvents.INTENT_CTA_CLICK]: ['intent_slug', 'deferred', 'from_path'],
  [AnalyticsEvents.LOADING_TIP_IMPRESSION]: ['tip_id', 'tip_index', 'delay_ms'],
  [AnalyticsEvents.AFFILIATE_BLOCK_CLICK]: ['offer_id'],

  // Pro Export
  [AnalyticsEvents.EXPORT_TRIGGER_VIEWABLE]: ['is_unlocked'],
  [AnalyticsEvents.EXPORT_CLICK]: ['is_unlocked'],
  [AnalyticsEvents.FREE_EXPORT_DOWNLOAD]: ['capped', 'export_format'],
  [AnalyticsEvents.PAYWALL_VIEW]: ['locale', 'row_count'],
  [AnalyticsEvents.PAYWALL_DISMISS]: ['locale', 'row_count'],
  [AnalyticsEvents.CHECKOUT_START]: ['locale', 'row_count'],
  [AnalyticsEvents.PURCHASE_SUCCESS]: [],
  [AnalyticsEvents.DOWNLOAD]: ['format', 'row_count'],
  [AnalyticsEvents.EXPORT_ERROR]: ['format'],
  [AnalyticsEvents.LICENSE_RESTORED]: [],
  [AnalyticsEvents.LICENSE_ERROR]: ['reason'],
  [AnalyticsEvents.LICENSE_REVOKED]: [],

  // Diagnostic Errors
  [AnalyticsEvents.DIAGNOSTIC_ERROR_VIEW]: ['error_code', 'source'],
  [AnalyticsEvents.DIAGNOSTIC_ERROR_RETRY]: ['error_code'],
  [AnalyticsEvents.DIAGNOSTIC_ERROR_HELP]: ['error_code'],
  [AnalyticsEvents.DIAGNOSTIC_ERROR_REPORT_ISSUE]: ['error_code'],
  [AnalyticsEvents.DIAGNOSTIC_ERROR_COPY_DETAILS]: ['error_code'],

  // Granular & Extended Upload Errors
  [AnalyticsEvents.UPLOAD_ERROR_NOT_ZIP]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_HTML_FORMAT]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_NOT_INSTAGRAM]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_INCOMPLETE]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_NO_DATA]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_MISSING_FOLLOWING]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_MISSING_FOLLOWERS]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_INVALID_FOLLOWING_FORMAT]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_INVALID_FOLLOWERS_FORMAT]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_UNKNOWN]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_CORRUPTED_ZIP]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_TOO_MANY_ENTRIES]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_ZIP_ENCRYPTED]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_EMPTY_FILE]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_FILE_TOO_LARGE]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_JSON_PARSE]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_INVALID_STRUCTURE]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_TIMEOUT]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_WORKER_INIT]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_WORKER_CRASHED]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_INDEXEDDB]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_QUOTA]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_IDB_NOT_SUPPORTED]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_IDB_PERMISSION]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_CANCELLED]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_CRYPTO]: UPLOAD_ERROR_PROPERTIES,
  [AnalyticsEvents.UPLOAD_ERROR_NETWORK]: UPLOAD_ERROR_PROPERTIES,

  // Session & Engagement
  [AnalyticsEvents.TIME_ON_RESULTS]: [
    'time_seconds',
    'account_count',
    'actions_count',
    'below_floor',
    'filter_session_id',
  ],
  [AnalyticsEvents.RETURN_UPLOAD]: ['days_since_last'],

  // FAQ
  [AnalyticsEvents.FAQ_EXPAND]: ['question_id'],

  // Rescue Plan
  [AnalyticsEvents.RESCUE_PLAN_IMPRESSION]: [
    'severity',
    'size',
    'segment',
    'account_count',
    'unfollowed_percent',
  ],
  [AnalyticsEvents.RESCUE_PLAN_TOOL_CLICK]: [
    'tool_id',
    'position',
    'severity',
    'size',
    'segment',
    'account_count',
  ],
  [AnalyticsEvents.RESCUE_PLAN_DISMISS]: ['severity', 'size', 'segment', 'account_count'],

  // Feedback prompt
  [AnalyticsEvents.FEEDBACK_PROMPT_VIEWABLE]: [],
  [AnalyticsEvents.FEEDBACK_PROMPT_CLICK]: [],

  // Error tracking
  [AnalyticsEvents.ERROR_BOUNDARY]: ['error_message', 'component_stack'],
  [AnalyticsEvents.ROUTE_ERROR]: ['status', 'message'],

  // PWA
  [AnalyticsEvents.PWA_INSTALL_PROMPT]: [],
  [AnalyticsEvents.PWA_INSTALLED]: [],

  // Ads
  [AnalyticsEvents.AD_SLOT_VIEWABLE]: ['slot'],

  // Parser diagnostics
  [AnalyticsEvents.OPTIONAL_FILE_FORMAT_DRIFT]: ['file_code', 'format', 'upload_id'],
  [AnalyticsEvents.USERNAME_LABEL_RESOLUTION]: ['mode', 'upload_id'],
  [AnalyticsEvents.RELATIONSHIP_FILE_TRUNCATED]: ['file', 'upload_id'],
  [AnalyticsEvents.RELATIONSHIP_SKEW_VERDICT]: ['verdict', 'format', 'dates_fitted', 'upload_id'],
};

const FORBIDDEN_PROPERTIES = new Set([
  'file_hash',
  'file_hash_prefix',
  'username',
  'email',
  'phone',
  'customer_name',
  'license_key',
  'ip',
  'href',
]);

const EMITTER_FNS = new Set(['trackEvent', 'enqueueEvent', 'trackBeacon', 'trackNavigating']);
const TRANSPORT_IMPL_FILES = new Set(['src/lib/stats/core.ts', 'src/lib/stats/queue.ts']);

const ROOT = resolve(__dirname, '../../../..');

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

function resolveEventNames(expr: ts.Expression, fileRel: string): AnalyticsEventName[] {
  if (
    ts.isPropertyAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 'AnalyticsEvents'
  ) {
    const key = expr.name.text as keyof typeof AnalyticsEvents;
    const value = AnalyticsEvents[key];
    if (!value) {
      throw new Error(`Unknown AnalyticsEvents.${key} in ${fileRel}`);
    }
    return [value];
  }

  if (ts.isElementAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    if (expr.expression.text === 'HERO_CTAS' && fileRel === 'src/lib/stats/cta-capture.ts') {
      return [
        AnalyticsEvents.HERO_CTA_GUIDE,
        AnalyticsEvents.HERO_CTA_SAMPLE,
        AnalyticsEvents.HERO_CTA_UPLOAD_DIRECT,
        AnalyticsEvents.HERO_CTA_CONTINUE,
      ];
    }
    if (expr.expression.text === 'eventMap' && fileRel === 'src/lib/stats/events.ts') {
      return Object.values(AnalyticsEvents).filter(name => name.startsWith('upload_error_'));
    }
  }

  throw new Error(`Unrecognised event-name expression "${expr.getText()}" in ${fileRel}`);
}

function extractKeysFromPayloadExpr(expr: ts.Expression, fileRel: string): string[] {
  if (ts.isParenthesizedExpression(expr)) {
    return extractKeysFromPayloadExpr(expr.expression, fileRel);
  }

  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return extractKeysFromPayloadExpr(expr.right, fileRel);
  }

  if (ts.isConditionalExpression(expr)) {
    return [
      ...extractKeysFromPayloadExpr(expr.whenTrue, fileRel),
      ...extractKeysFromPayloadExpr(expr.whenFalse, fileRel),
    ];
  }

  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    if (expr.expression.text === 'uploadIdField') {
      return ['upload_id'];
    }
  }

  if (ts.isIdentifier(expr)) {
    if (expr.text === 'badgeCounts' && fileRel === 'src/lib/stats/events.ts') {
      return BADGE_COUNT_PROPERTIES;
    }
    if (expr.text === 'data' && fileRel === 'src/lib/stats/cta-capture.ts') {
      return [...HERO_CTA_PROPERTIES];
    }
  }

  if (ts.isObjectLiteralExpression(expr)) {
    const keys: string[] = [];
    for (const prop of expr.properties) {
      if (ts.isPropertyAssignment(prop)) {
        if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) {
          keys.push(prop.name.text);
        } else {
          throw new Error(`Unsupported computed property "${prop.name.getText()}" in ${fileRel}`);
        }
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        keys.push(prop.name.text);
      } else if (ts.isSpreadAssignment(prop)) {
        keys.push(...extractKeysFromPayloadExpr(prop.expression, fileRel));
      }
    }
    return keys;
  }

  throw new Error(`Unrecognised payload expression "${expr.getText()}" in ${fileRel}`);
}

interface EmittedCall {
  file: string;
  events: AnalyticsEventName[];
  keys: string[];
}

function scanAllEmitterCalls(): { files: Set<string>; calls: EmittedCall[] } {
  const files = new Set<string>();
  const calls: EmittedCall[] = [];

  for (const absPath of collectSourceFiles(join(ROOT, 'src'))) {
    const relPath = relative(ROOT, absPath).replace(/\\/g, '/');
    if (TRANSPORT_IMPL_FILES.has(relPath)) continue;

    const text = readFileSync(absPath, 'utf8');
    if (!/(trackEvent|enqueueEvent|trackBeacon|trackNavigating)\(/.test(text)) continue;

    const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        EMITTER_FNS.has(node.expression.text)
      ) {
        files.add(relPath);
        const [eventArg, payloadArg] = node.arguments;
        if (!eventArg) {
          throw new Error(`Emitter call with no event name in ${relPath}`);
        }
        const events = resolveEventNames(eventArg, relPath);
        const keys = payloadArg ? extractKeysFromPayloadExpr(payloadArg, relPath) : [];
        calls.push({ file: relPath, events, keys });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  return { files, calls };
}

describe('Umami event property allowlist (T5 / v1.8 task 09)', () => {
  const { files, calls } = scanAllEmitterCalls();

  it('control probe: AST walker finds every emitter file and call site', () => {
    expect(calls.length).toBeGreaterThan(30);
    expect([...files].sort()).toEqual([
      'src/hooks/useTimeOnResults.ts',
      'src/lib/stats/cta-capture.ts',
      'src/lib/stats/events.ts',
      'src/lib/stats/filter-step-events.ts',
      'src/lib/stats/locale-hint-events.ts',
      'src/lib/stats/results-click-events.ts',
    ]);
  });

  it('registers every AnalyticsEvents value in ALLOWED_EVENT_PROPERTIES with no extras', () => {
    const declared = Object.values(AnalyticsEvents).sort();
    const allowlisted = Object.keys(ALLOWED_EVENT_PROPERTIES).sort();
    expect(allowlisted).toEqual(declared);
  });

  it('contains no forbidden PII or cross-session identity properties in any allowlist', () => {
    const violations: string[] = [];
    for (const [eventName, props] of Object.entries(ALLOWED_EVENT_PROPERTIES)) {
      for (const prop of props) {
        if (FORBIDDEN_PROPERTIES.has(prop)) {
          violations.push(`${eventName}.${prop}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('every property emitted anywhere in src/ is in its event allowlist', () => {
    const violations: string[] = [];
    for (const call of calls) {
      for (const eventName of call.events) {
        const allowed = new Set(ALLOWED_EVENT_PROPERTIES[eventName]);
        for (const key of call.keys) {
          if (!allowed.has(key)) {
            violations.push(`${call.file}: ${eventName}.${key}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
