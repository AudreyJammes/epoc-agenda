import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Relance } from '../types'

// Charge les relances avec une date définie
// (lecture seule — l'agenda ne modifie pas la table relances)
export function useRelances() {
  return useQuery({
    queryKey: ['crm-relances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relances')
        .select('id, contact_id, titre, date, heure, duree, synced')
        .not('date', 'is', null)
        .order('date', { ascending: true })

      if (error) throw error
      return (data ?? []) as Relance[]
    },
    staleTime: 1000 * 60 * 5,
  })
}
