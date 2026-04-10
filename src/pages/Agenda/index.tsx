import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import VueMois    from '../../components/VueMois'
import VueSemaine from '../../components/VueSemaine'
import VueJour    from '../../components/VueJour'
import EvenementModal      from '../../components/EvenementModal'
import ImportICS           from '../../components/ImportICS'
import AlertePlanification from '../../components/AlertePlanification'
import MiniCalendrier      from '../../components/MiniCalendrier'
import { useEvenements, useAllEvenements, useInsertEvenementsEnMasse } from '../../hooks/useEvenements'
import { useTaches }  from '../../hooks/useTaches'
import { useRelances } from '../../hooks/useRelances'
import { useAuth } from '../../hooks/useAuth'
import { trouverCreneau, tacheVersEvenement } from '../../lib/planification'
import type { Evenement } from '../../types'
import { supabase } from '../../lib/supabase'

type Vue = 'mois' | 'semaine' | 'jour'

// --- Notifications push locales (Service Worker) ---
async function demanderPermissionNotif(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

function planifierNotification(ev: Evenement) {
  if (!('serviceWorker' in navigator)) return

  let msAvant: number | null = null

  if (!ev.journee_entiere && ev.date_debut) {
    const debut = parseISO(ev.date_debut)
    const maintenant = Date.now()
    const trig = debut.getTime() - 15 * 60 * 1000 // 15 min avant
    msAvant = trig - maintenant
  } else if (ev.journee_entiere && ev.date_journee) {
    // La veille à 12h00
    const veille = new Date(ev.date_journee + 'T00:00:00')
    veille.setDate(veille.getDate() - 1)
    veille.setHours(12, 0, 0, 0)
    msAvant = veille.getTime() - Date.now()
  }

  if (msAvant === null || msAvant <= 0) return

  setTimeout(() => {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(ev.titre, {
        body: ev.note ?? (ev.date_debut ? `Début à ${format(parseISO(ev.date_debut), 'HH:mm')}` : 'Événement journée entière demain'),
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `agenda-${ev.id}`,
      })
    })
    // Marquer notif_envoyee via Supabase
    supabase.from('agenda_evenements').update({ notif_envoyee: true }).eq('id', ev.id)
  }, msAvant)
}

