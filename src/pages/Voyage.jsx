import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Map from '../components/Map';
import DateRangePicker from '../components/DateRangePicker';
import EquipageModal from '../components/EquipageModal';

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const mois = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
  return `${d} ${mois[parseInt(m) - 1]}`;
}

export default function Voyage({ voyageId, onSelectEtape, onBack, session }) {
  const [voyage, setVoyage] = useState(null);
  const [etapes, setEtapes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [equipageOpen, setEquipageOpen] = useState(false);

  // Ajout étape
  const [nom, setNom] = useState('');
  const [nuits, setNuits] = useState('2');
  const [suggestions, setSuggestions] = useState([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [routes, setRoutes] = useState({});
  const timer = useRef(null);

  // Edit modal
  const [editLieuNom, setEditLieuNom] = useState('');
  const [editLieuSelected, setEditLieuSelected] = useState(null);
  const [editLieuSuggestions, setEditLieuSuggestions] = useState([]);
  const [editLieuLoading, setEditLieuLoading] = useState(false);
  const editLieuTimer = useRef(null);
  const [editNuits, setEditNuits] = useState('');
  const [editHotelNom, setEditHotelNom] = useState('');
  const [editHotelAdresse, setEditHotelAdresse] = useState('');
  const [editHotelConfirmation, setEditHotelConfirmation] = useState('');
  const [editCheckin, setEditCheckin] = useState('');
  const [editCheckout, setEditCheckout] = useState('');
  const [hotelSuggestions, setHotelSuggestions] = useState([]);
  const [hotelSugLoading, setHotelSugLoading] = useState(false);
  const [hotelSelected, setHotelSelected] = useState(false);
  const hotelTimer = useRef(null);

  // Sheet
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const sheetDragStart = useRef(null);

  // Mode réorganisation
  const [reorgMode, setReorgMode] = useState(false);
  const [reorgEtapes, setReorgEtapes] = useState([]);

  // Drag state
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 }); // position fixed de la carte fantôme
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // offset doigt/coin carte
  const cardRefs = useRef([]);
  const reorgScrollRef = useRef(null);
  const autoScrollRef = useRef(null);

  useEffect(() => { fetchData(); }, [voyageId]);
  useEffect(() => {
    const container = reorgScrollRef.current;
    if (!container) return;
    const handler = (ev) => {
      if (dragIdx !== null) ev.preventDefault();
    };
    container.addEventListener('touchmove', handler, { passive: false });
    return () => container.removeEventListener('touchmove', handler);
  }, [dragIdx]);
  const fetchData = async () => {
    const [{ data: v }, { data: e }] = await Promise.all([
      supabase.from('voyages').select('*').eq('id', voyageId).single(),
      supabase.from('etapes').select('*, spots(count)').eq('voyage_id', voyageId).order('ordre'),
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
        const { data, error } = await supabase.functions.invoke('routing', { body: { from: prev, to: curr } });
        if (!error && data) setRoutes(ro => ({ ...ro, [curr.id]: data }));
      } catch {}
    }
  };

  const searchPlaces = async (q) => {
    if (q.length < 3) { setSuggestions([]); return; }
    setSugLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode', { body: { q } });
      if (!error) setSuggestions(data || []);
    } catch {}
    setSugLoading(false);
  };

  const searchEditLieu = async (q) => {
    if (q.length < 3) { setEditLieuSuggestions([]); return; }
    setEditLieuLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode', { body: { q } });
      if (!error) setEditLieuSuggestions(data || []);
    } catch {}
    setEditLieuLoading(false);
  };

  const searchHotel = async (q) => {
    if (q.length < 3) { setHotelSuggestions([]); return; }
    setHotelSugLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode', { body: { q: q + ' hotel' } });
      if (!error) setHotelSuggestions(data || []);
    } catch {}
    setHotelSugLoading(false);
  };

  const addEtape = async () => {
    if (!nom) return;
    await supabase.from('etapes').insert({
      voyage_id: voyageId,
      nom: selected?.name || nom,
      lat: selected?.lat || null,
      lon: selected?.lon || null,
      nuits: parseInt(nuits) || 1,
      ordre: etapes.length,
    });
    setNom(''); setNuits('2'); setSelected(null); setSuggestions([]); setModal(false);
    fetchData();
  };

  const openEdit = (e) => {
    setEditModal(e);
    setEditLieuNom(e.nom || '');
    setEditLieuSelected(null);
    setEditLieuSuggestions([]);
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
    await supabase.from('etapes').update({
      nom: editLieuSelected?.name || editLieuNom,
      lat: editLieuSelected?.lat ?? editModal.lat,
      lon: editLieuSelected?.lon ?? editModal.lon,
      nuits: parseInt(editNuits) || 1,
      hotel_nom: editHotelNom,
      hotel_adresse: editHotelAdresse,
      hotel_confirmation: editHotelConfirmation,
      hotel_checkin: editCheckin || null,
      hotel_checkout: editCheckout || null,
    }).eq('id', editModal.id);
    setEditModal(null);
    fetchData();
  };

  const deleteEtape = async (id, e) => {
    e.stopPropagation();
    await supabase.from('etapes').delete().eq('id', id);
    fetchData();
  };

  // --- Mode réorganisation ---
  const enterReorg = () => {
    setReorgEtapes([...etapes]);
    setReorgMode(true);
    setSheetExpanded(true);
  };

  const cancelReorg = () => {
    setReorgMode(false);
    setDragIdx(null);
    setDropIdx(null);
  };

  const saveReorg = async () => {
    await Promise.all(reorgEtapes.map((e, i) =>
      supabase.from('etapes').update({ ordre: i }).eq('id', e.id)
    ));
    setEtapes(reorgEtapes);
    setReorgMode(false);
    setDragIdx(null);
    setDropIdx(null);
    fetchRoutes(reorgEtapes);
  };

  // --- Drag handlers ---
  const onCardTouchStart = (i, ev) => {
    const touch = ev.touches[0];
    const card = cardRefs.current[i];
    if (!card) return;
    const rect = card.getBoundingClientRect();

    setDragIdx(i);
    setDropIdx(i);
    setDragOffset({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
    setDragPos({ x: rect.left, y: rect.top });

    if (navigator.vibrate) navigator.vibrate(30);
  };

  const onContainerTouchMove = (ev) => {
    if (dragIdx === null) return;
    const touch = ev.touches[0];

    // Mettre à jour position de la carte fantôme
    setDragPos({
      x: touch.clientX - dragOffset.x,
      y: touch.clientY - dragOffset.y,
    });
// Auto-scroll
const container = reorgScrollRef.current;
if (container) {
  const containerRect = container.getBoundingClientRect();
  const edgeSize = 140;
  clearInterval(autoScrollRef.current);
  if (touch.clientX < containerRect.left + edgeSize) {
    const speed = Math.round((containerRect.left + edgeSize - touch.clientX) / 4);
    autoScrollRef.current = setInterval(() => { container.scrollLeft -= speed; }, 16);
  } else if (touch.clientX > containerRect.right - edgeSize) {
    const speed = Math.round((touch.clientX - (containerRect.right - edgeSize)) / 4);
    autoScrollRef.current = setInterval(() => { container.scrollLeft += speed; }, 16);
  }
}
    // Trouver la cible en dessous
    let newDrop = dropIdx;
    cardRefs.current.forEach((card, idx) => {
      if (!card || idx === dragIdx) return;
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      if (touch.clientX > centerX - rect.width / 2 && touch.clientX <= centerX + rect.width / 2) {
        newDrop = idx;
      }
    });
    if (newDrop !== dropIdx) setDropIdx(newDrop);
  };

  const onContainerTouchEnd = () => {
    clearInterval(autoScrollRef.current);
    if (dragIdx === null) return;

    if (dropIdx !== null && dropIdx !== dragIdx) {
      const newArr = [...reorgEtapes];
      const [moved] = newArr.splice(dragIdx, 1);
      newArr.splice(dropIdx, 0, moved);
      setReorgEtapes(newArr);
    }

    setDragIdx(null);
    setDropIdx(null);
  };

  // Sheet drag (pour expand/collapse)
  const onSheetDragStart = (e) => { sheetDragStart.current = e.touches ? e.touches[0].clientY : e.clientY; };
  const onSheetDragEnd = (e) => {
    if (sheetDragStart.current === null) return;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const diff = endY - sheetDragStart.current;
    if (diff > 40) setSheetExpanded(false);
    else if (diff < -40) setSheetExpanded(true);
    sheetDragStart.current = null;
  };

  const totalNuits = etapes.reduce((s, e) => s + (e.nuits || 0), 0);
  const SHEET_EXPANDED = reorgMode ? '52vh' : '42vh';
  const SHEET_COLLAPSED = '14vh';

  // Carte fantôme pendant le drag
  const draggedEtape = dragIdx !== null ? reorgEtapes[dragIdx] : null;

  return (
    <div style={s.app}>
      {/* Top bar */}
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div style={s.title}>{voyage?.nom}</div>
          <div style={s.sub}>{etapes.length} étape{etapes.length !== 1 ? 's' : ''} · {totalNuits} nuits</div>
        </div>
      </div>

      {/* Carte */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Map etapes={reorgMode ? reorgEtapes : etapes} routes={reorgMode ? {} : routes} />
      </div>

      {/* Carte fantôme pendant le drag */}
      {dragIdx !== null && draggedEtape && (
        <div style={{
          position: 'fixed',
          left: dragPos.x,
          top: dragPos.y,
          width: 110,
          zIndex: 999,
          pointerEvents: 'none',
          borderRadius: 14,
          padding: '12px 10px',
          background: 'rgba(255,255,255,0.18)',
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          transform: 'scale(1.08) rotate(2deg)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
          <div style={{ fontSize: 14, fontFamily: 'Georgia,serif', color: 'white', textAlign: 'center', lineHeight: 1.2 }}>{draggedEtape.nom}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{draggedEtape.nuits} nuit{draggedEtape.nuits > 1 ? 's' : ''}</div>
        </div>
      )}

      {/* Sheet */}
      <div style={{ ...s.sheet, height: sheetExpanded ? SHEET_EXPANDED : SHEET_COLLAPSED, transition: 'height 0.35s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={s.handleWrap} onMouseDown={onSheetDragStart} onMouseUp={onSheetDragEnd} onTouchStart={onSheetDragStart} onTouchEnd={onSheetDragEnd} onClick={() => !reorgMode && setSheetExpanded(e => !e)}>
          <div style={s.handle} />
        </div>

        {/* Vue réduite */}
        {!sheetExpanded && !reorgMode && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: '100%' }}>
            <div style={s.miniScroll}>
              {etapes.map((e, i) => {
                const route = routes[e.id];
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {i > 0 && (
                      <div style={s.miniConnector}>
                        <div style={s.miniConnectorLine} />
                        <div style={s.miniConnectorText}>{route ? `${route.distance} · ${route.duration}` : '…'}</div>
                        <div style={s.miniConnectorLine} />
                      </div>
                    )}
                    <div style={s.miniCard} onClick={() => setSheetExpanded(true)}>
                      <div style={s.miniCardName}>{e.nom}</div>
                      <div style={s.miniCardNuits}>{e.nuits}n</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vue normale */}
        {sheetExpanded && !reorgMode && (
          <>
            <div style={s.sheetHeader}>
              <span style={s.sheetTitle}>Étapes</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {etapes.length > 1 && (
                  <button style={s.reorgBtn} onClick={enterReorg}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                    Réorganiser
                  </button>
                )}
                <button style={s.equipageBtn} onClick={() => setEquipageOpen(true)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    <path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
                  </svg>
                  Équipage
                </button>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }} onClick={() => setSheetExpanded(false)}>▾</span>
              </div>
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
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      {i > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ height: 1, width: 10, background: 'rgba(255,255,255,0.15)' }} />
                          <div style={s.routePill}>
                            <div style={s.routePillVal}>{route ? `${route.distance} · ${route.duration}` : '…'}</div>
                            {prev?.lat && e.lat && (
                              <a href={`https://www.google.com/maps/dir/${prev.lat},${prev.lon}/${e.lat},${e.lon}`} target="_blank" rel="noreferrer" style={s.routePillLink}
                                onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.color = 'white'; }}
                                onMouseLeave={ev => { ev.currentTarget.style.background = 'none'; ev.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
                                ↗ Voiture
                              </a>
                            )}
                            <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(prev.hotel_adresse || prev.nom)}&destination=${encodeURIComponent(e.hotel_adresse || e.nom)}&travelmode=transit`} target="_blank" rel="noreferrer" style={{ ...s.routePillLink, marginTop: 4 }}
                              onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.1)'; ev.currentTarget.style.color = 'white'; }}
                              onMouseLeave={ev => { ev.currentTarget.style.background = 'none'; ev.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
                              ↗ Train
                            </a>
                          </div>
                          <div style={{ height: 1, width: 10, background: 'rgba(255,255,255,0.15)' }} />
                        </div>
                      )}
                      <div
                        style={{ ...s.ecard, backgroundImage: `linear-gradient(to bottom, rgba(10,14,20,0.3) 0%, rgba(10,14,20,0.85) 60%, rgba(10,14,20,0.97) 100%), url(https://source.unsplash.com/200x300/?${encodeURIComponent(e.nom)},japan)`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                        onClick={() => onSelectEtape(e.id)}
                        onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-4px)'; ev.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.5)'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.transform = 'translateY(0px)'; ev.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'; }}
                      >
                        <button style={s.delBtn} onClick={ev => deleteEtape(e.id, ev)}>✕</button>
                        <div style={s.ecardName}>{e.nom}</div>
                        <div style={s.ecardNuits}>{e.nuits} nuit{e.nuits > 1 ? 's' : ''} · {e.nuits + 1} jour{e.nuits + 1 > 1 ? 's' : ''}</div>
                        <div style={s.ecardSection}>
                          {e.hotel_nom ? (
                            <>
                              <div style={s.ecardHotelNom}>{e.hotel_nom}</div>
                              {e.hotel_adresse && <div style={s.ecardHotelAddr}>{e.hotel_adresse}</div>}
                              {(e.hotel_checkin || e.hotel_checkout) && (
                                <div style={s.ecardHotelDates}>
                                  {e.hotel_checkin && <span>check in {formatDate(e.hotel_checkin)}</span>}
                                  {e.hotel_checkin && e.hotel_checkout && <br />}
                                  {e.hotel_checkout && <span>check out {formatDate(e.hotel_checkout)}</span>}
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={s.ecardNoHotel}>+ Ajouter un hôtel</div>
                          )}
                        </div>
                        <div style={s.ecardDivider} />
                        <button style={s.editBtn} onClick={ev => { ev.stopPropagation(); openEdit(e); }}>Éditer l'étape</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Mode réorganisation */}
        {sheetExpanded && reorgMode && (
          <>
            <div style={s.sheetHeader}>
              <span style={s.sheetTitle}>Réorganiser</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.reorgCancelBtn} onClick={cancelReorg}>Annuler</button>
                <button style={s.reorgSaveBtn} onClick={saveReorg}>Valider</button>
              </div>
            </div>
            <div style={{ padding: '4px 20px 6px', fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Maintiens et glisse pour changer l'ordre
            </div>
            <div
              ref={reorgScrollRef}
              style={{ ...s.reorgScroll, touchAction: dragIdx !== null ? 'none' : 'pan-x' }}              onTouchMove={onContainerTouchMove}
              onTouchEnd={onContainerTouchEnd}
            >
              {reorgEtapes.map((e, i) => {
                const isGhost = dragIdx === i; // carte "source" rendue transparente
                const isTarget = dropIdx === i && dragIdx !== null && dragIdx !== i;
                return (
                  <div
                    key={e.id}
                    ref={el => cardRefs.current[i] = el}
                    style={{
                      ...s.reorgCard,
                      opacity: isGhost ? 0.25 : 1,
                      transform: isTarget ? 'translateX(6px) scale(1.02)' : 'none',
                      outline: isTarget ? '2px dashed rgba(255,255,255,0.25)' : 'none',
                      transition: isGhost ? 'none' : 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                    }}
                    onTouchStart={ev => onCardTouchStart(i, ev)}
                  >
                    <div style={s.reorgCardIndex}>{i + 1}</div>
                    <div style={s.reorgCardName}>{e.nom}</div>
                    <div style={s.reorgCardNuits}>{e.nuits} nuit{e.nuits > 1 ? 's' : ''}</div>
                    <div style={s.reorgHandle}>⠿</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      {!reorgMode && <button style={s.fab} onClick={() => setModal(true)}>+</button>}

      {/* Modal équipage */}
      {equipageOpen && (
        <EquipageModal voyageId={voyageId} session={session} onClose={() => setEquipageOpen(false)} />
      )}

      {/* Modal ajout étape */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhandle} />
            <div style={s.mtitle}>Nouvelle étape</div>
            <div style={s.fg}>
              <label style={s.fl}>Ville</label>
              <input value={nom} onChange={e => { setNom(e.target.value); setSelected(null); clearTimeout(timer.current); timer.current = setTimeout(() => searchPlaces(e.target.value), 500); }} placeholder="Tokyo, Kyoto…" autoFocus style={{ ...s.fi, borderRadius: suggestions.length && !selected ? '12px 12px 0 0' : 12 }} />
              {sugLoading && <div style={s.acWrap}><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Recherche…</span></div>}
              {suggestions.length > 0 && !selected && (
                <div style={s.acList}>
                  {suggestions.map((r, i) => (
                    <div key={i} style={s.acItem} onClick={() => { setSelected(r); setNom(r.name); setSuggestions([]); }}>
                      <div style={s.acName}>{r.name}</div>
                      <div style={s.acAddr}>{r.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.fg}>
              <label style={s.fl}>Nuits</label>
              <input style={s.fi} type="number" min="0" value={nuits} onChange={e => setNuits(e.target.value)} />
            </div>
            <button style={s.btnP} onClick={addEtape}>Ajouter</button>
            <button style={s.btnG} onClick={() => { setModal(false); setNom(''); setSuggestions([]); setSelected(null); }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Modal édition étape */}
      {editModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div style={s.modal}>
            <div style={s.mhandle} />
            <div style={s.mtitle}>{editModal.nom}</div>

            <div style={s.sectionLabel}>Lieu</div>
            <div style={s.fg}>
              <label style={s.fl}>Ville</label>
              <input
                value={editLieuNom}
                onChange={e => {
                  setEditLieuNom(e.target.value);
                  setEditLieuSelected(null);
                  clearTimeout(editLieuTimer.current);
                  editLieuTimer.current = setTimeout(() => searchEditLieu(e.target.value), 500);
                }}
                style={{ ...s.fi, borderRadius: editLieuSuggestions.length && !editLieuSelected ? '12px 12px 0 0' : 12 }}
              />
              {editLieuLoading && <div style={s.acWrap}><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Recherche…</span></div>}
              {editLieuSuggestions.length > 0 && !editLieuSelected && (
                <div style={s.acList}>
                  {editLieuSuggestions.map((r, i) => (
                    <div key={i} style={s.acItem} onClick={() => { setEditLieuSelected(r); setEditLieuNom(r.name); setEditLieuSuggestions([]); }}>
                      <div style={s.acName}>{r.name}</div>
                      <div style={s.acAddr}>{r.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={s.sectionLabel}>Général</div>
            <div style={s.fg}>
              <label style={s.fl}>Nuits</label>
              <input style={s.fi} type="number" min="0" value={editNuits} onChange={e => setEditNuits(e.target.value)} />
            </div>

            <div style={s.sectionLabel}>Hôtel</div>
            <div style={s.fg}>
              <label style={s.fl}>Nom de l'hôtel</label>
              <input value={editHotelNom} onChange={e => { setEditHotelNom(e.target.value); setHotelSelected(false); clearTimeout(hotelTimer.current); hotelTimer.current = setTimeout(() => searchHotel(e.target.value), 500); }} placeholder="Hyatt Regency Tokyo…" style={{ ...s.fi, borderRadius: hotelSuggestions.length && !hotelSelected ? '12px 12px 0 0' : 12 }} />
              {hotelSugLoading && <div style={s.acWrap}><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Recherche…</span></div>}
              {hotelSuggestions.length > 0 && !hotelSelected && (
                <div style={s.acList}>
                  {hotelSuggestions.map((r, i) => (
                    <div key={i} style={s.acItem} onClick={() => { setEditHotelNom(r.name); setEditHotelAdresse(r.address); setHotelSelected(true); setHotelSuggestions([]); }}>
                      <div style={s.acName}>{r.name}</div>
                      <div style={s.acAddr}>{r.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.fg}>
              <label style={s.fl}>Adresse</label>
              <input style={s.fi} value={editHotelAdresse} onChange={e => setEditHotelAdresse(e.target.value)} placeholder="2-7-2 Nishi-Shinjuku…" />
            </div>
            <div style={s.fg}>
              <label style={s.fl}>N° de confirmation</label>
              <input style={s.fi} value={editHotelConfirmation} onChange={e => setEditHotelConfirmation(e.target.value)} placeholder="CONF-123456" />
            </div>
            <DateRangePicker checkin={editCheckin} checkout={editCheckout} onChange={(ci, co) => { setEditCheckin(ci); setEditCheckout(co); }} />
            <button style={s.btnP} onClick={saveEdit}>Enregistrer</button>
            <button style={s.btnG} onClick={() => setEditModal(null)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  app:           { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0D1117' },
  topbar:        { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '16px 20px 0', display: 'flex', alignItems: 'flex-start', gap: 12, pointerEvents: 'none' },
  backBtn:       { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, pointerEvents: 'all' },
  title:         { fontFamily: 'Georgia,serif', fontSize: 22, color: 'white', textShadow: '0 2px 16px rgba(0,0,0,0.6)' },
  sub:           { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  sheet:         { background: 'rgba(10,14,20,0.95)', backdropFilter: 'blur(24px)', borderRadius: '22px 22px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column' },
  handleWrap:    { padding: '10px 0 4px', cursor: 'grab', userSelect: 'none' },
  handle:        { width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto' },
  sheetHeader:   { padding: '4px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle:    { fontFamily: 'Georgia,serif', fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  equipageBtn:   { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'inherit' },
  reorgBtn:      { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'inherit' },
  reorgSaveBtn:  { background: 'white', border: 'none', borderRadius: 20, color: '#0D1117', cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' },
  reorgCancelBtn:{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontFamily: 'inherit' },
  reorgScroll:   { overflowX: 'auto', display: 'flex', gap: 10, padding: '8px 20px 20px', scrollbarWidth: 'none' },
  reorgCard:     { flexShrink: 0, width: 110, borderRadius: 14, padding: '12px 10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'grab', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, userSelect: 'none' },
  reorgCardIndex:{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 },
  reorgCardName: { fontFamily: 'Georgia,serif', fontSize: 13, color: 'white', textAlign: 'center', lineHeight: 1.2 },
  reorgCardNuits:{ fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  reorgHandle:   { fontSize: 16, color: 'rgba(255,255,255,0.2)', marginTop: 4, letterSpacing: 2 },
  hscroll:       { overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 0, padding: '10px 20px 20px', scrollbarWidth: 'none' },
  miniScroll:    { overflowX: 'auto', display: 'flex', alignItems: 'center', padding: '0 16px', scrollbarWidth: 'none', gap: 0, maxWidth: '100%' },
  miniCard:      { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '5px 10px', flexShrink: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  miniCardName:  { fontSize: 11, color: 'white', fontWeight: 500, whiteSpace: 'nowrap' },
  miniCardNuits: { fontSize: 9, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' },
  miniConnector: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4px', flexShrink: 0 },
  miniConnectorLine: { height: 1, width: 16, background: 'rgba(255,255,255,0.15)' },
  miniConnectorText: { fontSize: 9, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', padding: '2px 0' },
  ecard:         { background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: '14px 16px', width: 200, cursor: 'pointer', flexShrink: 0, position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
  ecardName:     { fontFamily: 'Georgia,serif', fontSize: 17, color: 'white', marginBottom: 4, paddingRight: 20 },
  ecardNuits:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  ecardSection:  { marginBottom: 10 },
  ecardHotelNom: { fontSize: 12, color: 'white', fontWeight: 500, marginBottom: 2 },
  ecardHotelAddr:{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ecardHotelDates:{ fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  ecardNoHotel:  { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' },
  ecardDivider:  { height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' },
  editBtn:       { display: 'block', width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 11, padding: '5px 0', fontFamily: 'inherit', textAlign: 'center', marginTop: 4 },
  routePill:     { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '5px 12px', flexShrink: 0 },
  routePillVal:  { fontSize: 11, color: 'white', fontWeight: 500, whiteSpace: 'nowrap' },
  routePillLink: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginTop: 3, whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)', transition: 'all 0.15s' },
  delBtn:        { position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 12 },
  empty:         { textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  fab:           { position: 'absolute', zIndex: 20, bottom: 16, right: 20, width: 50, height: 50, borderRadius: '50%', background: 'white', color: '#0D1117', border: 'none', cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.45)' },
  overlay:       { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end' },
  modal:         { background: '#12171F', borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '0 20px 44px', width: '100%', maxHeight: '88vh', overflowY: 'auto' },
  mhandle:       { width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '14px auto 22px' },
  mtitle:        { fontFamily: 'Georgia,serif', fontSize: 21, color: 'white', marginBottom: 20 },
  sectionLabel:  { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', marginBottom: 12, marginTop: 8 },
  fg:            { marginBottom: 12 },
  fl:            { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 6, display: 'block' },
  fi:            { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, color: 'white', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  acWrap:        { padding: '10px 14px', background: '#181E28', border: '1px solid rgba(255,255,255,0.09)', borderTop: 'none', borderRadius: '0 0 12px 12px' },
  acList:        { background: '#181E28', border: '1px solid rgba(255,255,255,0.09)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' },
  acItem:        { padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  acName:        { fontSize: 14, fontWeight: 500, color: 'white' },
  acAddr:        { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  btnP:          { width: '100%', padding: 14, background: 'white', color: '#0D1117', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  btnG:          { width: '100%', padding: 12, background: 'none', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, fontSize: 14, cursor: 'pointer', marginTop: 8 },
};
