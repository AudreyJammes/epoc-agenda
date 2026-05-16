import {
  startOfWeek, endOfWeek, eachDayOfInterval, format,
  parseISO, isToday, setHours, setMinutes,
  differenceInMinutes, getHours, getMinutes,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Evenement } from '../types'
import { TYPE_COLORS, TYPE_LABELS } from '../lib/constants'

interface Props {
  dateRef: Date
  evenements: Evenement[]
  onJourClick: (date: Date) => void
  onEvenementClick: (ev: Evenement) => void
  onNouvelEvenement: (date: Date) => void
}

const HEURE_DEBUT   = 0
const HEURE_FIN     = 24
const HAUTEUR_HEURE = 60
const HEADER_H      = 64
const JE_SLOT_H     = 22  // px par ligne de journée entière

function topPx(date: Date): number {
  return ((getHours(date) - HEURE_DEBUT) * 60 + getMinutes(date)) / 60 * HAUTEUR_HEURE
}

function hauteurPx(debut: Date, fin: Date): number {
  return Math.max(differenceInMinutes(fin, debut) / 60 * HAUTEUR_HEURE, 20)
}

interface SlottedJE {
  ev: Evenement
  colStart: number
  colSpan: number
  slot: number
  clipLeft: boolean
  clipRight: boolean
}

function calcSlottedJE(evenements: Evenement[], semaine: Date[]): SlottedJE[] {
  const semDebutStr = format(semaine[0], 'yyyy-MM-dd')
  const semFinStr   = format(semaine[6], 'yyyy-MM-dd')

  const evs = evenements.filter(e => {
    if (!e.journee_entiere) return false
    const debut = e.date_journee ?? ''
    const fin   = e.date_fin_journee ?? debut
    return debut <= semFinStr && fin >= semDebutStr
  })

  const positioned = evs.map(ev => {
    const debut = ev.date_journee ?? ''
    const fin   = ev.date_fin_journee ?? debut
    const clampedDebut = debut < semDebutStr ? semDebutStr : debut
    const clampedFin   = fin   > semFinStr   ? semFinStr   : fin
    const colStart = semaine.findIndex(j => format(j, 'yyyy-MM-dd') === clampedDebut)
    const colEndIdx = semaine.findIndex(j => format(j, 'yyyy-MM-dd') === clampedFin)
    return {
      ev,
      colStart:  Math.max(0, colStart),
      colEnd:    colEndIdx < 0 ? semaine.length - 1 : colEndIdx,
      clipLeft:  debut < semDebutStr,
      clipRight: fin   > semFinStr,
    }
  })

  const slotOcc: Array<{ colStart: number; colEnd: number }[]> = []
  return positioned.map(p => {
    let slot = 0
    while (true) {
      if (!slotOcc[slot]) slotOcc[slot] = []
      const conflict = slotOcc[slot].some(s => !(p.colEnd < s.colStart || p.colStart > s.colEnd))
      if (!conflict) {
        slotOcc[slot].push({ colStart: p.colStart, colEnd: p.colEnd })
        return { ...p, colSpan: p.colEnd - p.colStart + 1, slot }
      }
      slot++
    }
  })
}

