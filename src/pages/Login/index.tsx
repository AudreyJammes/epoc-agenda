import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur]     = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setErreur('Email ou mot de passe incorrect.')
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-epoc-navy to-epoc-violet flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo EPOC */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-epoc-navy text-white text-2xl font-black mb-3">
            E
          </div>
          <h1 className="text-xl font-bold text-epoc-navy">Agenda EPOC</h1>
          <p className="text-sm text-gray-500 mt-1">École Populaire de la Citoyenneté</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
              placeholder="ton@email.fr"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-epoc-navy/30"
              placeholder="••••••••"
            />
          </div>

          {erreur && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {erreur}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-epoc-navy text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-epoc-navy/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
