/**
 * NewProjectDialog — creates a new Survai Construction project.
 * Collects project name, client name, and address.
 */

import React, { useState, useRef, useEffect } from 'react';

export type ProjectTemplate = 'blank' | 'residential' | 'commercial';

export interface NewProjectOptions {
  name: string;
  client: string;
  address: string;
  template: ProjectTemplate;
}

interface NewProjectDialogProps {
  onConfirm: (opts: NewProjectOptions) => void;
  onCancel: () => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ onConfirm, onCancel }) => {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [address, setAddress] = useState('');
  const [template, setTemplate] = useState<ProjectTemplate>('blank');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm({ name: name.trim(), client: client.trim(), address: address.trim(), template });
  };

  const templates: { value: ProjectTemplate; label: string; desc: string }[] = [
    { value: 'blank', label: 'Blank', desc: 'Start with empty layers' },
    { value: 'residential', label: 'Residential', desc: 'House, garden, irrigation layers' },
    { value: 'commercial', label: 'Commercial', desc: 'Site plan, parking, planting layers' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl p-6 w-[440px] shadow-2xl">
        <h2 className="text-cad-text font-semibold text-lg mb-5">New Project</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Project name */}
          <div className="flex flex-col gap-1">
            <label className="text-cad-dim text-xs uppercase tracking-wide">Project Name *</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Smith Backyard Redesign"
              className="bg-cad-bg border border-cad-accent rounded px-3 py-2 text-cad-text text-sm outline-none focus:border-blue-400"
              required
            />
          </div>

          {/* Client name */}
          <div className="flex flex-col gap-1">
            <label className="text-cad-dim text-xs uppercase tracking-wide">Client Name</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g. Smith Family"
              className="bg-cad-bg border border-cad-accent rounded px-3 py-2 text-cad-text text-sm outline-none focus:border-blue-400"
            />
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1">
            <label className="text-cad-dim text-xs uppercase tracking-wide">Site Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Oak Ave, Ojai, CA 93023"
              className="bg-cad-bg border border-cad-accent rounded px-3 py-2 text-cad-text text-sm outline-none focus:border-blue-400"
            />
            <p className="text-cad-dim text-xs">Used to pre-load the satellite basemap</p>
          </div>

          {/* Template */}
          <div className="flex flex-col gap-2">
            <label className="text-cad-dim text-xs uppercase tracking-wide">Template</label>
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTemplate(t.value)}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-center transition-colors ${
                    template === t.value
                      ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                      : 'border-cad-accent text-cad-dim hover:border-cad-text/40'
                  }`}
                >
                  <span className="text-sm font-medium text-cad-text">{t.label}</span>
                  <span className="text-xs">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-cad-dim hover:text-cad-text text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
