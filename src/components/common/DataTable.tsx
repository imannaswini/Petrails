import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Assessment } from '../../types';
import { RiskBadge } from './RiskBadge';
import { ArrowUpDown, AlertCircle, Clock, MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';
import {
  formatExactLocalDateTime,
  formatRelativeOrLocalTimestamp,
  useRelativeTimeTick
} from '../../utils/dateTime';

interface DataTableProps {
  assessments: Assessment[];
  onEditAssessment?: (assessment: Assessment) => void;
  onDeleteAssessment?: (assessment: Assessment) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  assessments,
  onEditAssessment,
  onDeleteAssessment
}) => {
  const navigate = useNavigate();
  const nowMs = useRelativeTimeTick(30000);
  const [sortField, setSortField] = useState<keyof Assessment>('updatedAt');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [openMenuId]);

  const handleSort = (field: keyof Assessment) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedData = [...assessments].sort((a, b) => {
    if (sortField === 'updatedAt') {
      const timeA = Date.parse(a.updatedAt || a.createdAt || a.lastUpdated || '') || 0;
      const timeB = Date.parse(b.updatedAt || b.createdAt || b.lastUpdated || '') || 0;
      return sortAsc ? timeA - timeB : timeB - timeA;
    }

    const valA = a[sortField];
    const valB = b[sortField];

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });

  return (
    <div className="rounded-xl bg-surface border border-surface-border overflow-hidden shadow-subtle">
      {/* Table container with responsive horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-elevated/70 border-b border-surface-border text-petText-muted font-mono uppercase tracking-wider text-[11px]">
              <th
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('petName')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Pet &amp; Breed</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="py-3.5 px-4">Policy #</th>
              <th
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('riskLevel')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Risk Level</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors text-right"
                onClick={() => handleSort('combinedScore')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Combined</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="py-3.5 px-4 text-right">Rule Score</th>
              <th className="py-3.5 px-4 text-right">ML Score</th>
              <th className="py-3.5 px-4">Info Gaps</th>
              <th className="py-3.5 px-4">Status</th>
              <th
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('updatedAt')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Last Updated</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="py-3.5 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {sortedData.map(asm => (
              <tr
                key={asm.id}
                onClick={() => navigate(`/assessments/${asm.id}`)}
                className="hover:bg-surface-elevated/80 transition-colors cursor-pointer group"
              >
                {/* Pet Name & Breed */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={asm.imageUrl}
                      alt={asm.petName}
                      className="w-9 h-9 rounded-md object-cover bg-surface-higher shrink-0"
                      loading="lazy"
                    />
                    <div>
                      <span className="font-bold text-white group-hover:text-brand-ivory transition-colors">
                        {asm.petName}
                      </span>
                      <span className="block text-[11px] text-petText-muted line-clamp-1">
                        {asm.breed} · {asm.ageText}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Policy */}
                <td className="py-3.5 px-4 font-mono text-petText-secondary">{asm.policyId}</td>

                {/* Risk Badge */}
                <td className="py-3.5 px-4">
                  <RiskBadge level={asm.riskLevel} size="sm" />
                </td>

                {/* Combined Score */}
                <td className="py-3.5 px-4 font-mono font-bold text-white text-right text-sm">
                  {asm.combinedScore}
                </td>

                {/* Rule Score */}
                <td className="py-3.5 px-4 font-mono text-petText-secondary text-right">
                  {asm.ruleScore}
                </td>

                {/* ML Score */}
                <td className="py-3.5 px-4 font-mono text-brand-teal text-right font-medium">
                  {asm.mlScore}
                </td>

                {/* Information Gaps */}
                <td className="py-3.5 px-4">
                  {asm.informationGapsCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                      <AlertCircle size={11} />
                      <span>{asm.informationGapsCount} Gap{asm.informationGapsCount > 1 ? 's' : ''}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-emerald-400">Verified</span>
                  )}
                </td>

                {/* Status */}
                <td className="py-3.5 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                      asm.status === 'Approved'
                        ? 'bg-emerald-950/60 text-emerald-300'
                        : asm.status === 'Under Review'
                        ? 'bg-amber-950/60 text-amber-300'
                        : asm.status === 'Information Requested'
                        ? 'bg-sky-950/60 text-sky-300'
                        : 'bg-rose-950/60 text-rose-300'
                    }`}
                  >
                    {asm.status}
                  </span>
                </td>

                {/* Last Updated */}
                <td className="py-3.5 px-4 text-petText-muted font-mono text-[11px]">
                  <span
                    className="flex items-center gap-1"
                    title={formatExactLocalDateTime(asm.updatedAt || asm.createdAt || asm.lastUpdated)}
                  >
                    <Clock size={11} />
                    {formatRelativeOrLocalTimestamp(asm.updatedAt || asm.createdAt || asm.lastUpdated, nowMs)}
                  </span>
                </td>

                {/* Actions Menu */}
                <td
                  className="py-3.5 px-4 text-center relative"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === asm.id ? null : asm.id);
                    }}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-petText-secondary hover:text-white transition-colors"
                    aria-label={`Actions for ${asm.petName}`}
                  >
                    <MoreVertical size={14} />
                  </button>

                  {openMenuId === asm.id && (
                    <div
                      onClick={e => e.stopPropagation()}
                      className="absolute right-4 top-12 z-30 w-44 rounded-xl bg-surface-elevated border border-surface-borderLight shadow-cinematic py-1.5 text-left"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          navigate(`/assessments/${asm.id}`);
                        }}
                        className="w-full px-3.5 py-2 text-xs text-petText-primary hover:bg-surface-higher hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <Eye size={13} className="text-brand-teal" />
                        <span>View Assessment</span>
                      </button>

                      {onEditAssessment && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onEditAssessment(asm);
                          }}
                          className="w-full px-3.5 py-2 text-xs text-petText-primary hover:bg-surface-higher hover:text-white flex items-center gap-2 transition-colors"
                        >
                          <Pencil size={13} className="text-amber-400" />
                          <span>Edit Assessment</span>
                        </button>
                      )}

                      {onDeleteAssessment && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onDeleteAssessment(asm);
                          }}
                          className="w-full px-3.5 py-2 text-xs text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 flex items-center gap-2 transition-colors border-t border-surface-border/60 mt-1 pt-2"
                        >
                          <Trash2 size={13} className="text-rose-400" />
                          <span>Delete Assessment</span>
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
