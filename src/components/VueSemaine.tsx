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
  onEvenementClick: (ev: Evenement) => void
  onNouvelEvenement: (date: Date) => void
}

const HEURE_DEBUT = 7   // première ligne visible
const HEURE_FIN   = 21  // dernière ligne
const HAUTEUR_HEURE = 60 // px par heure

function topPx(date: Date): number {
  const h = getHours(date) - HEURE_DEBUT
  const m = getMinutes(date)
  return (h * 60 + m) / 60 * HAUTEUR_HEURE
}

function hauteurPx(debut: Date, fin: Date): number {
  const mins = differenceInMinutes(fin, debut)
  return Math.max(mins / 60 * HAUTEUR_HEURE, 20)
}

export default function VueSemaine({ dateRef, evenements, onEvenementClick, onNouvelEvenement }: Props) {
  const debutSemaine = startOfWeek(dateRef, { weekStartsOn: 1 })
  const finSemaine   = endOfWeek(dateRef,   { weekStartsOn: 1 })
  const jours = eachDayOfInterval({ start: debutSemaine, end: finSemaine })

  const heures = Array.from({ length: HEURE_FIN - HEURE_DEBUT }, (_, i) => HEURE_DEBUT + i)
  const totalHauteur = heures.length * HAUTEUR_HEURE

  // Événements journée entière
  const evJourneeEntiere = evenements.filter(e => e.journee_entiere)

  function evsAvecHeureduJour(jour: Date): Evenement[] {
    const jourStr = format(jour, 'yyyy-MM-dd')
    return evenements.filter(e =>
      !e.journee_entiere &&
      e.date_debut &&
      e.date_debut.startsWith(jourStr) &&
      getHours(parseISO(e.date_debut)) >= HEURE_DEBUT &&
      getHours(parseISO(e.date_debut)) < HEURE_FIN
    )
  }

  function evJourneeEntiereDuJour(jour: Date): Evenement[] {
    const jourStr = format(jour, 'yyyy-MM-dd')
    return evJourneeEntiere.filter(e => {
      const debut = e.date_journee ?? ''
      const fin   = e.date_fin_journee ?? debut
      return jourStr >= debut && jourStr <= fin
    })
  }

  function handleClickCreneau(jour: Date, heure: number) {
    const date = setMinutes(setHours(new Date(jour), heure), 0)
    onNouvelEvenement(date)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* En-têtes */}
      <div className="flex border-b border-gray-200 bg-white z-10">
        <div className="w-12 flex-shrink-0" />
        {jours.map(jour => (
          <div key={jour.toISOString()} className="flex-1 text-center py-2 border-l border-gray-100">
            <div className="text-xs text-gray-500 uppercase">{format(jour, 'EEE', { locale: fr })}</div>
            <div className={`text-sm font-semibold mx-auto w-8 h-8 flex items-center justify-center rounded-full ${
              isToday(jour) ? 'bg-epoc-navy text-white' : 'text-gray-800'
            }`}>
              {format(jour, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Bande journée entière */}
      <div className="flex border-b border-gray-200 bg-white min-h-[28px]">
        <div className="w-12 flex-shrink-0 flex items-center justify-end pr-1">
          <span className="text-xs text-gray-400">J.E.</span>
        </div>
        {jours.map(jour => {
          const evs = evJourneeEntiereDuJour(jour)
          return (
            <div key={jour.toISOString()} className="flex-1 border-l border-gray-100 px-0.5 py-0.5 space-y-0.5">
              {evs.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onEvenementClick(ev)}
                  className={`w-full text-left rounded px-1 py-0.5 text-xs truncate ${TYPE_COLORS[ev.type].bg} ${TYPE_COLORS[ev.type].text} border-l-2 ${TYPE_COLORS[ev.type].border}`}
                >
                  {ev.titre}
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {/* Grille horaire */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Colonne heures */}
        <div className="w-12 flex-shrink-0 relative" style={{ height: totalHauteur }}>
          {heures.map(h => (
            <div
              key={h}
              className="absolute right-1 text-xs text-gray-400 -translate-y-2.5"
              style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE }}
            >
              {h}h
            </div>
          ))}
        </div>

        {/* Colonnes jours */}
        {jours.map(jour => {
          const evs = evsAvecHeureduJour(jour)
          return (
            <div
              key={jour.toISOString()}
              className="flex-1 border-l border-gray-100 relative"
              style={{ height: totalHauteur }}
              onClick={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const y = e.clientY - rect.top
                const heure = Math.floor(y / HAUTEUR_HEURE) + HEURE_DEBUT
                handleClickCreneau(jour, heure)
              }}
            >
              {/* Lignes heures */}
              {heures.map(h => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE }}
                />
              ))}
              {/* Ligne demi-heure */}
              {heures.map(h => (
                <div
                  key={`${h}-30`}
                  className="absolute left-0 right-0 border-t border-gray-50"
                  style={{ top: (h - HEURE_DEBUT) * HAUTEUR_HEURE + HAUTEUR_HEURE / 2 }}
                />
              ))}

              {/* Événements */}
              {evs.map(ev => {
                const debut = parseISO(ev.date_debut!)
                const fin   = ev.date_fin ? parseISO(ev.date_fin) : new Date(debut.getTime() + 60 * 60 * 1000)
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
