import {
  format, parseISO, isToday, setHours, setMinutes,
  differenceInMinutes, getHours, getMinutes,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Evenement } from '../types'
import { TYPE_COLORS } from '../lib/constants'

interface Props {
  dateRef: Date
  evenements: Evenement[]
  onEvenementClick: (ev: Evenement) => void
  onNouvelEvenement: (date: Date) => void
}

const HEURE_DEBUT    = 7
const HEURE_FIN      = 21
const HAUTEUR_HEURE  = 80 // px par heure (plus grand pour le jour)

function topPx(date: Date): number {
  return ((getHours(date) - HEURE_DEBUT) * 60 + getMinutes(date)) / 60 * HAUTEUR_HEURE
}

function hauteurPx(debut: Date, fin: Date): number {
  return Math.max(differenceInMinutes(fin, debut) / 60 * HAUTEUR_HEURE, 24)
}

export default function VueJour({ dateRef, evenements, onEvenementClick, onNouvelEvenement }: Props) {
  const jourStr = format(dateRef, 'yyyy-MM-dd')
  const heures  = Array.from({ length: HEURE_FIN - HEURE_DEBUT }, (_, i) => HEURE_DEBUT + i)
  const total   = heures.length * HAUTEUR_HEURE

  const evJournee = evenements.filter(e => e.journee_entiere && e.date_journee === jourStr)
  const evHoraires = evenements.filter(e =>
    !e.journee_entiere &&
    e.date_debut &&
    e.date_debut.startsWith(jourStr) &&
    getHours(parseISO(e.date_debut)) >= HEURE_DEBUT &&
    getHours(parseISO(e.date_debut)) < HEURE_FIN
  )

  function handleClickGrille(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y    = e.clientY - rect.top
    const totalMins = (y / HAUTEUR_HEURE) * 60
    const heure = Math.floor(totalMins / 60) + HEURE_DEBUT
    const mins  = Math.round((totalMins % 60) / 5) * 5
    onNouvelEvenement(setMinutes(setHours(new Date(dateRef), heure), mins))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* En-tête */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className={`text-lg font-bold ${isToday(dateRef) ? 'text-epoc-navy' : 'text-gray-800'}`}>
          {format(dateRef, 'EEEE d MMMM yyyy', { locale: fr })}
          {isToday(dateRef) && <span className="ml-2 text-sm font-normal text-epoc-rose">Aujourd'hui</span>}
        </h2>
      </div>

      {/* Événements journée entière */}
      {evJournee.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 space-y-1">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Journée entière</p>
          {evJournee.map(ev => (
            <button
              key={ev.id}
              onClick={() => onEvenementClick(ev)}
              className={`w-full text-left rounded px-3 py-1.5 text-sm ${TYPE_COLORS[ev.type].bg} ${TYPE_COLORS[ev.type].text} border-l-4 ${TYPE_COLORS[ev.type].border}`}
            >
              {ev.titre}
            </button>
          ))}
        </div>
      )}

      {/* Grille horaire */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Heures */}
        <div className="w-16 flex-shrink-0 relative bg-white border-r border-gray-100" style={{ height: total }}>
          {heures.map(h => (
            <div
              key={h}
              className="absolute right-2 text-xs text-gray-400 -translate-y-2.5 select-none"
              style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Zone événements */}
        <div
          className="flex-1 relative cursor-pointer"
          style={{ height: total }}
          onClick={handleClickGrille}
        >
          {/* Lignes */}
          {heures.map(h => (
            <div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE }} />
          ))}
          {heures.map(h => (
            <div key={`${h}-30`} className="absolute left-0 right-0 border-t border-gray-50 border-dashed" style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE + HAUTEUR_HEURE / 2 }} />
          ))}

          {/* Heure actuelle */}
          {isToday(dateRef) && (() => {
            const now = new Date()
            if (getHours(now) >= HEURE_DEBUT && getHours(now) < HEURE_FIN) {
              return (
                <div
                  className="absolute left-0 right-0 border-t-2 border-epoc-rose z-10 pointer-events-none"
                  style={{ top: topPx(now) }}
                >
                  <div className="w-3 h-3 rounded-full bg-epoc-rose -mt-1.5 -ml-1.5" />
                </div>
              )
            }
            return null
          })()}

          {/* Événements */}
          {evHoraires.map(ev => {
            const debut  = parseISO(ev.date_debut!)
            const fin    = ev.date_fin ? parseISO(ev.date_fin) : new Date(debut.getTime() + 60 * 60 * 1000)
            const colors = TYPE_COLORS[ev.type]
            return (
              <button
                key={ev.id}
                onClick={e => { e.stopPropagation(); onEvenementClick(ev) }}
                className={`absolute left-2 right-2 rounded-lg px-3 py-1 text-sm text-left border-l-4 ${colors.bg} ${colors.text} ${colors.border} shadow hover:shadow-md transition-shadow`}
                style={{ top: topPx(debut) + 1, height: hauteurPx(debut, fin) - 2 }}
              >
                <span className="font-semibold">{format(debut, 'HH:mm')} – {format(fin, 'HH:mm')}</span>
                <span className="block truncate">{ev.titre}</span>
                {ev.note && <span className="block text-xs opacity-70 truncate">{ev.note}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
