import React, { useState, useEffect, useMemo } from 'react';
import { LogIn, LogOut, Download, Plus, Trash2, Sun, Moon, Terminal, Flame, Droplets } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db, provider } from "./firebase";
import MatrixBackground from './MatrixBackground';
import './index.css'; // Make sure this is imported

const THEMES = ["dark", "light", "ocean", "sunset", "matrix"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isToday(year, month, day) {
  const t = new Date();
  return year === t.getFullYear() && month === t.getMonth() && day === t.getDate();
}

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [user, setUser] = useState(null);
  
  // State
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [habits, setHabits] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("guest::habit-list"));
      if (Array.isArray(parsed)) return parsed;
    } catch { }
    return ["Exercise", "Water", "Reading", "Sleep", "Meditation"];
  });
  const [data, setData] = useState({}); // { "user::key": true }
  
  const [newHabit, setNewHabit] = useState("");

  const userKey = user ? user.uid : "guest";
  const ukey = (k) => `${userKey}::${k}`;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Auth listener
  useEffect(() => {
    let unsub = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (usr) => {
      if (unsub) unsub();
      if (usr) {
        setUser(usr);
        // Subscribe to Firestore for user data sync
        unsub = onSnapshot(doc(db, "users", usr.uid), (snap) => {
          const cloudData = snap.data();
          if (!cloudData) return;
          
          let newData = { ...data };
          let newHabits = [...habits];
          
          Object.keys(cloudData).forEach(k => {
             if (cloudData[k] && cloudData[k].value !== undefined) {
               if (k === `${usr.uid}::habit-list`) {
                 try { 
                   const parsed = JSON.parse(cloudData[k].value);
                   if (Array.isArray(parsed)) newHabits = parsed;
                 } catch { }
               } else {
                 newData[k] = cloudData[k].value;
               }
             }
          });
          
          setHabits(newHabits);
          setData(prev => ({...prev, ...newData}));
        });
      } else {
        setUser(null);
        // Load guest data from localStorage securely
        let gHabits = ["Exercise", "Water", "Reading", "Sleep", "Meditation"];
        try {
          const parsed = JSON.parse(localStorage.getItem("guest::habit-list"));
          if (Array.isArray(parsed)) gHabits = parsed;
        } catch { }
        setHabits(gHabits);
        
        // Very basic load - normally we'd namespace localStorage keys properly
        let gData = {};
        for(let i=0; i<localStorage.length; i++) {
          let k = localStorage.key(i);
          if (k.startsWith("guest::") && k !== "guest::habit-list") {
             gData[k] = localStorage.getItem(k) === "true";
          }
        }
        setData(gData);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsub) unsub();
    };
  }, []);

  // Helpers
  const syncData = async (key, value) => {
    if (userKey === "guest") {
      localStorage.setItem(key, value);
    } else {
      try {
        await setDoc(doc(db, "users", userKey), {
          [key]: { value: value, updatedAt: Date.now() }
        }, { merge: true });
      } catch {
        console.error("Sync Error communicating with Firebase.");
      }
    }
  };

  const handleAddHabit = () => {
    if (!newHabit.trim()) return;
    const nextList = [...habits, newHabit.trim()];
    setHabits(nextList);
    syncData(ukey("habit-list"), JSON.stringify(nextList));
    setNewHabit("");
  };

  const handleDeleteHabit = (h) => {
    if (!window.confirm(`Delete "${h}"?`)) return;
    const nextList = habits.filter(x => x !== h);
    setHabits(nextList);
    syncData(ukey("habit-list"), JSON.stringify(nextList));
  };

  const handleToggle = (h, d) => {
    const k = `${year}-${month}-${h}-${d}`;
    const fullKey = ukey(k);
    const v = !(data[fullKey] === true || localStorage.getItem(fullKey) === "true");
    
    // Optimistic UI
    setData(prev => ({...prev, [fullKey]: v}));
    syncData(fullKey, v);
  };

  const handleExportCSV = () => {
    const days = getDaysInMonth(year, month);
    let csv = "Habit," + Array.from({length: days}, (_, i) => i + 1).join(",") + "\n";
    habits.forEach(h => {
      csv += `"${h}"`;
      for (let d = 1; d <= days; d++) {
        const k = ukey(`${year}-${month}-${h}-${d}`);
        const isDone = data[k] === true || localStorage.getItem(k) === "true";
        csv += isDone ? ",✔" : ",";
      }
      csv += "\n";
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `habits-${year}-${month + 1}.csv`;
    a.click();
  };

  // derived data
  const days = getDaysInMonth(year, month);
  
  const stats = useMemo(() => {
    let total = 0, best = { n: "-", v: -1 }, worst = { n: "-", v: 101 };
    
    habits.forEach(h => {
      let done = 0;
      for (let d = 1; d <= days; d++) {
        const k = ukey(`${year}-${month}-${h}-${d}`);
        if (data[k] === true || localStorage.getItem(k) === "true") done++;
      }
      const p = Math.round((done / days) * 100);
      total += p;
      if (p > best.v) best = { n: h, v: p };
      if (p < worst.v) worst = { n: h, v: p };
    });
    
    return {
      overall: habits.length ? Math.round(total / habits.length) : 0,
      best: best.n,
      worst: worst.n
    };
  }, [habits, year, month, data, days, userKey]);

  return (
    <>
      <MatrixBackground theme={theme} />
      
      <header>
        <div className="logo">HABIT TRACKER</div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* Theme toggler */}
          <button 
            onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
            className="btn-primary"
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', boxShadow: 'none' }}
          >
            {theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : theme === 'ocean' ? <Droplets size={16} /> : theme === 'sunset' ? <Sun size={16} color="orange" /> : <Terminal size={16} />}
            <span style={{ fontSize: '13px', textTransform: 'uppercase' }}>{theme}</span>
          </button>
          
          <button onClick={handleExportCSV} className="btn-primary" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', boxShadow: 'none' }}>
            <Download size={16} /> CSV
          </button>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={user.photoURL} alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--accent-color)' }} />
              <button onClick={() => signOut(auth)} className="btn-primary" style={{ padding: '8px', background: 'var(--danger)', color: '#fff', boxShadow: 'none' }}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => signInWithPopup(auth, provider).catch(err => alert("Firebase Login Error: " + err.message))} className="btn-primary" style={{ padding: '8px 16px' }}>
              <LogIn size={16} /> AUTH
            </button>
          )}
        </div>
      </header>

      <main className="app-container animate-fade-in">
        
        {/* Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>Efficiency</span>
            <span style={{ fontSize: '36px', fontWeight: '800', color: 'var(--accent-color)', marginTop: '4px' }}>{stats.overall}%</span>
          </div>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>Top Goal</span>
            <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-color)', marginTop: '4px', textAlign: 'center' }}>{stats.best}</span>
          </div>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>Focus Need</span>
            <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--danger)', marginTop: '4px', textAlign: 'center' }}>{stats.worst}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <select 
            value={year} 
            onChange={e => setYear(+e.target.value)}
            className="input-base"
            style={{ width: '120px' }}
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select 
            value={month} 
            onChange={e => setMonth(+e.target.value)}
            className="input-base"
            style={{ width: '160px' }}
          >
            {Array.from({length: 12}).map((_, i) => (
              <option key={i} value={i}>{new Date(0, i).toLocaleString("default", {month: "long"})}</option>
            ))}
          </select>

          <div style={{ flex: 1, display: 'flex', gap: '12px', minWidth: '250px' }}>
            <input 
              type="text" 
              value={newHabit}
              onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
              placeholder="Log new custom task..." 
              className="input-base"
              maxLength={60}
            />
            <button onClick={handleAddHabit} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Add
            </button>
          </div>
        </div>

        {/* Tracker Table */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="table-wrapper" style={{ '--days': days }}>
            <table className="tracker-table">
              <thead className="tracker-header">
                <tr>
                  <th>Habit</th>
                  {Array.from({length: days}).map((_, i) => {
                    const d = i + 1;
                    const today = isToday(year, month, d);
                    return (
                      <th key={d} style={today ? { color: 'var(--accent-color)', fontWeight: '800', background: 'rgba(255,255,255,0.05)' } : {}}>
                        {d}
                      </th>
                    );
                  })}
                  <th>%</th>
                  <th><Flame size={16} style={{display:'inline', verticalAlign:'middle', color:'#f97316'}}/></th>
                  <th>🏆</th>
                  <th>Del</th>
                </tr>
              </thead>
              <tbody>
                {habits.map((h, i) => {
                   let done = 0;
                   let tempStreak = 0;
                   let maxStreak = 0;
                   let currentStreak = 0;
                   
                   for (let d = 1; d <= days; d++) {
                      const k = ukey(`${year}-${month}-${h}-${d}`);
                      if (data[k] === true || localStorage.getItem(k) === "true") {
                        tempStreak++;
                        if (tempStreak > maxStreak) maxStreak = tempStreak;
                      } else {
                        tempStreak = 0;
                      }
                   }
                   
                   const todayDate = new Date();
                   if (year === todayDate.getFullYear() && month === todayDate.getMonth()) {
                     let cStreak = 0;
                     for (let d = todayDate.getDate(); d >= 1; d--) {
                        const k = ukey(`${year}-${month}-${h}-${d}`);
                        if (data[k] === true || localStorage.getItem(k) === "true") cStreak++;
                        else break;
                     }
                     currentStreak = cStreak;
                   } else if (year < todayDate.getFullYear() || (year === todayDate.getFullYear() && month < todayDate.getMonth())) {
                     currentStreak = tempStreak;
                   }

                   return (
                    <tr key={i} className="tracker-row">
                      <td className="cell habit-name">{h}</td>
                      {Array.from({length: days}).map((_, j) => {
                        const d = j + 1;
                        const k = ukey(`${year}-${month}-${h}-${d}`);
                        const isChecked = data[k] === true || localStorage.getItem(k) === "true";
                        if (isChecked) done++;
                        const today = isToday(year, month, d);
                        return (
                          <td key={d} className="cell" style={today ? { background: 'rgba(255,255,255,0.02)' } : {}}>
                            <div className={`habit-checkbox ${isChecked ? 'checked' : ''}`} onClick={() => handleToggle(h, d)} />
                          </td>
                        );
                      })}
                      <td className="cell" style={{ fontWeight: '800', color: 'var(--accent-color)', fontSize: '14px', textAlign: 'center' }}>
                        {Math.round((done / days) * 100)}%
                      </td>
                      <td className="cell" style={{ fontWeight: '800', color: '#f97316', fontSize: '13px', textAlign: 'center', minWidth: '40px' }}>
                        {currentStreak}
                      </td>
                      <td className="cell" style={{ fontWeight: '800', color: '#eab308', fontSize: '13px', textAlign: 'center', minWidth: '40px' }}>
                        {maxStreak}
                      </td>
                      <td className="cell" style={{ textAlign: 'center' }}>
                        <button onClick={() => handleDeleteHabit(h)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                   );
                })}
              </tbody>
            </table>
            
            {habits.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No habits added yet. Start by logging a new action above.
              </div>
            )}
          </div>
        </div>

      </main>
    </>
  );
}
