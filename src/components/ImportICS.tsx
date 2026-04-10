import { useState, useRef } from 'react'
import { parseIcs } from '../lib/ics-parser'
import { useInsertEvenementsEnMasse } from '../hooks/useEvenements'

interface Props {
  onClose: () => void
}

export default function ImportICS({ onClose }: Props) {
  const [etape, setEtape] = useState<'choix' | 'apercu' | 'succes'>('choix')
  const [erreur, setErreur] = useState<string | null>(null)
  const [evenements, setEvenements] = useState<ReturnType<typeof parseIcs>>([])
  const insertMut = useInsertEvenementsEnMasse()
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    setErreur(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.ics')) {
      setErreur("Le fichier doit avoir l'extension .ics")
      return
    }
    try {
      const text = await file.text()
      const evs = parseIcs(text)
      if (evs.length === 0) {
        setErreur('Aucun événement trouvé à partir du 01/01/2026 dans ce fichier.')
        return
      }
      setEvenements(evs)
      setEtape('apercu')
    } catch {
      setErreur("Impossible de lire le fichier. Vérifie qu'il s'agit d'un export .ics valide.")
    }
  }

  async function handleImporter() {
    await insertMut.mutateAsync(evenements)
    setEtape('succes')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        {etape === 'choix' && (
          <>
            <h2 className="text-base font-bold text-epoc-navy mb-2">Importer mon agenda Mailo</h2>
            <p className="text-sm text-gray-600 mb-4">
              Sélectionne un fichier <span className="font-mono text-xs bg-gray-100 px-1 rounded">.ics</span> exporté
              depuis Mailo. Les événements à partir du <strong>1er janvier 2026</strong> seront importés.
            </p>

            <p className="text-xs text-gray-500 mb-4">
              Dans Mailo : <em>Agenda → ⋯ (plus d'options) → Exporter → Exporter en ICS</em>
            </p>

            {erreur && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                {erreur}
              </div>
            )}

            <input ref={inputRef} type="file" accept=".ics" onChange={handleFichier} className="hidden" />
            <div className="flex gap-3">
              <button
                onClick={() => inputRef.current?.click()}
                className="flex-1 bg-epoc-navy text-white py-2 rounded-lg text-sm font-medium hover:bg-epoc-navy/90 transition-colors"
              >
                Choisir un fichier .ics
              </button>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </>
        )}

        {etape === 'apercu' && (
          <>
            <h2 className="text-base font-bold text-epoc-navy mb-2">Aperçu de l'import</h2>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{evenements.length} événement{evenements.length > 1 ? 's' : ''}</strong> trouvé{evenements.length > 1 ? 's' : ''} à partir du 01/01/2026.
            </p>
            <ul className="max-h-48 overflow-y-auto text-sm text-gray-700 space-y-1 mb-4 border border-gray-100 rounded-lg p-3">
              {evenements.slice(0, 50).map((ev, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gray-400 text-xs w-20 flex-shrink-0 mt-0.5">
                    {ev.date_journee ?? (ev.date_debut ? ev.date_debut.slice(0, 10) : '—')}
                  </span>
                  <span className="truncate">{ev.titre}</span>
                </li>
              ))}
              {evenements.length > 50 && (
                <li className="text-gray-400 text-xs">… et {evenements.length - 50} autres</li>
              )}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={handleImporter}
                disabled={insertMut.isPending}
                className="flex-1 bg-epoc-navy text-white py-2 rounded-lg text-sm font-medium hover:bg-epoc-navy/90 disabled:opacity-50"
              >
                {insertMut.isPending ? 'Import en cours…' : `Importer ${evenements.length} événement${evenements.length > 1 ? 's' : ''}`}
              </button>
              <button onClick={() => setEtape('choix')} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Retour
              </button>
            </div>
            {insertMut.isError && (
              <p className="mt-2 text-sm text-red-600">Erreur lors de l'import. Réessaie.</p>
            )}
          </>
        )}

        {etape === 'succes' && (
          <>
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✓</div>
              <h2 className="text-base font-bold text-epoc-navy mb-2">Import réussi·e !</h2>
              <p className="text-sm text-gray-600">
                {evenements.length} événement{evenements.length > 1 ? 's' : ''} importé{evenements.length > 1 ? 's' : ''} dans ton agenda.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-epoc-navy text-white py-2 rounded-lg text-sm font-medium hover:bg-epoc-navy/90"
            >
              Fermer
            </button>
          </>
        )}
      </div>
    </div>
  )
}
