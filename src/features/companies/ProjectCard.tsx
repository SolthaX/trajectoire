import { CalendarDays, ExternalLink } from 'lucide-react';
import { PROJECT_STATUSES } from '../../../shared/constants';
import type { Criterion, Project } from '../../../shared/types';
import { ScoreBadge, StatusBadge } from '../../components/badges';
import { ensureUrl, fmtDate, hostname } from '../../lib/format';

export function ProjectCard({ project, criteria, onOpen }: { project: Project; criteria: Criterion[]; onOpen: () => void }) {
  const rated = criteria.filter((c) => typeof project.scores?.[String(c.id)] === 'number' && (project.scores[String(c.id)] ?? 0) > 0);
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className="group flex cursor-pointer flex-col rounded-xl border border-line bg-surface p-4 shadow-xs transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-sm"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-[14px] leading-snug font-semibold text-ink">{project.name}</h3>
        <StatusBadge options={PROJECT_STATUSES} value={project.status} className="shrink-0" />
      </div>
      {(project.start_date || project.end_date) && (
        <div className="mb-2 flex items-center gap-1.5 text-[12px] text-ink-3">
          <CalendarDays className="size-3.5" />
          {project.start_date ? fmtDate(project.start_date, { year: true }) : '…'} → {project.end_date ? fmtDate(project.end_date, { year: true }) : '…'}
        </div>
      )}
      {project.summary && <p className="mb-3 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{project.summary}</p>}

      <div className="mt-auto space-y-3">
        {rated.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-surface-2/70 p-2.5">
            {rated.map((c) => {
              const s = project.scores[String(c.id)] ?? 0;
              return (
                <div key={c.id} className="grid grid-cols-[1fr_64px_14px] items-center gap-2 text-[11.5px]">
                  <span className="truncate text-ink-2">{c.name}</span>
                  <span className="relative block h-1 overflow-hidden rounded-full bg-accent-soft">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(s / 5) * 100}%` }} />
                  </span>
                  <span className="tabular text-right font-medium text-ink-2">{s}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <ScoreBadge score={project.score} />
          {project.links?.length > 0 && (
            <div className="flex min-w-0 items-center gap-2">
              {project.links.slice(0, 2).map((l, i) => (
                <a
                  key={i}
                  href={ensureUrl(l.url)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex min-w-0 items-center gap-1 text-[12px] text-ink-3 hover:text-accent-ink"
                >
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">{l.label || hostname(l.url)}</span>
                </a>
              ))}
              {project.links.length > 2 && <span className="text-[12px] text-ink-3">+{project.links.length - 2}</span>}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
