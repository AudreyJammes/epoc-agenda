import { useState, useEffect, useRef } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import type { Evenement, EvenementFormData, TypeEvenement, FrequenceRecurrence } from '../types'
import { TYPE_LABELS, TYPE_COLORS } from '../lib/constants'
import { useContacts, contactLabel } from '../hooks/useContacts'
import {
  useCreateEvenement, useUpdateEvenement, useDeleteEvenement,
  useInsertEvenementsEnMasse, useDeleteSerie,
} from '../hooks/useEvenements'
import { genererOccurrences, encodeRule } from '../lib/recurrence'

interface Props {
  evenement?: Evenement | null
  dateInitiale?: Date
  onClose: () => void
}

const TYPES: TypeEvenement[] = ['perso', 'ateliers', 'epoc', 'fetes_anniversaires', 'relance', 'tache']

function genererICS(ev: Evenement): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  const dtstamp = format(new Date(), "yyyyMMdd'T'HHmmss'Z'")
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EPOC//Agenda EPOC//FR',
    'BEGIN:VEVENT',
    `UID:${ev.id}@agenda.ecole-epoc.fr`,
    `DTSTAMP:${dtstamp}`,
  ]
  if (ev.journee_entiere && ev.date_journee) {
    lines.push(`DTSTART;VALUE=DATE:${ev.date_journee.replace(/-/g, '')}`)
    const finDate = addDays(new Date(ev.date_fin_journee ?? ev.date_journee), 1)
    lines.push(`DTEND;VALUE=DATE:${format(finDate, 'yyyyMMdd')}`)
  } else if (ev.date_debut && ev.date_fin) {
    lines.push(`DTSTART:${format(parseISO(ev.date_debut), "yyyyMMdd'T'HHmmss")}`)
    lines.push(`DTEND:${format(parseISO(ev.date_fin), "yyyyMMdd'T'HHmmss")}`)
  } else {
    return ''
  }
  lines.push(`SUMMARY:${esc(ev.titre)}`)
  if (ev.lieu) lines.push(`LOCATION:${esc(ev.lieu)}`)
  if (ev.lien) lines.push(`URL:${ev.lien}`)
  if (ev.note) lines.push(`DESCRIPTION:${esc(ev.note)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

function telechargerICS(ev: Evenement) {
  const content = genererICS(ev)
  if (!content) return
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.titre.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function defaultForm(evenement?: Evenement | null, dateInitiale?: Date): EvenementFormData {
  const d = dateInitiale ?? new Date()
  if (evenement) {
    const date = evenement.journee_entiere
      ? evenement.date_journee ?? format(new Date(), 'yyyy-MM-dd')
      : evenement.date_debut
      ? format(parseISO(evenement.date_debut), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
    return {
      titre:                evenement.titre,
      type:                 evenement.type,
      journee_entiere:      evenement.journee_entiere,
      date_journee:         evenement.date_journee ?? date,
      date_fin_journee:     evenement.date_fin_journee ?? date,
      date_debut:           date,
      heure_debut:          evenement.date_debut ? format(parseISO(evenement.date_debut), 'HH:mm') : '09:00',
      heure_fin:            evenement.date_fin   ? format(parseISO(evenement.date_fin),   'HH:mm') : '10:00',
      contact_id:           evenement.contact_id ?? '',
      lieu:                 evenement.lieu ?? '',
      lien:                 evenement.lien ?? '',
      note:                 evenement.note ?? '',
      recurrence:           false,
      recurrence_frequence: 'hebdomadaire',
      recurrence_jours:     [],
      recurrence_jusqu_au:  '',
    }
  }
  const heureFin = new Date(d.getTime() + 60 * 60 * 1000)
  return {
    titre:                '',
    type:                 'epoc',
    journee_entiere:      false,
    date_journee:         format(d, 'yyyy-MM-dd'),
    date_fin_journee:     format(d, 'yyyy-MM-dd'),
    date_debut:           format(d, 'yyyy-MM-dd'),
    heure_debut:          format(d, 'HH:mm'),
    heure_fin:            format(heureFin, 'HH:mm'),
    contact_id:           '',
    lieu:                 '',
    lien:                 '',
    note:                 '',
    recurrence:           false,
    recurrence_frequence: 'hebdomadaire',
    recurrence_jours:     [],
    recurrence_jusqu_au:  '',
  }
}

export default function EvenementModal({ evenement, dateInitiale, onClose }: Props) {
  const isEditing = !!evenement
  const isSerie   = !!evenement?.recurrence_groupe_id

  const { data: contacts = [] } = useContacts()
  const createMut    = useCreateEvenement()
  const updateMut    = useUpdateEvenement()
  const deleteMut    = useDeleteEvenement()
  const insertMasse  = useInsertEvenementsEnMasse()
  const deleteSerie  = useDeleteSerie()

  const [form, setForm]                   = useState<EvenementFormData>(() => defaultForm(evenement, dateInitiale))
  const [contactSearch, setContactSearch] = useState('')
  const [showContactList, setShowContactList] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const contactRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setShowContactList(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => {
    if (evenement?.contact_id) {
      const c = contacts.find(c => c.id === evenement.contact_id)
      if (c) setContactSearch(contactLabel(c))
    }
  }, [contacts, evenement])

  const contactsFiltres = contactSearch.length >= 2
    ? contacts.filter(c => contactLabel(c).toLowerCase().includes(contactSearch.toLowerCase()))
    : []

  function set<K extends keyof EvenementFormData>(k: K, v: EvenementFormData[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleJour(idx: number) {
    setForm(f => ({
      ...f,
      recurrence_jours: f.recurrence_jours.includes(idx)
        ? f.recurrence_jours.filter(j => j !== idx)
        : [...f.recurrence_jours, idx],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titre.trim()) return

    if (isEditing) {
      // Modifier toute la série si elle existe, sinon juste l'événement
      if (isSerie) {
        await deleteSerie.mutateAsync(evenement!.recurrence_groupe_id!)
        const rule = encodeRule(form.recurrence_frequence, form.recurrence_jours, form.recurrence_jusqu_au)
        const occs = genererOccurrences(form, evenement!.recurrence_groupe_id!, rule)
        await insertMasse.mutateAsync(occs)
      } else {
        await updateMut.mutateAsync({
          id:               evenement!.id,
          titre:            form.titre,
          type:             form.type,
          journee_entiere:  form.journee_entiere,
          date_journee:     form.journee_entiere ? form.date_journee    : null,
          date_fin_journee: form.journee_entiere ? form.date_fin_journee : null,
          date_debut:       form.journee_entiere ? null : new Date(`${form.date_debut}T${form.heure_debut}:00`).toISOString(),
          date_fin:         form.journee_entiere ? null : new Date(`${form.date_debut}T${form.heure_fin}:00`).toISOString(),
          contact_id:       form.contact_id || null,
          lieu:             form.lieu || null,
          lien:             form.lien || null,
          note:             form.note || null,
        })
      }
    } else if (form.recurrence) {
      // Créer une série
      const groupeId = uuidv4()
      const rule = encodeRule(form.recurrence_frequence, form.recurrence_jours, form.recurrence_jusqu_au)
      const occs = genererOccurrences(form, groupeId, rule)
      await insertMasse.mutateAsync(occs)
    } else {
      // Créer un seul événement
      await createMut.mutateAsync(form)
    }
    onClose()
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (isSerie) {
      await deleteSerie.mutateAsync(evenement!.recurrence_groupe_id!)
    } else {
      await deleteMut.mutateAsync(evenement!.id)
    }
    onClose()
  }

  const loading = createMut.isPending || updateMut.isPending || deleteMut.isPending
    || insertMasse.isPending || deleteSerie.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-epoc-navy">
            {isEditing ? "Modifier l'événement" : 'Nouvel événement'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Titre */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Titre <span className="text-epoc-rose">*</span></label>
            <input
              type="text"
              required
              value={form.titre}
              onChange={e => set('titre', e.target.value)}
              placeholder="Titre de l'événement"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('type', t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.type === t
                      ? `${TYPE_COLORS[t].bg} ${TYPE_COLORS[t].text} ${TYPE_COLORS[t].border}`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Journée entière */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="journee_entiere"
              checked={form.journee_entiere}
              onChange={e => set('journee_entiere', e.target.checked)}
              className="rounded accent-epoc-navy"
            />
            <label htmlFor="journee_entiere" className="text-sm text-gray-700 cursor-pointer">Journée entière</label>
          </div>

          {/* Date / Heure */}
          {form.journee_entiere ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de début</label>
                <input
                  type="date"
                  value={form.date_journee}
                  onChange={e => set('date_journee', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de fin</label>
                <input
                  type="date"
                  value={form.date_fin_journee}
                  min={form.date_journee}
                  onChange={e => set('date_fin_journee', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={form.date_debut}
                  onChange={e => set('date_debut', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Début</label>
                <input
                  type="time"
                  step="300"
                  value={form.heure_debut}
                  onChange={e => {
                    const newDebut = e.target.value
                    const [dh, dm] = form.heure_debut.split(':').map(Number)
                    const [fh, fm] = form.heure_fin.split(':').map(Number)
                    const dureeMin = (fh * 60 + fm) - (dh * 60 + dm)
                    const [nh, nm] = newDebut.split(':').map(Number)
                    const finTotalMin = Math.min(nh * 60 + nm + dureeMin, 23 * 60 + 55)
                    const newFin = `${String(Math.floor(finTotalMin / 60)).padStart(2, '0')}:${String(finTotalMin % 60).padStart(2, '0')}`
                    setForm(f => ({ ...f, heure_debut: newDebut, heure_fin: newFin }))
                  }}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
                <input
                  type="time"
                  step="300"
                  value={form.heure_fin}
                  onChange={e => set('heure_fin', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
                />
              </div>
            </div>
          )}

          {/* Récurrence */}
          <div className="border border-gray-100 rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurrence"
                  checked={form.recurrence || isSerie}
                  onChange={e => set('recurrence', e.target.checked)}
                  disabled={isSerie}
                  className="rounded accent-epoc-navy"
                />
                <label htmlFor="recurrence" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Événement récurrent
                  {isSerie && <span className="ml-2 text-xs text-epoc-violet font-normal">(série)</span>}
                </label>
              </div>

              {(form.recurrence || isSerie) && (
                <div className="space-y-3 pl-1">
                  {/* Fréquence */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fréquence</label>
                    <div className="flex flex-wrap gap-2">
                      {(['quotidien', 'hebdomadaire', 'mensuel', 'annuel'] as FrequenceRecurrence[]).map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => set('recurrence_frequence', f)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            form.recurrence_frequence === f
                              ? 'bg-epoc-navy text-white border-epoc-navy'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {f === 'quotidien' ? 'Quotidien' : f === 'hebdomadaire' ? 'Hebdo' : f === 'mensuel' ? 'Mensuel' : 'Annuel'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Jours de la semaine (hebdo seulement) */}
                  {form.recurrence_frequence === 'hebdomadaire' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Jours</label>
                      <div className="flex gap-1.5">
                        {JOURS_SEMAINE.map((j, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleJour(idx)}
                            className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                              form.recurrence_jours.includes(idx)
                                ? 'bg-epoc-navy text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {j[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Jusqu'au */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Jusqu'au <span className="text-gray-400 font-normal">(optionnel — 50 ans par défaut)</span>
                    </label>
                    <input
                      type="date"
                      value={form.recurrence_jusqu_au}
                      min={form.date_debut || form.date_journee}
                      onChange={e => set('recurrence_jusqu_au', e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
                    />
                    {form.recurrence_jusqu_au && (
                      <button
                        type="button"
                        onClick={() => set('recurrence_jusqu_au', '')}
                        className="mt-1 text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        Effacer (sans date de fin)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

          {/* Contact CRM */}
          <div ref={contactRef}>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contact CRM (optionnel)</label>
            <input
              type="text"
              value={contactSearch}
              onChange={e => { setContactSearch(e.target.value); setShowContactList(true); if (!e.target.value) set('contact_id', '') }}
              onFocus={() => setShowContactList(true)}
              placeholder="Rechercher un contact…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
            />
            {showContactList && contactsFiltres.length > 0 && (
              <ul className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto bg-white shadow-lg z-10 relative">
                {contactsFiltres.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        set('contact_id', c.id)
                        setContactSearch(contactLabel(c))
                        setShowContactList(false)
                      }}
                    >
                      {contactLabel(c)}
                      {c.email && <span className="text-gray-400 text-xs ml-2">{c.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Lieu + Lien */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lieu</label>
              <input
                type="text"
                value={form.lieu}
                onChange={e => set('lieu', e.target.value)}
                placeholder="Adresse, salle…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lien visio</label>
              <input
                type="url"
                value={form.lien}
                onChange={e => set('lien', e.target.value)}
                placeholder="https://zoom.us/…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note libre</label>
            <textarea
              value={form.note}
              onChange={e => set('note', e.target.value)}
              rows={2}
              placeholder="Note…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30 resize-none"
            />
          </div>

          {evenement?.source && evenement.source !== 'manuel' && (
            <p className="text-xs text-gray-400">Source : {evenement.source.replace('_', ' ')}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => telechargerICS(evenement!)}
                  className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Télécharger l'invitation (.ics)"
                >
                  📅 Invitation
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                    confirmDelete
                      ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                      : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {confirmDelete
                    ? (isSerie ? 'Confirmer (toute la série)' : 'Confirmer')
                    : (isSerie ? 'Supprimer la série' : '🗑 Supprimer')}
                </button>
              </div>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !form.titre.trim()}
                className="px-4 py-2 text-sm font-medium bg-epoc-navy text-white rounded-lg hover:bg-epoc-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '…' : isEditing ? 'Enregistrer' : (form.recurrence ? 'Créer la série' : 'Créer')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