export default function Agenda() {
  const { signOut } = useAuth()
  const [vue, setVue]       = useState<Vue>(() => (localStorage.getItem('agenda-vue') as Vue) ?? 'semaine')
  const [dateRef, setDateRef] = useState(new Date())
  const [moisRef, setMoisRef] = useState(new Date())

  const [modalEv, setModalEv]         = useState<Evenement | null | undefined>(undefined) // undefined = fermé
  const [dateNouveau, setDateNouveau] = useState<Date | null>(null)
  const [showImport, setShowImport]   = useState(false)
  const [showMenu, setShowMenu]       = useState(false)

  const annee = moisRef.getFullYear()
  const mois  = moisRef.getMonth() + 1

  const { data: evenements = [], isLoading } = useEvenements(annee, mois)
  const { data: allEvs = [] }     = useAllEvenements()
  const { data: taches = [] }     = useTaches()
  const { data: relances = [] }   = useRelances()
  const insertMut  = useInsertEvenementsEnMasse()

  // Sauvegarde la vue active
  useEffect(() => { localStorage.setItem('agenda-vue', vue) }, [vue])

  // Synchronise moisRef avec dateRef
  useEffect(() => {
    setMoisRef(new Date(dateRef.getFullYear(), dateRef.getMonth(), 1))
  }, [dateRef])

  // ---- Planification automatique des tâches ----
  useEffect(() => {
    if (!taches.length || !allEvs.length) return

    const sourceIds = new Set(allEvs.filter(e => e.source === 'crm_tache').map(e => e.source_id))
    const tachesASynchroniser = taches.filter(t =>
      t.date_echeance &&
      !sourceIds.has(t.id) &&
      t.planning_impossible !== true
    )

    if (!tachesASynchroniser.length) return

    const nouveaux: Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee'>[] = []
    const impossibles: string[] = []
    const evsTravail = [...allEvs]

    for (const tache of tachesASynchroniser) {
      const creneau = trouverCreneau(tache, evsTravail)
      if (!creneau) {
        impossibles.push(tache.id)
        continue
      }
      const ev = tacheVersEvenement(tache, creneau)
      nouveaux.push(ev)
      // Ajouter à la liste de travail pour éviter les chevauchements dans la même passe
      evsTravail.push({ ...ev, id: 'tmp', created_at: new Date().toISOString(), notif_envoyee: false })
    }

    if (nouveaux.length > 0) {
      insertMut.mutate(nouveaux)
    }

    // Marquer planning_impossible sur les tâches sans créneau
    if (impossibles.length > 0) {
      supabase.from('taches').update({ planning_impossible: true }).in('id', impossibles)
    }
  }, [taches, allEvs])

  // ---- Synchronisation relances → agenda ----
  useEffect(() => {
    if (!relances.length || !allEvs.length) return

    const sourceIds = new Set(allEvs.filter(e => e.source === 'crm_relance').map(e => e.source_id))
    const relancesNouvelles = relances.filter(r => r.date && !sourceIds.has(r.id))

    if (!relancesNouvelles.length) return

    const nouveaux: Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee'>[] = relancesNouvelles.map(r => {
      const hasHeure = !!r.heure
      if (hasHeure) {
        const debut = new Date(`${r.date}T${r.heure}`)
        const fin   = new Date(debut.getTime() + (r.duree ?? 30) * 60 * 1000)
        return {
          titre:                r.titre,
          type:                 'relance' as const,
          journee_entiere:      false,
          date_journee:         null,
          date_fin_journee:     null,
          date_debut:           debut.toISOString(),
          date_fin:             fin.toISOString(),
          contact_id:           r.contact_id,
          lieu:                 null,
          note:                 null,
          source:               'crm_relance' as const,
          source_id:            r.id,
          recurrence_rule:      null,
          recurrence_groupe_id: null,
        }
      } else {
        return {
          titre:                r.titre,
          type:                 'relance' as const,
          journee_entiere:      true,
          date_journee:         r.date,
          date_fin_journee:     null,
          date_debut:           null,
          date_fin:             null,
          contact_id:           r.contact_id,
          lieu:                 null,
          note:                 null,
          source:               'crm_relance' as const,
          source_id:            r.id,
          recurrence_rule:      null,
          recurrence_groupe_id: null,
        }
      }
    })

    insertMut.mutate(nouveaux)
  }, [relances, allEvs])

  // ---- Notifications ----
  useEffect(() => {
    demanderPermissionNotif().then(granted => {
      if (!granted) return
      // Planifier les notifs pour les événements non encore notifiés, dans les prochaines 24h
      const horizon = Date.now() + 24 * 60 * 60 * 1000
      evenements
        .filter(ev => !ev.notif_envoyee)
        .filter(ev => {
          if (!ev.journee_entiere && ev.date_debut) {
            const t = parseISO(ev.date_debut).getTime() - 15 * 60 * 1000
            return t > Date.now() && t < horizon
          }
          if (ev.journee_entiere && ev.date_journee) {
            const veille = new Date(ev.date_journee + 'T12:00:00')
            veille.setDate(veille.getDate() - 1)
            const t = veille.getTime()
            return t > Date.now() && t < horizon
          }
          return false
        })
        .forEach(planifierNotification)
    })
  }, [evenements])


  function ouvrirNouvelEvenement(date: Date) {
    setDateNouveau(date)
    setModalEv(null)
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Barre de navigation */}
      <header className="relative flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-200 bg-white gap-2" style={{ zIndex: 1000 }}>
        {/* Titre + nav */}
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => setDateRef(new Date())}
            className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 flex-shrink-0"
          >
            Aujourd'hui
          </button>
        </div>

        {/* Sélecteur de vue */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs flex-shrink-0">
          {(['jour', 'semaine', 'mois'] as Vue[]).map(v => (
            <button
              key={v}
              onClick={() => setVue(v)}
              className={`px-2.5 py-1.5 font-medium transition-colors ${
                vue === v
                  ? 'bg-epoc-navy text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'jour' ? 'Jour' : v === 'semaine' ? 'Sem.' : 'Mois'}
            </button>
          ))}
        </div>

        {/* Menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(m => !m)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            ⋯
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-sm" style={{ zIndex: 2000 }}>
              <a
                href="https://crm.ecole-epoc.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700"
                onClick={() => setShowMenu(false)}
              >
                <span>↗</span> Ouvrir le CRM
              </a>
              <hr className="my-1 border-gray-100" />
              <button
                onClick={() => { setShowImport(true); setShowMenu(false) }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700"
              >
                Importer .ics Mailo
              </button>
              <hr className="my-1 border-gray-100" />
              <button
                onClick={() => { signOut(); setShowMenu(false) }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-500"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Corps : sidebar + contenu */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar mini-calendrier (desktop uniquement) */}
        <aside className="hidden md:flex flex-col w-52 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          {/* Bouton Nouvel événement */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => ouvrirNouvelEvenement(dateRef)}
              className="w-full bg-epoc-navy text-white text-sm font-medium py-2 rounded-xl hover:bg-epoc-navy/90 transition-colors"
            >
              + Nouvel événement
            </button>
          </div>

          <MiniCalendrier
            dateRef={dateRef}
            evenements={evenements}
            onJourClick={d => { setDateRef(d); setVue('jour') }}
            onMoisChange={d => setDateRef(d)}
          />

          {/* Alerte planification dans sidebar */}
          {taches.some(t => t.planning_impossible) && (
            <div className="px-3 pb-3">
              <AlertePlanification taches={taches} />
            </div>
          )}
        </aside>

        {/* Alerte planification mobile */}
        {taches.some(t => t.planning_impossible) && (
          <div className="md:hidden px-4 pt-2 w-full absolute z-10">
            <AlertePlanification taches={taches} />
          </div>
        )}

        {/* Bouton + (mobile uniquement) */}
        <button
          onClick={() => ouvrirNouvelEvenement(dateRef)}
          className="md:hidden fixed bottom-6 right-4 z-20 w-14 h-14 rounded-full bg-epoc-rose text-white text-2xl shadow-lg hover:bg-epoc-rose/90 active:scale-95 transition-transform flex items-center justify-center"
          aria-label="Nouvel événement"
        >
          +
        </button>

        {/* Contenu principal */}
        <main className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chargement…</div>
          ) : vue === 'mois' ? (
            <VueMois
              dateRef={dateRef}
              evenements={evenements}
              onJourClick={d => { setDateRef(d); setVue('jour') }}
              onEvenementClick={ev => setModalEv(ev)}
              onNouvelEvenement={ouvrirNouvelEvenement}
            />
          ) : vue === 'semaine' ? (
            <VueSemaine
              dateRef={dateRef}
              evenements={evenements}
              onEvenementClick={ev => setModalEv(ev)}
              onNouvelEvenement={ouvrirNouvelEvenement}
            />
          ) : (
            <VueJour
              dateRef={dateRef}
              evenements={evenements}
              onEvenementClick={ev => setModalEv(ev)}
              onNouvelEvenement={ouvrirNouvelEvenement}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {modalEv !== undefined && (
        <EvenementModal
          evenement={modalEv}
          dateInitiale={dateNouveau ?? undefined}
          onClose={() => { setModalEv(undefined); setDateNouveau(null) }}
        />
      )}
      {showImport && <ImportICS onClose={() => setShowImport(false)} />}
    </div>
  )
}
