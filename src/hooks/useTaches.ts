import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tache } from '../types'

// Charge les tâches avec une date_echeance définie et non terminées
// (lecture seule — la planification se fait côté agenda, jamais d'écriture sur cette table)
export function useTaches() {
  return useQuery({
    queryKey: ['crm-taches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taches')
        .select('id, titre, description, statut, date_echeance, priorite, contact_id, planning_impossible')
        .neq('statut', 'terminé')
        .not('date_echeance', 'is', null)
        .order('date_echeance', { ascending: true })

      if (error) throw error
      return (data ?? []) as Tache[]
    },
    staleTime: 1000 * 60 * 5,
  })
}
