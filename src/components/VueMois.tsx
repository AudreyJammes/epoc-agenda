import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday,
  parseISO,
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

const JE_NUM_H  = 26  // px — hauteur réservée au numéro du jour
const JE_SLOT_H = 20  // px par ligne d'événement journée entière
const MAX_TIMED = 2   // événements horaires max par cellule avant overflow

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
    const colStart  = semaine.findIndex(j => format(j, 'yyyy-MM-dd') === clampedDebut)
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

export default function VueMois({ dateRef, evenements, onJourClick, onEvenementClick, onNouvelEvenement }: Props) {
  const debutMois   = startOfMonth(dateRef)
  const finMois     = endOfMonth(dateRef)
  const debutGrille = startOfWeek(debutMois, { weekStartsOn: 1 })
  const finGrille   = endOfWeek(finMois,     { weekStartsOn: 1 })
  const jours       = eachDayOfInterval({ start: debutGrille, end: finGrille })

  const semaines: Date[][] = []
  for (let i = 0; i < jours.length; i += 7) semaines.push(jours.slice(i, i + 7))

  const joursEnTete = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div className="flex flex-col h-full">
      {/* Titre du mois */}
      <div className="px-4 py-2 border-b border-gray-200 bg-white">
        <h2 className="text-base font-bold text-gray-800 capitalize">
          {format(dateRef, 'MMMM yyyy', { locale: fr })}
        </h2>
      </div>

      {/* En-têtes jours */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {joursEnTete.map(j => (
          <div key={j} className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
            {j}
          </div>
        ))}
      </div>

      {/* Rangées de semaines */}
      <div className="flex flex-col flex-1">
        {semaines.map((semaine, sIdx) => {
          const slottedJE = calcSlottedJE(evenements, semaine)
          const nbSlots   = slottedJE.length > 0 ? Math.max(...slottedJE.map(e => e.slot)) + 1 : 0
          const jeAreaH   = nbSlots * JE_SLOT_H
          // paddingTop des cellules = espace pour numéro + barres J.E.
          const topOffset = JE_NUM_H + jeAreaH

          return (
            <div
              key={sIdx}
              className="relative flex flex-1 border-b border-gray-100"
              style={{ minHeight: 80 }}
            >
              {/* Cellules jours */}
              {semaine.map((jour, jIdx) => {
                const horsMs  = !isSameMonth(jour, dateRef)
                const auj     = isToday(jour)
                const jourStr = format(jour, 'yyyy-MM-dd')

                const timedEvs = evenements.filter(e =>
                  !e.journee_entiere && e.date_debut?.startsWith(jourStr)
                )

                return (
                  <div
                    key={jIdx}
                    className={`relative flex-1 min-w-0 border-l border-gray-100 cursor-pointer transition-colors ${
                      horsMs ? 'bg-gray-50' : 'bg-white hover:bg-blue-50/30'
                    }`}
                    style={{ paddingTop: topOffset + 2 }}
                    onClick={() => onJourClick(jour)}
                    onDoubleClick={() => onNouvelEvenement(jour)}
                  >
                    {/* Numéro du jour (absolu, toujours en haut de la cellule) */}
                    <div className="absolute top-0.5 right-0.5 flex items-center justify-end">
                      <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        auj    ? 'bg-epoc-navy text-white'
                        : horsMs ? 'text-gray-300'
                        : 'text-gray-700'
                      }`}>
                        {format(jour, 'd')}
                      </span>
                    </div>

                    {/* Événements horaires */}
                    <div className="px-0.5 pb-1 space-y-0.5">
                      {timedEvs.slice(0, MAX_TIMED).map(ev => {
                        const colors = TYPE_COLORS[ev.type]
                        const heure  = ev.date_debut
                          ? format(parseISO(ev.date_debut), 'HH:mm')
                          : null
                        return (
                          <button
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); onEvenementClick(ev) }}
                            className={`w-full text-left rounded px-1 py-0.5 text-xs truncate ${colors.bg} ${colors.text} border-l-2 ${colors.border}`}
                            title={`${TYPE_LABELS[ev.type]} — ${ev.titre}${heure ? ` (${heure})` : ''}`}
                          >
                            {heure && <span className="font-mono mr-1">{heure}</span>}
                            {ev.titre}
                          </button>
                        )
                      })}
                      {timedEvs.length > MAX_TIMED && (
                        <p className="text-xs text-gray-400 pl-1">
                          +{timedEvs.length - MAX_TIMED} autre{timedEvs.length - MAX_TIMED > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Barres journée entière — positionnées en absolu sur toute la rangée */}
              {slottedJE.map(({ ev, colStart, colSpan, slot, clipLeft, clipRight }) => {
                const colors   = TYPE_COLORS[ev.type]
                const leftPct  = (colStart / 7) * 100
                const widthPct = (colSpan  / 7) * 100
                const gapL = clipLeft  ? 0 : 2
                const gapR = clipRight ? 0 : 2
                return (
                  <button
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); onEvenementClick(ev) }}
                    className={`absolute text-xs truncate px-1.5 ${colors.bg} ${colors.text} ${
                      !clipLeft  ? `border-l-2 ${colors.border} rounded-l` : ''
                    } ${!clipRight ? 'rounded-r' : ''}`}
                    style={{
                      left:       `calc(${leftPct}% + ${gapL}px)`,
                      width:      `calc(${widthPct}% - ${gapL + gapR}px)`,
                      top:        JE_NUM_H + slot * JE_SLOT_H,
                      height:     JE_SLOT_H - 2,
                      lineHeight: `${JE_SLOT_H - 2}px`,
                    }}
                    title={`${TYPE_LABELS[ev.type]} — ${ev.titre}`}
                  >
                    {ev.titre}
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