export default function VueSemaine({ dateRef, evenements, onJourClick, onEvenementClick, onNouvelEvenement }: Props) {
  const debutSemaine = startOfWeek(dateRef, { weekStartsOn: 1 })
  const finSemaine   = endOfWeek(dateRef,   { weekStartsOn: 1 })
  const jours        = eachDayOfInterval({ start: debutSemaine, end: finSemaine })
  const heures       = Array.from({ length: HEURE_FIN - HEURE_DEBUT }, (_, i) => HEURE_DEBUT + i)
  const totalHauteur = heures.length * HAUTEUR_HEURE

  const slottedJE = calcSlottedJE(evenements, jours)
  const nbSlots   = slottedJE.length > 0 ? Math.max(...slottedJE.map(e => e.slot)) + 1 : 0
  const jeBandH   = Math.max(JE_SLOT_H + 6, nbSlots * JE_SLOT_H + 6)

  function evsAvecHeureDuJour(jour: Date): Evenement[] {
    const jourStr = format(jour, 'yyyy-MM-dd')
    return evenements.filter(e =>
      !e.journee_entiere &&
      e.date_debut &&
      e.date_debut.startsWith(jourStr) &&
      getHours(parseISO(e.date_debut)) >= HEURE_DEBUT &&
      getHours(parseISO(e.date_debut)) < HEURE_FIN
    )
  }

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>

      {/* ── En-têtes jours (sticky) ────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex bg-white border-b border-gray-200"
        style={{ height: HEADER_H }}
      >
        <div className="w-12 flex-shrink-0" />
        {jours.map(jour => (
          <div key={jour.toISOString()} className="flex-1 text-center py-2 border-l border-gray-100">
            <div className="text-xs text-gray-500 uppercase">{format(jour, 'EEE', { locale: fr })}</div>
            <div
              onClick={() => onJourClick(jour)}
              className={`text-sm font-semibold mx-auto w-8 h-8 flex items-center justify-center rounded-full cursor-pointer hover:ring-2 hover:ring-epoc-navy/30 transition-all ${
                isToday(jour) ? 'bg-epoc-navy text-white' : 'text-gray-800'
              }`}
            >
              {format(jour, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bande journée entière — barres continues ───────────── */}
      <div
        className="sticky z-20 flex bg-white border-b border-gray-200"
        style={{ top: HEADER_H, height: jeBandH }}
      >
        <div className="w-12 flex-shrink-0 flex items-start justify-end pr-1 pt-1">
          <span className="text-xs text-gray-400">J.E.</span>
        </div>

        <div className="relative flex-1">
          {/* Borders des colonnes */}
          <div className="absolute inset-0 flex pointer-events-none">
            {jours.map(jour => (
              <div key={jour.toISOString()} className="flex-1 border-l border-gray-100" />
            ))}
          </div>

          {/* Barres événements */}
          {slottedJE.map(({ ev, colStart, colSpan, slot, clipLeft, clipRight }) => {
            const colors   = TYPE_COLORS[ev.type]
            const leftPct  = (colStart / 7) * 100
            const widthPct = (colSpan  / 7) * 100
            const gapL = clipLeft  ? 0 : 2
            const gapR = clipRight ? 0 : 2
            return (
              <button
                key={ev.id}
                onClick={() => onEvenementClick(ev)}
                className={`absolute text-xs truncate px-1.5 ${colors.bg} ${colors.text} ${
                  !clipLeft  ? `border-l-2 ${colors.border} rounded-l` : ''
                } ${!clipRight ? 'rounded-r' : ''}`}
                style={{
                  left:       `calc(${leftPct}% + ${gapL}px)`,
                  width:      `calc(${widthPct}% - ${gapL + gapR}px)`,
                  top:        3 + slot * JE_SLOT_H,
                  height:     JE_SLOT_H - 3,
                  lineHeight: `${JE_SLOT_H - 3}px`,
                }}
                title={`${TYPE_LABELS[ev.type]} — ${ev.titre}`}
              >
                {ev.titre}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Grille horaire ──────────────────────────────────────── */}
      <div className="flex" style={{ height: totalHauteur }}>
        <div className="w-12 flex-shrink-0 relative bg-white" style={{ height: totalHauteur }}>
          {heures.map(h => (
            <div
              key={h}
              className="absolute right-1 text-xs text-gray-400 -translate-y-2.5 select-none"
              style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE }}
            >
              {h}h
            </div>
          ))}
        </div>

        {jours.map(jour => {
          const evs = evsAvecHeureDuJour(jour)
          return (
            <div
              key={jour.toISOString()}
              className="flex-1 border-l border-gray-100 relative"
              style={{ height: totalHauteur }}
              onClick={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const y     = e.clientY - rect.top
                const heure = Math.floor(y / HAUTEUR_HEURE) + HEURE_DEBUT
                onNouvelEvenement(setMinutes(setHours(new Date(jour), heure), 0))
              }}
            >
              {heures.map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE }} />
              ))}
              {heures.map(h => (
                <div key={`${h}-30`} className="absolute left-0 right-0 border-t border-gray-50" style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE + HAUTEUR_HEURE / 2 }} />
              ))}
              {evs.map(ev => {
                const debut  = parseISO(ev.date_debut!)
                const fin    = ev.date_fin ? parseISO(ev.date_fin) : new Date(debut.getTime() + 60 * 60 * 1000)
                const colors = TYPE_COLORS[ev.type]
                return (
                  <button
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); onEvenementClick(ev) }}
                    className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-xs text-left overflow-hidden border-l-2 ${colors.bg} ${colors.text} ${colors.border} shadow-sm hover:shadow-md transition-shadow`}
                    style={{ top: topPx(debut), height: hauteurPx(debut, fin) }}
                    title={`${TYPE_LABELS[ev.type]} — ${ev.titre}`}
                  >
                    <span className="font-semibold block truncate">{format(debut, 'HH:mm')} {ev.titre}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
