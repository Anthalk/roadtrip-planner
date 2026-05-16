import { useState } from 'react';

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const JOURS = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(str) {
  if (!str) return null;
  const d = parseDate(str);
  return `${d.getDate()} ${MOIS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  let day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // lundi = 0
}

export default function DateRangePicker({ checkin, checkout, onChange }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(checkin ? parseDate(checkin).getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(checkin ? parseDate(checkin).getMonth() : today.getMonth());
  const [selecting, setSelecting] = useState(null); // 'checkin' | 'checkout'
  const [hover, setHover] = useState(null);

  const checkinDate = parseDate(checkin);
  const checkoutDate = parseDate(checkout);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (date) => {
    if (!selecting || selecting === 'checkin') {
      onChange(formatDate(date), checkout);
      setSelecting('checkout');
    } else {
      if (checkinDate && date < checkinDate) {
        onChange(formatDate(date), checkin);
        setSelecting('checkout');
      } else {
        onChange(checkin, formatDate(date));
        setSelecting(null);
      }
    }
  };

  const isInRange = (date) => {
    const start = checkinDate;
    const end = selecting === 'checkout' && hover ? hover : checkoutDate;
    if (!start || !end) return false;
    return date > start && date < end;
  };

  const isStart = (date) => checkinDate && date.toDateString() === checkinDate.toDateString();
  const isEnd = (date) => {
    const end = selecting === 'checkout' && hover ? hover : checkoutDate;
    return end && date.toDateString() === end.toDateString();
  };

  const days = [];
  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(new Date(viewYear, viewMonth, d));

  return (
    <div style={s.wrap}>
      {/* Résumé sélection */}
      <div style={s.summary}>
        <div style={{ ...s.summaryBox, ...(selecting === 'checkin' ? s.summaryActive : {}) }}
          onClick={() => setSelecting('checkin')}>
          <div style={s.summaryLabel}>Check-in</div>
          <div style={s.summaryVal}>{checkin ? formatDisplay(checkin) : '—'}</div>
        </div>
        <div style={s.summaryArrow}>→</div>
        <div style={{ ...s.summaryBox, ...(selecting === 'checkout' ? s.summaryActive : {}) }}
          onClick={() => setSelecting('checkout')}>
          <div style={s.summaryLabel}>Check-out</div>
          <div style={s.summaryVal}>{checkout ? formatDisplay(checkout) : '—'}</div>
        </div>
      </div>

      {/* Navigation mois */}
      <div style={s.nav}>
        <button style={s.navBtn} onClick={prevMonth}>‹</button>
        <span style={s.navTitle}>{MOIS[viewMonth]} {viewYear}</span>
        <button style={s.navBtn} onClick={nextMonth}>›</button>
      </div>

      {/* Jours semaine */}
      <div style={s.weekdays}>
        {JOURS.map(j => <div key={j} style={s.weekday}>{j}</div>)}
      </div>

      {/* Grille jours */}
      <div style={s.grid}>
        {days.map((date, i) => {
          if (!date) return <div key={i} />;
          const start = isStart(date);
          const end = isEnd(date);
          const inRange = isInRange(date);
          const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return (
            <div key={i}
              style={{
                ...s.day,
                ...(start || end ? s.daySelected : {}),
                ...(inRange ? s.dayRange : {}),
                ...(isPast ? s.dayPast : {}),
                ...(start ? s.dayStart : {}),
                ...(end ? s.dayEnd : {}),
              }}
              onClick={() => !isPast && handleDayClick(date)}
              onMouseEnter={() => selecting === 'checkout' && setHover(date)}
              onMouseLeave={() => setHover(null)}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div style={s.hint}>
        {selecting === 'checkin' ? 'Sélectionne la date d\'arrivée' :
         selecting === 'checkout' ? 'Sélectionne la date de départ' :
         checkin && checkout ? `${Math.round((parseDate(checkout) - parseDate(checkin)) / 86400000)} nuit${Math.round((parseDate(checkout) - parseDate(checkin)) / 86400000) > 1 ? 's' : ''}` : ''}
      </div>
    </div>
  );
}

const s = {
  wrap:          { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'16px', marginBottom:12 },
  summary:       { display:'flex', alignItems:'center', gap:8, marginBottom:16 },
  summaryBox:    { flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 12px', cursor:'pointer', transition:'border-color 0.2s' },
  summaryActive: { borderColor:'rgba(255,255,255,0.4)' },
  summaryLabel:  { fontSize:10, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 },
  summaryVal:    { fontSize:13, color:'white', fontWeight:500 },
  summaryArrow:  { color:'rgba(255,255,255,0.3)', fontSize:14 },
  nav:           { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  navBtn:        { background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:20, padding:'0 8px', lineHeight:1 },
  navTitle:      { fontSize:14, fontWeight:500, color:'white' },
  weekdays:      { display:'grid', gridTemplateColumns:'repeat(7, 1fr)', marginBottom:4 },
  weekday:       { textAlign:'center', fontSize:10, color:'rgba(255,255,255,0.3)', padding:'4px 0' },
  grid:          { display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 },
  day:           { textAlign:'center', padding:'7px 0', fontSize:13, color:'rgba(255,255,255,0.7)', cursor:'pointer', borderRadius:8, transition:'all 0.1s' },
  daySelected:   { background:'white', color:'#0D1117', fontWeight:600 },
  dayRange:      { background:'rgba(255,255,255,0.12)', borderRadius:0, color:'white' },
  dayStart:      { borderRadius:'8px 0 0 8px' },
  dayEnd:        { borderRadius:'0 8px 8px 0' },
  dayPast:       { color:'rgba(255,255,255,0.2)', cursor:'default' },
  hint:          { textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:10, minHeight:16 },
};