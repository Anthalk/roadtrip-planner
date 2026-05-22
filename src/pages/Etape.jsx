import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Map from '../components/Map';

const CATS = ['Visite', 'Resto', 'Bar', 'Hébergement', 'Autre'];
const CAT_COLOR = {
  Visite: '#4A90D9',
  Resto: '#E8734A',
  Bar: '#9B6BB5',
  Hébergement: '#4AAD8A',
  Autre: '#888',
};

export default function Etape({ etapeId, voyageId, onBack }) {
  const [etape, setEtape] = useState(null);
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [spotModal, setSpotModal] = useState(null);
  const [nom, setNom] = useState('');
  const [cat, setCat] = useState('Visite');
  const [suggestions, setSuggestions] = useState([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const timer = { current: null };
  const mapRef = useRef(null);

  // Sheet drag
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [sheetTranslate, setSheetTranslate] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetDragY = useRef(null);
  const sheetDragTime = useRef(null);

  useEffect(() => { fetchData(); }, [etapeId]);

  const fetchData = async () => {
    const [{ data: e }, { data: s }] = await Promise.all([
      supabase.from('etapes').select('*').eq('id', etapeId).single(),
      supabase.from('spots').select('*').eq('etape_id', etapeId).order('created_at'),
    ]);
    setEtape(e);
    setSpots(s || []);
    setLoading(false);
  };

  const searchPlaces = async (q) => {
    if (q.length < 3) { setSuggestions([]); return; }
    setSugLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { q: q + (etape?.nom ? ' ' + etape.nom : '') },
      });
      if (!error) {
        setSuggestions(data || []);
        if (data?.[0]?.categorie) setCat(data[0].categorie);
      }
    } catch {}
    setSugLoading(false);
  };

  const addSpot = async () => {
    if (!nom) return;
    const { error } = await supabase.from('spots').insert({
      etape_id: etapeId,
      nom: selected?.name || nom,
      lat: selected?.lat || null,
      lon: selected?.lon || null,
      adresse: selected?.address || '',
      categorie: selected?.categorie || cat,
      done: false,
    });
    if (!error) {
      setNom(''); setSelected(null); setSuggestions([]); setModal(false);
      fetchData();
    }
  };

  const toggleSpot = async (id, done) => {
    await supabase.from('spots').update({ done: !done }).eq('id', id);
    setSpots(spots.map((s) => (s.id === id ? { ...s, done: !done } : s)));
  };

  const deleteSpot = async (id) => {
    await supabase.from('spots').delete().eq('id', id);
    setSpots(spots.filter((s) => s.id !== id));
    setSpotModal(null);
  };

  // Handle drag
  const onHandleTouchStart = (e) => {
    sheetDragY.current = e.touches[0].clientY;
    sheetDragTime.current = Date.now();
    setSheetDragging(true);
  };

  const onHandleTouchMove = (e) => {
    if (sheetDragY.current === null) return;
    const delta = e.touches[0].clientY - sheetDragY.current;
    // Résistance dans la direction opposée
    if (sheetExpanded && delta < 0) setSheetTranslate(delta * 0.2);
    else if (!sheetExpanded && delta > 0) setSheetTranslate(delta * 0.2);
    else setSheetTranslate(delta * 0.8);
  };

  const onHandleTouchEnd = (e) => {
    const endY = e.changedTouches[0].clientY;
    const delta = endY - sheetDragY.current;
    const elapsed = Date.now() - sheetDragTime.current;
    const isTap = Math.abs(delta) < 8 && elapsed < 200;

    if (isTap) setSheetExpanded(p => !p);
    else if (delta > 40) setSheetExpanded(false);
    else if (delta < -40) setSheetExpanded(true);

    sheetDragY.current = null;
    setSheetTranslate(0);
    setSheetDragging(false);
  };

  const total = spots.length;
  const done = spots.filter((s) => s.done).length;
  const byCat = CATS.reduce((a, c) => ({ ...a, [c]: spots.filter((s) => s.categorie === c) }), {});

  const navUrl = (spot) => {
    const origin = etape?.hotel_adresse ? encodeURIComponent(etape.hotel_adresse) : 'Current+Location';
    return `https://www.google.com/maps/dir/${origin}/${spot.lat},${spot.lon}`;
  };

  return (
    <div style={s.app}>
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={onBack}>←</button>
        <div>
          <div style={s.title}>{etape?.nom}</div>
          <div style={s.sub}>{etape?.nuits} nuit{etape?.nuits > 1 ? 's' : ''} · {done}/{total} visités</div>
        </div>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Map ref={mapRef} etapes={etape ? [etape] : []} spots={spots} tight={true} />
      </div>

      <div style={{
        ...s.sheet,
        height: sheetExpanded ? '50vh' : '14vh',
        transform: `translateY(${sheetTranslate}px)`,
        transition: sheetDragging ? 'none' : 'height 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div
          style={s.handleWrap}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div style={s.handle} />
        </div>

        {/* Vue réduite */}
        {!sheetExpanded && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={s.miniScroll}>
              {CATS.map((cat) => {
                const n = byCat[cat]?.length || 0;
                if (!n) return null;
                return (
                  <div key={cat} style={s.miniCat} onClick={() => setSheetExpanded(true)}>
                    <div style={{ ...s.miniCatDot, background: CAT_COLOR[cat] }} />
                    <span style={s.miniCatLabel}>{cat}</span>
                    <span style={s.miniCatCount}>{n}</span>
                  </div>
                );
              })}
              {total === 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Aucun spot</span>}
            </div>
          </div>
        )}

        {/* Vue déployée */}
        {sheetExpanded && (
          <>
            <div style={s.sheetHeader}>
              <span style={s.sheetTitle}>Spots</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }} onClick={() => setSheetExpanded(false)}>▾</span>
            </div>

            {total > 0 && (
              <div style={s.progWrap}>
                <div style={{ ...s.progBar, width: Math.round((done / total) * 100) + '%' }} />
              </div>
            )}

            {loading ? (
              <div style={s.empty}>Chargement…</div>
            ) : total === 0 ? (
              <div style={s.empty}>Ajoute tes premiers spots</div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 24 }}>
                {CATS.map((cat) => {
                  const catSpots = byCat[cat];
                  if (!catSpots.length) return null;
                  return (
                    <div key={cat}>
                      <div style={s.catHdr}>
                        <div style={{ ...s.catDot, background: CAT_COLOR[cat] }} />
                        <span style={s.catLbl}>{cat}</span>
                        <span style={s.catCnt}>{catSpots.filter((s) => s.done).length}/{catSpots.length}</span>
                      </div>
                      <div style={s.catHscroll}>
                        {catSpots.map((spot) => (
                          <div
                            key={spot.id}
                            style={{ ...s.spotCard, opacity: spot.done ? 0.5 : 1 }}
                            onClick={() => { if (spot.lat && mapRef.current) mapRef.current.flyTo(spot.lat, spot.lon); }}
                            onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(255,255,255,0.12)'; ev.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'rgba(255,255,255,0.06)'; ev.currentTarget.style.transform = 'none'; }}
                          >
                            <button
                              style={{ ...s.spotChk, ...(spot.done ? s.spotChkDone : {}), marginBottom: 8 }}
                              onClick={() => toggleSpot(spot.id, spot.done)}
                            >
                              {spot.done && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}
                            </button>
                            <div style={s.spotCardNom}>{spot.nom}</div>
                            {spot.adresse && <div style={s.spotCardAddr}>{spot.adresse}</div>}
                            <div style={s.spotCardActions}>
                              {spot.lat && <a href={navUrl(spot)} target="_blank" rel="noreferrer" style={s.spotCardBtn}>↗ S'y rendre</a>}
                              <button style={{ ...s.spotCardBtn, color: 'rgba(255,80,80,0.6)', borderColor: 'rgba(255,80,80,0.2)' }} onClick={() => deleteSpot(spot.id)}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <button style={s.fab} onClick={() => setModal(true)}>+</button>

      {/* Modal spot detail */}
      {spotModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setSpotModal(null)}>
          <div style={s.modal}>
            <div style={s.mhandle} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={s.mtitle}>{spotModal.nom}</div>
                {spotModal.adresse && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{spotModal.adresse}</div>}
              </div>
              <div style={{ ...s.catDot, width: 10, height: 10, background: CAT_COLOR[spotModal.categorie] || '#888', marginTop: 8, flexShrink: 0 }} />
            </div>
            <button style={s.btnP} onClick={() => window.open(navUrl(spotModal))}>
              ↗ Y aller {etape?.hotel_adresse ? "(depuis l'hôtel)" : '(depuis ma position)'}
            </button>
            <button
              style={{ ...s.btnP, marginTop: 8, background: spotModal.done ? '#4AAD8A' : 'rgba(255,255,255,0.1)', color: spotModal.done ? 'white' : 'rgba(255,255,255,0.7)' }}
              onClick={() => { toggleSpot(spotModal.id, spotModal.done); setSpotModal({ ...spotModal, done: !spotModal.done }); }}
            >
              {spotModal.done ? '✓ Visité' : 'Marquer comme visité'}
            </button>
            <button style={s.btnG} onClick={() => deleteSpot(spotModal.id)}>Supprimer ce spot</button>
          </div>
        </div>
      )}

      {/* Modal ajout spot */}
      {modal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhandle} />
            <div style={s.mtitle}>Ajouter un spot</div>
            <div style={s.fg}>
              <label style={s.fl}>Lieu</label>
              <input
                style={{ ...s.fi, borderRadius: suggestions.length && !selected ? '12px 12px 0 0' : 12 }}
                value={nom}
                onChange={(e) => { setNom(e.target.value); setSelected(null); clearTimeout(timer.current); timer.current = setTimeout(() => searchPlaces(e.target.value), 500); }}
                placeholder="Château de Matsumoto…"
                autoFocus
              />
              {sugLoading && <div style={s.acWrap}><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Recherche…</span></div>}
              {suggestions.length > 0 && !selected && (
                <div style={s.acList}>
                  {suggestions.map((r, i) => (
                    <div key={i} style={s.acItem} onClick={() => { setSelected(r); setNom(r.name); setSuggestions([]); if (r.categorie) setCat(r.categorie); }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={s.acName}>{r.name}</div>
                          <div style={s.acAddr}>{r.address}</div>
                        </div>
                        {r.categorie && (
                          <span style={{ fontSize: 10, color: CAT_COLOR[r.categorie], border: `1px solid ${CAT_COLOR[r.categorie]}`, borderRadius: 10, padding: '2px 8px', flexShrink: 0, marginLeft: 8 }}>{r.categorie}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.fg}>
              <label style={s.fl}>Catégorie</label>
              <div style={s.catPicker}>
                {CATS.map((c) => (
                  <button key={c} style={{ ...s.cpick, ...(cat === c ? { borderColor: CAT_COLOR[c], color: CAT_COLOR[c], background: 'rgba(255,255,255,0.04)' } : {}) }} onClick={() => setCat(c)}>{c}</button>
                ))}
              </div>
            </div>
            <button style={s.btnP} onClick={addSpot}>Ajouter</button>
            <button style={s.btnG} onClick={() => { setModal(false); setNom(''); setSuggestions([]); setSelected(null); }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  app:          { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0D1117' },
  topbar:       { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '16px 20px 0', display: 'flex', alignItems: 'flex-start', gap: 12, pointerEvents: 'none' },
  backBtn:      { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, pointerEvents: 'all' },
  title:        { fontFamily: 'Georgia,serif', fontSize: 22, color: 'white', textShadow: '0 2px 16px rgba(0,0,0,0.6)' },
  sub:          { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  sheet:        { background: 'rgba(10,14,20,0.95)', backdropFilter: 'blur(24px)', borderRadius: '22px 22px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column' },
  handleWrap:   { padding: '14px 0 6px', cursor: 'grab', userSelect: 'none', flexShrink: 0, touchAction: 'none' },
  handle:       { width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto' },
  sheetHeader:  { padding: '4px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  sheetTitle:   { fontFamily: 'Georgia,serif', fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  progWrap:     { height: 3, background: 'rgba(255,255,255,0.08)', margin: '0 20px 4px', borderRadius: 3, flexShrink: 0 },
  progBar:      { height: '100%', background: 'linear-gradient(90deg,#4A90D9,#6DB3F2)', borderRadius: 3, transition: 'width 0.4s' },
  catHdr:       { display: 'flex', alignItems: 'center', gap: 8, margin: '12px 20px 6px' },
  catDot:       { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  catLbl:       { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)' },
  catCnt:       { fontSize: 10, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' },
  catHscroll:   { overflowX: 'auto', display: 'flex', gap: 10, padding: '0 20px 12px', scrollbarWidth: 'none' },
  spotCard:     { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '12px', minWidth: 140, maxWidth: 160, flexShrink: 0, display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.15s, background 0.15s' },
  spotCardNom:  { fontSize: 13, fontWeight: 500, color: 'white', marginBottom: 3, lineHeight: 1.3 },
  spotCardAddr: { fontSize: 10, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8, flex: 1 },
  spotCardActions: { display: 'flex', gap: 6, marginTop: 'auto' },
  spotCardBtn:  { fontSize: 10, color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 8px', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  spotChk:      { width: 20, height: 20, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', background: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' },
  spotChkDone:  { background: '#4AAD8A', borderColor: '#4AAD8A' },
  miniScroll:   { overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', scrollbarWidth: 'none', maxWidth: '100%' },
  miniCat:      { display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '5px 10px', flexShrink: 0, cursor: 'pointer' },
  miniCatDot:   { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  miniCatLabel: { fontSize: 11, color: 'white', fontWeight: 500, whiteSpace: 'nowrap' },
  miniCatCount: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 2 },
  empty:        { textAlign: 'center', padding: '28px 20px', color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  fab:          { position: 'absolute', zIndex: 20, bottom: 16, right: 20, width: 50, height: 50, borderRadius: '50%', background: 'white', color: '#0D1117', border: 'none', cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.45)' },
  overlay:      { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end' },
  modal:        { background: '#12171F', borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '0 20px 44px', width: '100%', maxHeight: '88vh', overflowY: 'auto' },
  mhandle:      { width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '14px auto 22px' },
  mtitle:       { fontFamily: 'Georgia,serif', fontSize: 21, color: 'white', marginBottom: 4 },
  fg:           { marginBottom: 15 },
  fl:           { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 6, display: 'block' },
  fi:           { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'white', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  acWrap:       { padding: '10px 14px', background: '#181E28', border: '1px solid rgba(255,255,255,0.09)', borderTop: 'none', borderRadius: '0 0 12px 12px' },
  acList:       { background: '#181E28', border: '1px solid rgba(255,255,255,0.09)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' },
  acItem:       { padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  acName:       { fontSize: 14, fontWeight: 500, color: 'white' },
  acAddr:       { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  catPicker:    { display: 'flex', gap: 8, flexWrap: 'wrap' },
  cpick:        { padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(255,255,255,0.45)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' },
  btnP:         { width: '100%', padding: 14, background: 'white', color: '#0D1117', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  btnG:         { width: '100%', padding: 12, background: 'none', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, fontSize: 14, cursor: 'pointer', marginTop: 8 },
};
