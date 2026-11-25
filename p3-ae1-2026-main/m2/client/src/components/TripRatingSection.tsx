import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Calificacion, CustomerTripsResponse, TripSummary } from '../types';
import { formatDate } from '../utils';

interface TripRatingSectionProps {
  tripsData: CustomerTripsResponse | null;
  selectedTripId?: string;
  onClearSelectedTrip?: () => void;
}

const ETIQUETAS_ESTRELLAS: Record<number, string> = {
  1: 'Muy malo',
  2: 'Malo',
  3: 'Regular',
  4: 'Bueno',
  5: 'Excelente',
};

export function StarDisplay({ score }: { score: number }) {
  return (
    <span className="star-display" aria-label={`${score} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= score ? 'star-filled' : 'star-empty'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function TripRatingSection({
  tripsData,
  selectedTripId,
  onClearSelectedTrip,
}: TripRatingSectionProps) {
  // Formulario de creación (POST /calificaciones)
  const [viajeId, setViajeId] = useState(selectedTripId ?? '');
  const [puntuacion, setPuntuacion] = useState<number>(5);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdRating, setCreatedRating] = useState<Calificacion | null>(null);

  // Consulta por ID de viaje (GET /calificaciones/viaje/:viajeId)
  const [searchTripId, setSearchTripId] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchedRating, setSearchedRating] = useState<Calificacion | null>(null);
  const [notFoundMsg, setNotFoundMsg] = useState('');

  // Mapa de calificaciones ya registradas para los viajes listados
  const [ratingsByTrip, setRatingsByTrip] = useState<Record<string, Calificacion>>({});

  useEffect(() => {
    if (selectedTripId) {
      setViajeId(selectedTripId);
      setSubmitError('');
      setCreatedRating(null);
    }
  }, [selectedTripId]);

  // Al tener viajes del historial, precargar cuáles ya tienen calificación
  useEffect(() => {
    if (!tripsData || tripsData.degraded || tripsData.trips.length === 0) return;
    let active = true;
    Promise.all(
      tripsData.trips.map(async (t) => {
        try {
          const cal = await api.obtenerCalificacionPorViaje(t.tripId);
          return cal ? ([t.tripId, cal] as const) : null;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (!active) return;
      const map: Record<string, Calificacion> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }
      setRatingsByTrip((prev) => ({ ...prev, ...map }));
    });
    return () => {
      active = false;
    };
  }, [tripsData]);

  const completedTrips: TripSummary[] =
    tripsData && !tripsData.degraded
      ? tripsData.trips.filter((t) => t.status.toUpperCase() === 'COMPLETADO')
      : [];

  async function handleCrearCalificacion(e: React.FormEvent) {
    e.preventDefault();
    const idTrimmed = viajeId.trim();
    if (!idTrimmed) {
      setSubmitError('Ingresá o seleccioná el ID del viaje a calificar.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setCreatedRating(null);

    try {
      const nueva = await api.crearCalificacion({
        viajeId: idTrimmed,
        puntuacion,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      });
      setCreatedRating(nueva);
      setRatingsByTrip((prev) => ({ ...prev, [nueva.viajeId]: nueva }));
      setComentario('');
      if (onClearSelectedTrip) onClearSelectedTrip();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al registrar la calificación');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConsultarCalificacion(e: React.FormEvent) {
    e.preventDefault();
    const idTrimmed = searchTripId.trim();
    if (!idTrimmed) return;

    setSearching(true);
    setSearchError('');
    setSearchedRating(null);
    setNotFoundMsg('');

    try {
      const cal = await api.obtenerCalificacionPorViaje(idTrimmed);
      if (!cal) {
        setNotFoundMsg(`No se encontró calificación para el viaje "${idTrimmed}".`);
      } else {
        setSearchedRating(cal);
        setRatingsByTrip((prev) => ({ ...prev, [cal.viajeId]: cal }));
      }
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Error al consultar la calificación');
    } finally {
      setSearching(false);
    }
  }

  function seleccionarViajeRapido(id: string) {
    setViajeId(id);
    setSubmitError('');
    setCreatedRating(null);
  }

  const activeStar = hoverStar ?? puntuacion;

  return (
    <div className="stack" style={{ gap: '24px' }}>
      <div className="grid-2">
        {/* Tarjeta 1: Calificar un viaje completado */}
        <div className="card">
          <h2 className="section-title">Calificar viaje (RF-2.4)</h2>
          <p className="muted" style={{ fontSize: '0.82rem', marginBottom: '16px' }}>
            Calificá al conductor de un viaje completado con una puntuación de 1 a 5 estrellas y un comentario opcional.
          </p>

          <form onSubmit={handleCrearCalificacion} className="stack">
            <div className="field">
              <label htmlFor="rating-viaje-id">ID del viaje</label>
              <input
                id="rating-viaje-id"
                type="text"
                placeholder="Ej. viaje-completado-1"
                value={viajeId}
                onChange={(e) => {
                  setViajeId(e.target.value);
                  setSubmitError('');
                  setCreatedRating(null);
                }}
              />
            </div>

            {/* Atajos rápidos: viajes del historial o del simulador M6 */}
            <div className="rating-shortcuts">
              <span className="eyebrow" style={{ fontSize: '0.65rem' }}>Selección rápida:</span>
              <div className="shortcut-chips">
                <button
                  type="button"
                  className={`chip${viajeId === 'viaje-completado-1' ? ' chip-active' : ''}`}
                  onClick={() => seleccionarViajeRapido('viaje-completado-1')}
                >
                  viaje-completado-1 (Simulador)
                </button>
                {completedTrips.map((t) => (
                  <button
                    key={t.tripId}
                    type="button"
                    className={`chip${viajeId === t.tripId ? ' chip-active' : ''}`}
                    onClick={() => seleccionarViajeRapido(t.tripId)}
                  >
                    {t.tripId} {ratingsByTrip[t.tripId] ? '★' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span>Puntuación</span>
              <div className="star-picker" role="radiogroup" aria-label="Puntuación en estrellas">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={puntuacion === star}
                    aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                    className={`star-btn${star <= activeStar ? ' active' : ''}`}
                    onMouseEnter={() => setHoverStar(star)}
                    onMouseLeave={() => setHoverStar(null)}
                    onClick={() => setPuntuacion(star)}
                  >
                    ★
                  </button>
                ))}
                <span className="star-label">
                  {puntuacion}/5 · {ETIQUETAS_ESTRELLAS[activeStar]}
                </span>
              </div>
            </div>

            <label className="field">
              <span>
                Comentario <span className="muted">(opcional, máx. 500 caracteres)</span>
              </span>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="¿Cómo fue tu experiencia con el conductor?"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
              <span className="char-counter">{comentario.length}/500</span>
            </label>

            {submitError && <p className="error-msg">{submitError}</p>}

            {createdRating && (
              <div className="rating-result-box rating-success-box">
                <div className="rating-result-header">
                  <span className="success-msg">✓ Calificación registrada exitosamente</span>
                  <StarDisplay score={createdRating.puntuacion} />
                </div>
                <dl className="kv" style={{ marginTop: '10px' }}>
                  <dt>Viaje</dt>
                  <dd><code>{createdRating.viajeId}</code></dd>
                  <dt>Conductor</dt>
                  <dd><code>{createdRating.conductorId}</code></dd>
                  {createdRating.comentario && (
                    <>
                      <dt>Comentario</dt>
                      <dd>{createdRating.comentario}</dd>
                    </>
                  )}
                  <dt>Fecha</dt>
                  <dd>{formatDate(createdRating.createdAt)}</dd>
                </dl>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !viajeId.trim()}
              className="btn-primary"
              style={{ alignSelf: 'flex-start' }}
            >
              {submitting ? 'Enviando…' : 'Enviar calificación'}
            </button>
          </form>
        </div>

        {/* Tarjeta 2: Consultar calificación de un viaje */}
        <div className="card">
          <h2 className="section-title">Consultar calificación por viaje</h2>
          <p className="muted" style={{ fontSize: '0.82rem', marginBottom: '16px' }}>
            Buscá la calificación asignada a un viaje por su identificador.
          </p>

          <form onSubmit={handleConsultarCalificacion} className="stack">
            <div className="field">
              <label htmlFor="search-viaje-id">ID del viaje</label>
              <div className="search-row">
                <input
                  id="search-viaje-id"
                  type="text"
                  placeholder="Ej. viaje-completado-1"
                  value={searchTripId}
                  onChange={(e) => {
                    setSearchTripId(e.target.value);
                    setSearchError('');
                    setNotFoundMsg('');
                  }}
                />
                <button
                  type="submit"
                  disabled={searching || !searchTripId.trim()}
                  className="btn-secondary"
                >
                  {searching ? 'Buscando…' : 'Consultar'}
                </button>
              </div>
            </div>

            {searchError && <p className="error-msg">{searchError}</p>}
            {notFoundMsg && <p className="muted" style={{ fontSize: '0.85rem' }}>{notFoundMsg}</p>}

            {searchedRating && (
              <div className="rating-result-box">
                <div className="rating-result-header">
                  <strong>Calificación del viaje</strong>
                  <StarDisplay score={searchedRating.puntuacion} />
                </div>
                <dl className="kv" style={{ marginTop: '12px' }}>
                  <dt>ID Calificación</dt>
                  <dd><code>{searchedRating.id}</code></dd>
                  <dt>Viaje ID</dt>
                  <dd><code>{searchedRating.viajeId}</code></dd>
                  <dt>Conductor ID</dt>
                  <dd><code>{searchedRating.conductorId}</code></dd>
                  <dt>Puntuación</dt>
                  <dd>{searchedRating.puntuacion} / 5 ({ETIQUETAS_ESTRELLAS[searchedRating.puntuacion]})</dd>
                  <dt>Comentario</dt>
                  <dd>{searchedRating.comentario || <span className="muted">Sin comentario</span>}</dd>
                  <dt>Registrada</dt>
                  <dd>{formatDate(searchedRating.createdAt)}</dd>
                </dl>
              </div>
            )}
          </form>

          {/* Resumen de calificaciones de viajes conocidos en esta sesión */}
          {Object.keys(ratingsByTrip).length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 className="section-title" style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                Viajes calificados
              </h3>
              <div className="rated-mini-list">
                {Object.values(ratingsByTrip).map((cal) => (
                  <div key={cal.id} className="rated-mini-item">
                    <div>
                      <code>{cal.viajeId}</code>
                      {cal.comentario && (
                        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                          “{cal.comentario}”
                        </p>
                      )}
                    </div>
                    <StarDisplay score={cal.puntuacion} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
