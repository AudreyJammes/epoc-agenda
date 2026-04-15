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

function evenementsDuJour(evenements: Evenement[], jour: Date): Evenement[] {
  const jourStr = format(jour, 'yyyy-MM-dd')
  return evenements.filter(e => {
    if (e.journee_entiere) {
      // Multi-jours : le jour est dans la plage date_journee..date_fin_journee
      const debut = e.date_journee ?? ''
      const fin   = e.date_fin_journee ?? debut
      return jourStr >= debut && jourStr <= fin
    }
    if (e.date_debut) return e.date_debut.startsWith(jourStr)
    return false
  })
}

export default function VueMois({ dateRef, evenements, onJourClick, onEvenementClick, onNouvelEvenement }: Props) {
  const debutMois = startOfMonth(dateRef)
  const finMois   = endOfMonth(dateRef)
  const debutGrille = startOfWeek(debutMois, { weekStartsOn: 1 })
  const finGrille   = endOfWeek(finMois,   { weekStartsOn: 1 })
  const jours = eachDayOfInterval({ start: debutGrille, end: finGrille })

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

      {/* Grille */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-gray-100">
        {jours.map((jour, idx) => {
          const evs = evenementsDuJour(evenements, jour)
          const horsMs = !isSameMonth(jour, dateRef)
          const auj    = isToday(jour)
          const MAX = 3

          return (
            <div
              key={idx}
              className={`min-h-[80px] p-1 border-b border-gray-100 cursor-pointer transition-colors ${
                horsMs ? 'bg-gray-50' : 'bg-white hover:bg-blue-50/30'
              }`}
              onClick={() => onJourClick(jour)}
              onDoubleClick={() => onNouvelEvenement(jour)}
            >
              {/* Numéro du jour */}
              <div className="flex items-center justify-end mb-1">
                <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                  auj
                    ? 'bg-epoc-navy text-white'
                    : horsMs
                    ? 'text-gray-300'
                    : 'text-gray-700'
                }`}>
                  {format(jour, 'd')}
                </span>
              </div>

              {/* Événements (max 3, puis +n) */}
              <div className="space-y-0.5">
                {evs.slice(0, MAX).map(ev => {
                  const colors = TYPE_COLORS[ev.type]
                  const heure = ev.date_debut
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
                {evs.length > MAX && (
                  <p className="text-xs text-gray-400 pl-1">+{evs.length - MAX} autre{evs.length - MAX > 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
