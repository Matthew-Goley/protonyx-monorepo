import { RotateCcw, Play } from 'lucide-react'
import { useAnalysisCommit } from '@/contexts/AnalysisCommitContext'

/*
  The uncommitted-changes bar, rendered by PageHeader in its centered slot so it
  lands in exactly the same place on every screen (see PageHeader for the grid
  that guarantees that).

  Renders nothing when the live state matches the committed snapshot, so the
  header is unchanged in the steady state and the bar's appearance is itself the
  signal that something is waiting. Deliberately loud: accent-tinted pill, filled
  primary action, so it is hard to miss against the quiet header.
*/
export function PendingChangesBar() {
  const { changeCount, commit, revert, reverting, revertError } = useAnalysisCommit()

  if (changeCount === 0) return null

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 rounded-full border border-accent-teal/40 bg-accent-teal/10 py-1 pl-3 pr-1">
        <span className="text-[13px] font-medium text-primary">
          {changeCount} {changeCount === 1 ? 'change' : 'changes'} pending
        </span>

        <button
          type="button"
          onClick={commit}
          disabled={reverting}
          title="Re-run the Lens analysis with your changes"
          className="btn-primary flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium disabled:opacity-50"
        >
          <Play size={13} />
          Run analysis
        </button>

        <button
          type="button"
          onClick={() => void revert()}
          disabled={reverting}
          title="Discard your changes and restore the analyzed portfolio"
          className="btn-ghost flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium disabled:opacity-50"
        >
          <RotateCcw size={13} />
          {reverting ? 'Reverting...' : 'Revert'}
        </button>
      </div>

      {revertError && <span className="text-[11px] text-accent-red">{revertError}</span>}
    </div>
  )
}
