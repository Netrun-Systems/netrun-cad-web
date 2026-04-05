/**
 * EmailShareDialog — modal for emailing deviation reports to team members.
 * Uses mailto: approach with PDF download so users can attach manually.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DeviationReport } from '../../services/blueprints';
import type { DeviationEntry } from '../../engine/deviation-renderer';
import { generateDeviationPDF } from '../../engine/deviation-report-pdf';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  deviationReport: DeviationReport | null;
  deviationEntries: DeviationEntry[];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EmailShareDialog({
  isOpen,
  onClose,
  projectName,
  deviationReport,
  deviationEntries,
}: EmailShareDialogProps) {
  const today = new Date().toLocaleDateString();

  const [emails, setEmails] = useState('');
  const [subject, setSubject] = useState(
    `Survai Deviation Report — ${projectName} — ${today}`,
  );

  const defaultBody = useMemo(() => {
    if (!deviationReport) return '';
    const total = deviationReport.total_elements;
    const passPct = (deviationReport.pass_rate * 100).toFixed(1);
    return `${total} deviations found, ${passPct}% pass rate. See attached report.`;
  }, [deviationReport]);

  const [body, setBody] = useState(defaultBody);
  const [includePdf, setIncludePdf] = useState(true);
  const [includeDxf, setIncludeDxf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [sending, setSending] = useState(false);

  // Sync body when report changes
  React.useEffect(() => {
    setBody(defaultBody);
  }, [defaultBody]);

  // Reset subject when projectName changes
  React.useEffect(() => {
    setSubject(`Survai Deviation Report — ${projectName} — ${today}`);
  }, [projectName, today]);

  const isValid = useMemo(() => {
    const trimmed = emails.trim();
    if (!trimmed) return false;
    // Basic check: at least one entry with an @
    return trimmed.split(',').some((e) => e.trim().includes('@'));
  }, [emails]);

  const handleSend = useCallback(() => {
    if (!isValid || !deviationReport) return;
    setSending(true);

    // Generate and download PDF if requested
    if (includePdf) {
      generateDeviationPDF({
        projectName,
        date: today,
        toleranceMm: deviationReport.tolerance_mm,
        deviations: deviationEntries,
        summary: {
          total: deviationReport.total_elements,
          matches: deviationReport.matches,
          position: deviationReport.position_deviations,
          typeMismatch: deviationReport.type_mismatches,
          missing: deviationReport.missing_in_scan,
          extra: deviationReport.extra_in_scan,
          passRate: deviationReport.pass_rate,
        },
      });
      setPdfDownloaded(true);
    }

    // Build mailto link
    const toAddresses = emails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .join(',');

    const mailtoUrl =
      `mailto:${encodeURIComponent(toAddresses)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.open(mailtoUrl, '_blank');
    setSending(false);
  }, [isValid, deviationReport, deviationEntries, emails, subject, body, includePdf, projectName, today]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-gray-200">
            Email Report
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* To field */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">
              To (comma-separated)
            </label>
            <input
              type="text"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Attachment checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
              <input
                type="checkbox"
                checked={includePdf}
                onChange={(e) => setIncludePdf(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              Include PDF Report
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
              <input
                type="checkbox"
                checked={includeDxf}
                onChange={(e) => setIncludeDxf(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              Include DXF File
            </label>
          </div>

          {/* PDF downloaded notice */}
          {pdfDownloaded && (
            <div className="text-xs text-cyan-400 bg-cyan-950/30 rounded px-3 py-2">
              PDF downloaded — attach to your email
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!isValid || sending}
            className={`
              px-4 py-2 rounded text-sm font-medium transition-colors
              ${!isValid || sending
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }
            `}
          >
            {sending ? 'Opening...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
