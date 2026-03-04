import { AlertCircle, CheckCircle2, FileWarning, Info, XCircle } from 'lucide-react';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { FileDiscovery, ParseWarning } from '@/core/types';
import { useAppStore } from '@/lib/store';

interface ParseResultDisplayProps {
  className?: string;
}

const severityConfig = {
  error: {
    icon: XCircle,
    className: 'border-destructive/50 bg-destructive/5 text-destructive',
    titleClass: 'text-destructive',
  },
  warning: {
    icon: AlertCircle,
    className: 'border-yellow-500/50 bg-yellow-500/5',
    titleClass: 'text-yellow-700 dark:text-yellow-400',
  },
  info: {
    icon: Info,
    className: 'border-blue-500/50 bg-blue-500/5',
    titleClass: 'text-blue-700 dark:text-blue-400',
  },
};

function WarningAlert({ warning }: { warning: ParseWarning }) {
  const config = severityConfig[warning.severity];
  const Icon = config.icon;

  return (
    <Alert className={config.className}>
      <Icon className="h-4 w-4" />
      <AlertTitle className={config.titleClass}>{warning.message}</AlertTitle>
      {warning.fix && (
        <AlertDescription className="text-muted-foreground mt-1">{warning.fix}</AlertDescription>
      )}
    </Alert>
  );
}

function FileDiscoveryTable({ discovery }: { discovery: FileDiscovery }) {
  const requiredFiles = discovery.files.filter(f => f.required);
  const optionalFiles = discovery.files.filter(f => !f.required);

  return (
    <div className="space-y-4">
      {/* Required Files */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">Required Files</h4>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-start px-3 py-2 font-medium">File</th>
                <th className="text-start px-3 py-2 font-medium">Description</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requiredFiles.map(file => (
                <tr key={file.name} className={file.found ? '' : 'bg-destructive/5'}>
                  <td className="px-3 py-2 font-mono text-xs">{file.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{file.description}</td>
                  <td className="px-3 py-2 text-center">
                    {file.found ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 inline" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive inline" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {file.found ? (file.itemCount?.toLocaleString() ?? '—') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optional Files */}
      {optionalFiles.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Optional Files</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start px-3 py-2 font-medium">File</th>
                  <th className="text-start px-3 py-2 font-medium">Description</th>
                  <th className="text-center px-3 py-2 font-medium">Status</th>
                  <th className="text-right px-3 py-2 font-medium">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {optionalFiles.map(file => (
                  <tr key={file.name}>
                    <td className="px-3 py-2 font-mono text-xs">{file.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{file.description}</td>
                    <td className="px-3 py-2 text-center">
                      {file.found ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 inline" />
                      ) : (
                        <span className="text-muted-foreground text-xs">Not found</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {file.found ? (file.itemCount?.toLocaleString() ?? '—') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Base Path Info */}
      {discovery.basePath && (
        <p className="text-xs text-muted-foreground">
          Files found in: <code className="bg-muted px-1 rounded">{discovery.basePath}</code>
        </p>
      )}
    </div>
  );
}

export function ParseResultDisplay({ className }: ParseResultDisplayProps) {
  const parseWarnings = useAppStore(s => s.parseWarnings);
  const fileDiscovery = useAppStore(s => s.fileDiscovery);
  const uploadStatus = useAppStore(s => s.uploadStatus);

  // Filter out info-level warnings for success state (only show errors and warnings)
  const visibleWarnings = useMemo(() => {
    if (uploadStatus === 'success') {
      return parseWarnings.filter(w => w.severity !== 'info');
    }
    return parseWarnings;
  }, [parseWarnings, uploadStatus]);

  // Don't show anything if no warnings and no discovery
  if (visibleWarnings.length === 0 && !fileDiscovery) {
    return null;
  }

  // For error state, show all warnings prominently
  if (uploadStatus === 'error') {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        {/* Error Warnings */}
        {visibleWarnings.map((warning, index) => (
          <WarningAlert key={`${warning.code}-${index}`} warning={warning} />
        ))}

        {/* File Discovery Table */}
        {fileDiscovery && (
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <FileWarning className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium text-foreground">Expected Files</h3>
            </div>
            <FileDiscoveryTable discovery={fileDiscovery} />
          </div>
        )}
      </div>
    );
  }

  // For success state with warnings, show a collapsible summary
  if (uploadStatus === 'success' && visibleWarnings.length > 0) {
    return (
      <div className={`space-y-3 ${className ?? ''}`}>
        {visibleWarnings.map((warning, index) => (
          <WarningAlert key={`${warning.code}-${index}`} warning={warning} />
        ))}
      </div>
    );
  }

  return null;
}
