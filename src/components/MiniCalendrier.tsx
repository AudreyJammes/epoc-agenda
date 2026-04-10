import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addMonths, subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Evenement } from '../types'
import { TYPE_COLORS } from '../lib/constants'

interface Props {
  dateRef: Date
  evenements: Evenement[]
  onJourClick: (date: Date) => void
  onMoisChange: (date: Date) => void
}

export default function MiniCalendrier({ dateRef, evenements, onJourClick, onMoisChange }: Props) {
  const debutMois   = startOfMonth(dateRef)
  const finMois     = endOfMonth(dateRef)
  const debutGrille = startOfWeek(debutMois, { weekStartsOn: 1 })
  const finGrille   = endOfWeek(finMois,     { weekStartsOn: 1 })
  const jours       = eachDayOfInterval({ start: debutGrille, end: finGrille })

  const joursEnTete = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  function pointsCouleurs(jour: Date) {
    const jourStr = format(jour, 'yyyy-MM-dd')
    const evsDuJour = evenements.filter(e => {
      if (e.journee_entiere) {
        const debut = e.date_journee ?? ''
        const fin   = e.date_fin_journee ?? debut
        return jourStr >= debut && jourStr <= fin
      }
      return e.date_debut?.startsWith(jourStr) ?? false
    })
    // Déduplique les types
    const types = [...new Set(evsDuJour.map(e => e.type))].slice(0, 3)
    return types
  }

  return (
    <div className="select-none px-3 py-3">
      {/* En-tête mois */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMoisChange(subMonths(dateRef, 1))}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-sm"
        >
          ‹
        </button>
        <button
          onClick={() => onMoisChange(new Date())}
          className="text-xs font-semibold text-epoc-navy capitalize hover:underline"
        >
          {format(dateRef, 'MMMM yyyy', { locale: fr })}
        </button>
        <button
          onClick={() => onMoisChange(addMonths(dateRef, 1))}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-sm"
        >
          ›
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 mb-1">
        {joursEnTete.map((j, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-gray-400 py-0.5">
            {j}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {jours.map((jour, idx) => {
          const horsMs  = !isSameMonth(jour, dateRef)
          const auj     = isToday(jour)
          const selec   = isSameDay(jour, dateRef)
          const points  = pointsCouleurs(jour)

          return (
            <button
              key={idx}
              onClick={() => onJourClick(jour)}
              className={`flex flex-col items-center justify-center py-0.5 rounded-lg transition-colors ${
                selec
                  ? 'bg-epoc-navy text-white'
                  : auj
                  ? 'bg-epoc-navy/10 text-epoc-navy font-bold'
                  : horsMs
                  ? 'text-gray-300'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-[11px] leading-tight">{format(jour, 'd')}</span>
              {/* Points de couleur pour les événements */}
              {points.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {points.map((type, i) => (
                    <span
                      key={i}
                      className={`w-1 h-1 rounded-full ${selec ? 'bg-white/70' : TYPE_COLORS[type].dot}`}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
