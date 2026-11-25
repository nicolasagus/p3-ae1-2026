import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { createTripRating, FlowError, getTripRating, type TripRating } from '../rideFlowApi'

const STAR_LABELS: Record<number, string> = {
  1: 'Muy malo',
  2: 'Malo',
  3: 'Regular',
  4: 'Bueno',
  5: 'Excelente',
}

interface TripRatingCardProps {
  tripId: string
  token: string
  initialRating?: TripRating | null
  compact?: boolean
  onRated?: (rating: TripRating) => void
}

export default function TripRatingCard({
  tripId,
  token,
  initialRating,
  compact = false,
  onRated,
}: TripRatingCardProps) {
  const [rating, setRating] = useState<TripRating | null>(initialRating ?? null)
  const [loadingInitial, setLoadingInitial] = useState(initialRating === undefined)
  const [expanded, setExpanded] = useState(!compact)
  const [score, setScore] = useState(5)
  const [hoverScore, setHoverScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialRating !== undefined) {
      setRating(initialRating)
      setLoadingInitial(false)
      return
    }
    const abort = new AbortController()
    setLoadingInitial(true)
    getTripRating(tripId, token, abort.signal)
      .then((found) => {
        if (!abort.signal.aborted) {
          setRating(found)
          if (found && onRated) onRated(found)
        }
      })
      .catch(() => {
        // Si M2 no responde al consultar inicialmente, se permite intentar calificar igual
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoadingInitial(false)
      })
    return () => abort.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, token, initialRating])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const trimmed = comment.trim()
      const created = await createTripRating(
        {
          viajeId: tripId,
          puntuacion: score,
          ...(trimmed ? { comentario: trimmed } : {}),
        },
        token,
      )
      setRating(created)
      setExpanded(false)
      if (onRated) onRated(created)
    } catch (err) {
      if (err instanceof FlowError && err.status === 409) {
        const existing = await getTripRating(tripId, token).catch(() => null)
        if (existing) {
          setRating(existing)
          setExpanded(false)
          if (onRated) onRated(existing)
          return
        }
      }
      setError(err instanceof Error ? err.message : 'No se pudo registrar la calificación.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingInitial) {
    return <p className="ride-muted text-xs mt-2">Consultando calificación en M2…</p>
  }

  // Si ya está calificado, mostramos las estrellas y el comentario guardado
  if (rating) {
    return (
      <div
        className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 text-sm w-full"
        aria-label="Calificación registrada del viaje"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            ✓ Viaje calificado (M2 · RF-2.4)
          </span>
          <div className="inline-flex items-center gap-1" aria-label={`${rating.puntuacion} de 5 estrellas`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={15}
                className={n <= rating.puntuacion ? 'text-[var(--accent)] fill-[var(--accent)]' : 'text-[var(--text-dim)]'}
              />
            ))}
            <span className="ml-1.5 text-xs font-semibold text-[var(--text-soft)]">
              {rating.puntuacion}/5 · {STAR_LABELS[rating.puntuacion]}
            </span>
          </div>
        </div>
        {rating.comentario && (
          <p className="mt-2 text-xs italic text-[var(--text-soft)] break-words">“{rating.comentario}”</p>
        )}
      </div>
    )
  }

  // Modo compacto para la lista de historial: botón para desplegar el formulario
  if (compact && !expanded) {
    return (
      <button
        type="button"
        className="btn-ghost inline-flex items-center gap-1.5"
        onClick={() => {
          setError('')
          setExpanded(true)
        }}
      >
        <Star size={15} className="text-[var(--accent)]" aria-hidden="true" />
        Calificar conductor
      </button>
    )
  }

  const activeStar = hoverScore ?? score

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] p-4 grid gap-3 text-sm"
      aria-label="Calificar al conductor"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[var(--text)]">Calificá a tu conductor (RF-2.4)</span>
        {compact && (
          <button
            type="button"
            className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
            disabled={submitting}
            onClick={() => setExpanded(false)}
          >
            Cancelar
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Puntuación en estrellas">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= activeStar
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
              disabled={submitting}
              onMouseEnter={() => setHoverScore(n)}
              onMouseLeave={() => setHoverScore(null)}
              onClick={() => setScore(n)}
              className="p-1.5 rounded-lg border border-[var(--line)] hover:border-[var(--accent)] transition-colors cursor-pointer"
            >
              <Star
                size={20}
                className={filled ? 'text-[var(--accent)] fill-[var(--accent)]' : 'text-[var(--text-dim)]'}
              />
            </button>
          )
        })}
        <span className="ml-1 text-xs font-semibold text-[var(--text-soft)]">
          {score}/5 · {STAR_LABELS[activeStar]}
        </span>
      </div>

      <label className="grid gap-1 text-xs text-[var(--text-soft)]">
        <span>Comentario opcional (máx. 500 caracteres)</span>
        <textarea
          rows={2}
          maxLength={500}
          disabled={submitting}
          placeholder="¿Cómo fue tu experiencia durante el viaje?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="input-field !py-2 !px-3 text-sm"
        />
        <span className="text-right text-[11px] text-[var(--text-dim)]">{comment.length}/500</span>
      </label>

      {error && (
        <p className="alert-error text-xs" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={submitting} className="btn-primary !w-auto !py-2 !px-5 text-sm">
          {submitting ? 'Enviando…' : 'Enviar calificación'}
        </button>
      </div>
    </form>
  )
}
