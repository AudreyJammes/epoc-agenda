import type { Tache } from '../types'

interface Props {
  taches: Tache[]
}

// Affiche un panneau d'alerte pour les tâches dont la planification est impossible
export default function AlertePlanification({ taches }: Props) {
  const tachesBloquees = taches.filter(t => t.planning_impossible === true)
  if (tachesBloquees.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4">
      <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-2">
        <span>⚠️</span>
        {tachesBloquees.length === 1
          ? '1 tâche impossible à planifier'
          : `${tachesBloquees.length} tâches impossibles à planifier`}
      </h3>
      <ul className="space-y-1">
        {tachesBloquees.map(t => (
          <li key={t.id} className="text-sm text-amber-700 flex items-start gap-2">
            <span className="mt-0.5 text-amber-400">•</span>
            <span>
              <strong>{t.titre}</strong>
              {t.date_echeance && (
                <span className="text-amber-500 text-xs ml-2">
                  (échéance : {new Date(t.date_echeance + 'T00:00:00').toLocaleDateString('fr-FR')})
                </span>
              )}
              <span className="block text-xs text-amber-500 mt-0.5">
                Aucun créneau disponible avant l'échéance — planifie manuellement cette tâche.
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
