import type { Evenement } from '../types'

// Convertit une date ICS (YYYYMMDDTHHMMSSZ ou YYYYMMDD) en ISO string ou date
function parseIcsDate(val: string): { timestamptz?: string; dateOnly?: string; journeeEntiere: boolean } {
  // Journée entière : YYYYMMDD
  if (/^\d{8}$/.test(val)) {
    const y = val.slice(0, 4)
    const m = val.slice(4, 6)
    const d = val.slice(6, 8)
    return { dateOnly: `${y}-${m}-${d}`, journeeEntiere: true }
  }
  // Date+heure UTC : YYYYMMDDTHHMMSSZ
  if (/^\d{8}T\d{6}Z?$/.test(val)) {
    const y = val.slice(0, 4)
    const mo = val.slice(4, 6)
    const d = val.slice(6, 8)
    const h = val.slice(9, 11)
    const mi = val.slice(11, 13)
    const s = val.slice(13, 15)
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
    return { timestamptz: iso, journeeEntiere: false }
  }
  return { journeeEntiere: false }
}

// Décode les caractères échappés ICS
function decodeIcsText(val: string): string {
  return val
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

// Parse un fichier .ics et retourne les événements à partir du 2026-01-01
export function parseIcs(content: string): Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee' | 'user_id'>[] {
  const seuil = new Date('2026-01-01T00:00:00Z')
  const evenements: Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee' | 'user_id'>[] = []

  // Déplier les lignes repliées (RFC 5545 : continuation avec espace ou tabulation)
  const unfolded = content.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  let inEvent = false
  let current: Record<string, string> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      inEvent = false

      const summary = decodeIcsText(current['SUMMARY'] || '').trim()
      if (!summary) continue

      const dtstart = current['DTSTART'] || current['DTSTART;VALUE=DATE'] || ''
      const dtend   = current['DTEND']   || current['DTEND;VALUE=DATE']   || ''
      const desc    = decodeIcsText(current['DESCRIPTION'] || '').trim() || null

      if (!dtstart) continue

      const start = parseIcsDate(dtstart)
      const end   = dtend ? parseIcsDate(dtend) : start

      // Filtrer avant le 2026-01-01
      const refDate = start.timestamptz
        ? new Date(start.timestamptz)
        : start.dateOnly
        ? new Date(start.dateOnly + 'T00:00:00Z')
        : null

      if (!refDate || refDate < seuil) continue

      evenements.push({
        titre:                summary,
        type:                 'epoc',
        journee_entiere:      start.journeeEntiere,
        date_journee:         start.journeeEntiere ? (start.dateOnly ?? null) : null,
        date_fin_journee:     null,
        date_debut:           start.journeeEntiere ? null : (start.timestamptz ?? null),
        date_fin:             end.journeeEntiere   ? null : (end.timestamptz   ?? null),
        contact_id:           null,
        lieu:                 null,
        note:                 desc,
        source:               'ics_import',
        source_id:            null,
        recurrence_rule:      null,
        recurrence_groupe_id: null,
      })

      continue
    }

    if (inEvent && line.includes(':')) {
      const colonIdx = line.indexOf(':')
      const key = line.slice(0, colonIdx).split(';')[0].toUpperCase()
      const val = line.slice(colonIdx + 1)
      current[key] = val
    }
  }

  return evenements
}
