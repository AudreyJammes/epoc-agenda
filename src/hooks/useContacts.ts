import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Contact } from '../types'

export function useContacts() {
  return useQuery({
    queryKey: ['contacts-agenda'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, prenom, nom, email, telephone, organisation_id')
        .order('nom', { ascending: true })
      if (error) throw error
      return (data ?? []) as Contact[]
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function contactLabel(c: Contact): string {
  const parts = [c.prenom, c.nom].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : (c.email ?? c.id)
}
