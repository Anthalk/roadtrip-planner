import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Map from '../components/Map';
import DateRangePicker from '../components/DateRangePicker';

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const mois = [
    'jan',
    'fév',
    'mar',
    'avr',
    'mai',
    'jun',
    'jul',
    'aoû',
    'sep',
    'oct',
    'nov',
    'déc',
  ];
  return `${d} ${mois[parseInt(m) - 1]}`;
}

export default function Voyage({ voyageId, onSelectEtape, onBack }) {
  const [voyage, setVoyage] = useState(null);
  const [etapes, setEtapes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [nom, setNom] = useState('');
  const [nuits, setNuits] = useState('2');
  const [suggestions, setSuggestions] = useState([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [routes, setRoutes] = useState({});
  const timer = { current: null };
  const [hotelSuggestions, setHotelSuggestions] = useState([]);
  const [hotelSugLoading, setHotelSugLoading] = useState(false);
  const [hotelSelected, setHotelSelected] = useState(false);
  const hotelTimer = { current: null };
  const [editNom, setEditNom] = useState('');
  const [editNuits, setEditNuits] = useState('');
  const [editHotelNom, setEditHotelNom] = useState('');
  const [editHotelAdresse, setEditHotelAdresse] = useState('');
  const [editHotelConfirmation, setEditHotelConfirmation] = useState('');
  const [editCheckin, setEditCheckin] = useState('');
  const [editCheckout, setEditCheckout] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const dragStart = useRef(null);

  useEffect(() => {
    fetchData();
  }, [voyageId]);

  const fetchData = async () => {
    const [{ data: v }, { data: e }] = await Promise.all([
      supabase.from('voyages').select('*').eq('id', voyageId).single(),
      supabase
        .from('etapes')
        .select('*, spots(count)')
        .eq('voyage_id', voyageId)
        .order('ordre'),
    ]);
    setVoyage(v);
    setEtapes(e || []);
    setLoading(false);
    if (e?.length > 1) fetchRoutes(e);
  };

  const fetchRoutes = async (etapesList) => {
    for (let i = 1; i < etapesList.length; i++) {
      const prev = etapesList[i - 1];
      const curr = etapesList[i];
      if (!prev.lat || !curr.lat) continue;
      try {
        const { data, error } = await supabase.functions.invoke('routing', {
          body: { from: prev, to: curr },
        });
        if (!error && data) setRoutes((ro) => ({ ...ro, [curr.id]: data }));
      } catch {}
    }
  };

  const searchPlaces = async (q) => {
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    setSugLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { q },
      });
      if (!error) setSuggestions(data || []);
    } catch {}
    setSugLoading(false);
  };

  const searchHotel = async (q) => {
    if (q.length < 3) {
      setHotelSuggestions([]);
      return;
    }
    setHotelSugLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { q: q + ' hotel' },
      });
      if (!error) setHotelSuggestions(data || []);
    } catch {}
    setHotelSugLoading(false);
  };

  const addEtape = async () => {
    if (!nom) return;
    const { error } = await supabase.from('etapes').insert({
      voyage_id: voyageId,
      nom: selected?.name || nom,
      lat: selected?.lat || null,
      lon: selected?.lon || null,
      nuits: parseInt(nuits) || 1,
      ordre: etapes.length,
    });
    if (!error) {
      setNom('');
      setNuits('2');
      setSelected(null);
      setSuggestions([]);
      setModal(false);
      fetchData();
    }
  };

  const openEdit = (e) => {
    setEditModal(e);
    setEditNom(e.nom || '');
    setEditNuits(String(e.nuits || 1));
    setEditHotelNom(e.hotel_nom || '');
    setEditHotelAdresse(e.hotel_adresse || '');
    setEditHotelConfirmation(e.hotel_confirmation || '');
    setEditCheckin(e.hotel_checkin || '');
    setEditCheckout(e.hotel_checkout || '');
    setHotelSuggestions([]);
    setHotelSelected(false);
  };

  const saveEdit = async () => {
    if (!editModal) return;
    await supabase
      .from('etapes')
      .update({
        nom: editNom,
        nuits: parseInt(editNuits) || 1,
        hotel_nom: editHotelNom,
        hotel_adresse: editHotelAdresse,
        hotel_confirmation: editHotelConfirmation,
        hotel_checkin: editCheckin || null,
        hotel_checkout: editCheckout || null,
      })
      .eq('id', editModal.id);
    setEditModal(null);
    fetchData();
  };

  const deleteEtape = async (id, e) => {
    e.stopPropagation();
    await supabase.from('etapes').delete().eq('id', id);
    fetchData();
  };

  const onDragStart = (e) => {
    dragStart.current = e.touches ? e.touches[0].clientY : e.clientY;
  };

  const onDragEnd = (e) => {
    if (dragStart.current === null) return;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const diff = endY - dragStart.current;
    if (diff > 40) setSheetExpanded(false);
    else if (diff < -40) setSheetExpanded(true);
    dragStart.current = null;
  };

  const totalNuits = etapes.reduce((s, e) => s + (e.nuits || 0), 0);

  const SHEET_EXPANDED = '42vh';
  const SHEET_COLLAPSED = '14vh';

  return (
    <div style={s.app}>
      {/* Top bar flottante */}
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={onBack}>
          ←
        </button>
        <div>
          <div style={s.title}>{voyage?.nom}</div>
          <div style={s.sub}>
            {etapes.length} étape{etapes.length !== 1 ? 's' : ''} · {totalNuits}{' '}
            nuits
          </div>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Carte — prend tout l'espace sauf le sheet */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Map etapes={etapes} routes={routes} />
      </div>

      {/* Sheet aimanté en bas, hauteur flex */}
      <div
        style={{
          ...s.sheet,
          height: sheetExpanded ? SHEET_EXPANDED : SHEET_COLLAPSED,
          transition: 'height 0.35s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Handle */}
        <div
          style={s.handleWrap}
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
          onTouchStart={onDragStart}
          onTouchEnd={onDragEnd}
          onClick={() => setSheetExpanded((e) => !e)}
        >
          <div style={s.handle} />
        </div>

        {!sheetExpanded && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <div style={s.miniScroll}>
              {etapes.map((e, i) => {
                const route = routes[e.id];
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {i > 0 && (
                      <div style={s.miniConnector}>
                        <div style={s.miniConnectorLine} />
                        <div style={s.miniConnectorText}>
                          {route
                            ? `${route.distance} · ${route.duration}`
                            : '…'}
                        </div>
                        <div style={s.miniConnectorLine} />
                      </div>
                    )}
                    <div
                      style={s.miniCard}
                      onClick={() => setSheetExpanded(true)}
                    >
                      <div style={s.miniCardName}>{e.nom}</div>
                      <div style={s.miniCardNuits}>{e.nuits}n</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Vue déployée */}
        {sheetExpanded && (
          <>
            <div style={s.sheetHeader}>
              <span style={s.sheetTitle}>Étapes</span>
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                }}
                onClick={() => setSheetExpanded(false)}
              >
                ▾
              </span>
            </div>

            {loading ? (
              <div style={s.empty}>Chargement…</div>
            ) : etapes.length === 0 ? (
              <div style={s.empty}>Ajoute ta première étape</div>
            ) : (
              <div style={s.hscroll}>
                {etapes.map((e, i) => {
                  const prev = etapes[i - 1];
                  const route = routes[e.id];
                  const spotTotal = e.spots?.[0]?.count || 0;
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {i > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              height: 1,
                              width: 10,
                              background: 'rgba(255,255,255,0.15)',
                            }}
                          />
                          <div style={s.routePill}>
                            <div style={s.routePillVal}>
                              {route
                                ? `${route.distance} · ${route.duration}`
                                : '…'}
                            </div>
                            {prev?.lat && e.lat && (
                              <a
                                href={`https://www.google.com/maps/dir/${prev.lat},${prev.lon}/${e.lat},${e.lon}`}
                                target="_blank"
                                rel="noreferrer"
                                style={s.routePillLink}
                                onMouseEnter={(ev) => {
                                  ev.currentTarget.style.background =
                                    'rgba(255,255,255,0.1)';
                                  ev.currentTarget.style.color = 'white';
                                }}
                                onMouseLeave={(ev) => {
                                  ev.currentTarget.style.background = 'none';
                                  ev.currentTarget.style.color =
                                    'rgba(255,255,255,0.6)';
                                }}
                              >
                                ↗ Trajet voiture
                              </a>
                            )}
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                                prev.hotel_adresse || prev.nom
                              )}&destination=${encodeURIComponent(
                                e.hotel_adresse || e.nom
                              )}&travelmode=transit`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ ...s.routePillLink, marginTop: 4 }}
                              onMouseEnter={(ev) => {
                                ev.currentTarget.style.background =
                                  'rgba(255,255,255,0.1)';
                                ev.currentTarget.style.color = 'white';
                              }}
                              onMouseLeave={(ev) => {
                                ev.currentTarget.style.background = 'none';
                                ev.currentTarget.style.color =
                                  'rgba(255,255,255,0.6)';
                              }}
                            >
                              ↗ Trajet Train
                            </a>
                          </div>
                          <div
                            style={{
                              height: 1,
                              width: 10,
                              background: 'rgba(255,255,255,0.15)',
                            }}
                          />
                        </div>
                      )}
                      <div
                        style={{
                          ...s.ecard,
                          backgroundImage: `linear-gradient(to bottom, rgba(10,14,20,0.3) 0%, rgba(10,14,20,0.85) 60%, rgba(10,14,20,0.97) 100%), url(https://source.unsplash.com/200x300/?${encodeURIComponent(
                            e.nom
                          )},japan)`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                        onClick={() => onSelectEtape(e.id)}
                        onMouseEnter={(ev) => {
                          ev.currentTarget.style.transform = 'translateY(-4px)';
                          ev.currentTarget.style.boxShadow =
                            '0 16px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)';
                        }}
                        onMouseLeave={(ev) => {
                          ev.currentTarget.style.transform = 'translateY(0px)';
                          ev.currentTarget.style.boxShadow =
                            '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)';
                        }}
                      >
                        <button
                          style={s.delBtn}
                          onClick={(ev) => deleteEtape(e.id, ev)}
                        >
                          ✕
                        </button>
                        <div style={s.ecardName}>{e.nom}</div>
                        <div style={s.ecardNuits}>
                          {e.nuits} nuit{e.nuits > 1 ? 's' : ''} · {e.nuits + 1}{' '}
                          jour{e.nuits + 1 > 1 ? 's' : ''}
                        </div>
                        <div style={s.ecardSection}>
                          {e.hotel_nom ? (
                            <>
                              <div style={s.ecardHotelNom}>{e.hotel_nom}</div>
                              {e.hotel_adresse && (
                                <div style={s.ecardHotelAddr}>
                                  {e.hotel_adresse}
                                </div>
                              )}
                              {(e.hotel_checkin || e.hotel_checkout) && (
                                <div style={s.ecardHotelDates}>
                                  {e.hotel_checkin && (
                                    <span>
                                      check in {formatDate(e.hotel_checkin)}
                                    </span>
                                  )}
                                  {e.hotel_checkin && e.hotel_checkout && (
                                    <br />
                                  )}
                                  {e.hotel_checkout && (
                                    <span>
                                      check out {formatDate(e.hotel_checkout)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={s.ecardNoHotel}>+ Ajouter un hôtel</div>
                          )}
                        </div>
                        <div style={s.ecardDivider} />
                        <button
                          style={s.editBtn}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEdit(e);
                          }}
                        >
                          Éditer l'étape
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button style={s.fab} onClick={() => setModal(true)}>
        +
      </button>

      {/* Modal ajout étape */}
      {modal && (
        <div
          style={s.overlay}
          onClick={(e) => e.target === e.currentTarget && setModal(false)}
        >
          <div style={s.modal}>
            <div style={s.mhandle} />
            <div style={s.mtitle}>Nouvelle étape</div>
            <div style={s.fg}>
              <label style={s.fl}>Ville</label>
              <input
                value={nom}
                onChange={(e) => {
                  setNom(e.target.value);
                  setSelected(null);
                  clearTimeout(timer.current);
                  timer.current = setTimeout(
                    () => searchPlaces(e.target.value),
                    500
                  );
                }}
                placeholder="Tokyo, Kyoto…"
                autoFocus
                style={{
                  ...s.fi,
                  borderRadius:
                    suggestions.length && !selected ? '12px 12px 0 0' : 12,
                }}
              />
              {sugLoading && (
                <div style={s.acWrap}>
                  <span
                    style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}
                  >
                    Recherche…
                  </span>
                </div>
              )}
              {suggestions.length > 0 && !selected && (
                <div style={s.acList}>
                  {suggestions.map((r, i) => (
                    <div
                      key={i}
                      style={s.acItem}
                      onClick={() => {
                        setSelected(r);
                        setNom(r.name);
                        setSuggestions([]);
                      }}
                    >
                      <div style={s.acName}>{r.name}</div>
                      <div style={s.acAddr}>{r.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.fg}>
              <label style={s.fl}>Nuits</label>
              <input
                style={s.fi}
                type="number"
                min="1"
                value={nuits}
                onChange={(e) => setNuits(e.target.value)}
              />
            </div>
            <button style={s.btnP} onClick={addEtape}>
              Ajouter
            </button>
            <button
              style={s.btnG}
              onClick={() => {
                setModal(false);
                setNom('');
                setSuggestions([]);
                setSelected(null);
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modal édition étape */}
      {editModal && (
        <div
          style={s.overlay}
          onClick={(e) => e.target === e.currentTarget && setEditModal(null)}
        >
          <div style={s.modal}>
            <div style={s.mhandle} />
            <div style={s.mtitle}>{editModal.nom}</div>
            <div style={s.sectionLabel}>Général</div>
            <div style={s.fg}>
              <label style={s.fl}>Nom de la ville</label>
              <input
                style={s.fi}
                value={editNom}
                onChange={(e) => setEditNom(e.target.value)}
              />
            </div>
            <div style={s.fg}>
              <label style={s.fl}>Nuits</label>
              <input
                style={s.fi}
                type="number"
                min="1"
                value={editNuits}
                onChange={(e) => setEditNuits(e.target.value)}
              />
            </div>
            <div style={s.sectionLabel}>Hôtel</div>
            <div style={s.fg}>
              <label style={s.fl}>Nom de l'hôtel</label>
              <input
                value={editHotelNom}
                onChange={(e) => {
                  setEditHotelNom(e.target.value);
                  setHotelSelected(false);
                  clearTimeout(hotelTimer.current);
                  hotelTimer.current = setTimeout(
                    () => searchHotel(e.target.value),
                    500
                  );
                }}
                placeholder="Hyatt Regency Tokyo…"
                style={{
                  ...s.fi,
                  borderRadius:
                    hotelSuggestions.length && !hotelSelected
                      ? '12px 12px 0 0'
                      : 12,
                }}
              />
              {hotelSugLoading && (
                <div style={s.acWrap}>
                  <span
                    style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}
                  >
                    Recherche…
                  </span>
                </div>
              )}
              {hotelSuggestions.length > 0 && !hotelSelected && (
                <div style={s.acList}>
                  {hotelSuggestions.map((r, i) => (
                    <div
                      key={i}
                      style={s.acItem}
                      onClick={() => {
                        setEditHotelNom(r.name);
                        setEditHotelAdresse(r.address);
                        setHotelSelected(true);
                        setHotelSuggestions([]);
                      }}
                    >
                      <div style={s.acName}>{r.name}</div>
                      <div style={s.acAddr}>{r.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.fg}>
              <label style={s.fl}>Adresse</label>
              <input
                style={s.fi}
                value={editHotelAdresse}
                onChange={(e) => setEditHotelAdresse(e.target.value)}
                placeholder="2-7-2 Nishi-Shinjuku…"
              />
            </div>
            <div style={s.fg}>
              <label style={s.fl}>N° de confirmation</label>
              <input
                style={s.fi}
                value={editHotelConfirmation}
                onChange={(e) => setEditHotelConfirmation(e.target.value)}
                placeholder="CONF-123456"
              />
            </div>
            <DateRangePicker
              checkin={editCheckin}
              checkout={editCheckout}
              onChange={(ci, co) => {
                setEditCheckin(ci);
                setEditCheckout(co);
              }}
            />
            <button style={s.btnP} onClick={saveEdit}>
              Enregistrer
            </button>
            <button style={s.btnG} onClick={() => setEditModal(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  app: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#0D1117',
  },
  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: '16px 20px 0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    pointerEvents: 'none',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'white',
    cursor: 'pointer',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    pointerEvents: 'all',
  },
  title: {
    fontFamily: 'Georgia,serif',
    fontSize: 22,
    color: 'white',
    textShadow: '0 2px 16px rgba(0,0,0,0.6)',
  },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  sheet: {
    background: 'rgba(10,14,20,0.95)',
    backdropFilter: 'blur(24px)',
    borderRadius: '22px 22px 0 0',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
  },

  handleWrap: { padding: '10px 0 4px', cursor: 'grab', userSelect: 'none' },
  handle: {
    width: 36,
    height: 4,
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    margin: '0 auto',
  },
  sheetHeader: {
    padding: '4px 20px 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: 'Georgia,serif',
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },
  hscroll: {
    overflowX: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '10px 20px 20px',
    scrollbarWidth: 'none',
  },
  miniScroll: {
    overflowX: 'auto',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    scrollbarWidth: 'none',
    gap: 0,
    maxWidth: '100%',
  },
  miniCard: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '5px 10px',
    flexShrink: 0,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  miniCardName: {
    fontSize: 11,
    color: 'white',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  miniCardNuits: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    whiteSpace: 'nowrap',
  },
  miniConnector: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 4px',
    flexShrink: 0,
  },
  miniConnectorLine: {
    height: 1,
    width: 16,
    background: 'rgba(255,255,255,0.15)',
  },
  miniConnectorText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    whiteSpace: 'nowrap',
    padding: '2px 0',
  },
  ecard: {
    background: 'rgba(255,255,255,0.055)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: '14px 16px',
    width: 200,
    cursor: 'pointer',
    flexShrink: 0,
    position: 'relative',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  ecardName: {
    fontFamily: 'Georgia,serif',
    fontSize: 17,
    color: 'white',
    marginBottom: 4,
    paddingRight: 20,
  },
  ecardNuits: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  ecardSection: { marginBottom: 10 },
  ecardHotelNom: {
    fontSize: 12,
    color: 'white',
    fontWeight: 500,
    marginBottom: 2,
  },
  ecardHotelAddr: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ecardHotelDates: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  ecardNoHotel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    fontStyle: 'italic',
  },
  ecardDivider: {
    height: 1,
    background: 'rgba(255,255,255,0.07)',
    margin: '8px 0',
  },
  editBtn: {
    display: 'block',
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: 11,
    padding: '5px 0',
    fontFamily: 'inherit',
    textAlign: 'center',
    marginTop: 4,
  },
  routePill: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: '5px 12px',
    flexShrink: 0,
  },
  routePillVal: {
    fontSize: 11,
    color: 'white',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  routePillLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textDecoration: 'none',
    marginTop: 3,
    whiteSpace: 'nowrap',
    padding: '3px 8px',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.12)',
    transition: 'all 0.15s',
  },
  delBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.2)',
    cursor: 'pointer',
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    padding: '20px',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    zIndex: 20,
    bottom: 16,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: '50%',
    background: 'white',
    color: '#0D1117',
    border: 'none',
    cursor: 'pointer',
    fontSize: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    alignItems: 'flex-end',
  },
  modal: {
    background: '#12171F',
    borderRadius: '24px 24px 0 0',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '0 20px 44px',
    width: '100%',
    maxHeight: '88vh',
    overflowY: 'auto',
  },
  mhandle: {
    width: 36,
    height: 4,
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    margin: '14px auto 22px',
  },
  mtitle: {
    fontFamily: 'Georgia,serif',
    fontSize: 21,
    color: 'white',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
    marginTop: 8,
  },
  fg: { marginBottom: 12 },
  fl: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
    display: 'block',
  },
  fi: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 12,
    color: 'white',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  acWrap: {
    padding: '10px 14px',
    background: '#181E28',
    border: '1px solid rgba(255,255,255,0.09)',
    borderTop: 'none',
    borderRadius: '0 0 12px 12px',
  },
  acList: {
    background: '#181E28',
    border: '1px solid rgba(255,255,255,0.09)',
    borderTop: 'none',
    borderRadius: '0 0 12px 12px',
    overflow: 'hidden',
  },
  acItem: {
    padding: '11px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  acName: { fontSize: 14, fontWeight: 500, color: 'white' },
  acAddr: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  btnP: {
    width: '100%',
    padding: 14,
    background: 'white',
    color: '#0D1117',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  btnG: {
    width: '100%',
    padding: 12,
    background: 'none',
    color: 'rgba(255,255,255,0.35)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 12,
    fontSize: 14,
    cursor: 'pointer',
    marginTop: 8,
  },
};
