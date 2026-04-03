/**
 * ShareDialog — share a Survai Construction project with a client or collaborator.
 */

import React, { useState, useCallback } from 'react';
import { googleDrive } from '../../services/google-drive';

type ShareRole = 'reader' | 'commenter' | 'writer';

interface ShareDialogProps {
  fileId: string;
  projectName: string;
  onClose: () => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ fileId, projectName, onClose }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('reader');
  const [sharing, setSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShare = useCallback(async () => {
    if (!email.trim()) return;
    setSharing(true);
    setShareError(null);
    try {
      await googleDrive.shareFile(fileId, email.trim(), role);
      setShareSuccess(true);
      setEmail('');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Share failed');
    } finally {
      setSharing(false);
    }
  }, [fileId, email, role]);

  const handleCopyLink = useCallback(async () => {
    try {
      const link = await googleDrive.getShareableLink(fileId);
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      setShareError('Could not copy link');
    }
  }, [fileId]);

  const roleOptions: { value: ShareRole; label: string; desc: string }[] = [
    { value: 'reader', label: 'View only', desc: 'Can view but not edit' },
    { value: 'commenter', label: 'Can comment', desc: 'View and add comments' },
    { value: 'writer', label: 'Can edit', desc: 'Full editing access' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl p-6 w-[440px] shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-cad-text font-semibold text-lg">Share Project</h2>
            <p className="text-cad-dim text-xs mt-0.5 truncate">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-cad-dim hover:text-cad-text transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Email input */}
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-cad-dim text-xs uppercase tracking-wide">Share with (email)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setShareSuccess(false); setShareError(null); }}
            placeholder="client@example.com"
            className="bg-cad-bg border border-cad-accent rounded px-3 py-2 text-cad-text text-sm outline-none focus:border-blue-400"
          />
        </div>

        {/* Role selector */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-cad-dim text-xs uppercase tracking-wide">Permission</label>
          <div className="flex flex-col gap-1.5">
            {roleOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                  role === opt.value
                    ? 'border-blue-500 bg-blue-600/20'
                    : 'border-cad-accent hover:border-cad-text/40'
                }`}
              >
                <span className="text-cad-text text-sm font-medium">{opt.label}</span>
                <span className="text-cad-dim text-xs">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Share error / success */}
        {shareError && <p className="text-red-400 text-xs mb-3">{shareError}</p>}
        {shareSuccess && <p className="text-green-400 text-xs mb-3">Shared successfully with {email}.</p>}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-cad-dim hover:text-cad-text text-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {linkCopied ? 'Link copied!' : 'Copy shareable link'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-cad-dim hover:text-cad-text text-sm transition-colors"
            >
              Done
            </button>
            <button
              onClick={handleShare}
              disabled={!email.trim() || sharing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {sharing ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
