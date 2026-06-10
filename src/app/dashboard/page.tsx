"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// --- PUNKTE-LOGIK ---
function calculatePoints(pred: any, match: any) {
  let points = 0;
  let allCorrect = true;

  const predDiff = pred.pred_goals_home - pred.pred_goals_away;
  const matchDiff = match.goals_home - match.goals_away;
  
  const predWinner = predDiff > 0 ? 'home' : (predDiff < 0 ? 'away' : 'draw');
  const matchWinner = matchDiff > 0 ? 'home' : (matchDiff < 0 ? 'away' : 'draw');

  // 1. Richtiger Sieger
  if (predWinner === matchWinner) {
      points += 1;
      // Underdog Bonus
      if (match.underdog_team && matchWinner === match.underdog_team) points += 1;
  } else allCorrect = false;

  // 2. Richtige Tordifferenz
  if (predDiff === matchDiff) points += 1; else allCorrect = false;

  // 3. Richtiges exaktes Ergebnis
  if (pred.pred_goals_home === match.goals_home && pred.pred_goals_away === match.goals_away) points += 1; else allCorrect = false;

  // 4. Erster Torschütze
  if (pred.pred_first_scorer.toLowerCase() === match.first_scorer.toLowerCase()) points += 1; else allCorrect = false;

  // 5. MOTM
  if (pred.pred_motm.toLowerCase() === match.motm.toLowerCase()) points += 1; else allCorrect = false;

  // 6. Alles richtig
  if (allCorrect) points += 2;

  return points;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [myPredictions, setMyPredictions] = useState<any[]>([]);
  
  // Formular-State für Tipps (User) und Ergebnisse (Admin)
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/");
    
    setUser(session.user);

    // Prüfen ob Admin
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
    if (profile?.is_admin) setIsAdmin(true);

    // Spiele laden
    const { data: matchesData } = await supabase.from('matches').select('*').order('match_date', { ascending: true });
    if (matchesData) setMatches(matchesData);

    // Eigene Tipps laden
    const { data: predsData } = await supabase.from('predictions').select('*').eq('user_id', session.user.id);
    if (predsData) setMyPredictions(predsData);
  };

  const handleInputChange = (matchId: number, field: string, value: string | number) => {
    setFormData((prev: any) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value }
    }));
  };

  // --- USER: TIPP ABGEBEN ---
  const submitPrediction = async (matchId: number) => {
    const data = formData[matchId];
    if (!data || data.home === undefined || data.away === undefined || !data.scorer || !data.motm) {
      return alert("Bitte alle Felder ausfüllen!");
    }

    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id,
      match_id: matchId,
      pred_goals_home: data.home,
      pred_goals_away: data.away,
      pred_first_scorer: data.scorer,
      pred_motm: data.motm
    }, { onConflict: 'user_id,match_id' });

    if (error) alert("Fehler beim Speichern: " + error.message);
    else {
      alert("Tipp gespeichert!");
      fetchData(); // Daten neu laden
    }
  };

  // --- ADMIN: ERGEBNIS EINTRAGEN & PUNKTE BERECHNEN ---
  const submitRealResult = async (match: any) => {
    const data = formData[match.id];
    if (!data || data.home === undefined || data.away === undefined || !data.scorer || !data.motm) {
      return alert("Admin: Bitte alle Felder ausfüllen!");
    }

    // 1. Ergebnis in Matches-Tabelle speichern
    const updatedMatch = {
      ...match,
      goals_home: data.home,
      goals_away: data.away,
      first_scorer: data.scorer,
      motm: data.motm,
      status: 'finished'
    };

    await supabase.from('matches').update({
      goals_home: data.home,
      goals_away: data.away,
      first_scorer: data.scorer,
      motm: data.motm,
      status: 'finished'
    }).eq('id', match.id);

    // 2. Alle Tipps für dieses Spiel abrufen
    const { data: allPreds } = await supabase.from('predictions').select('*').eq('match_id', match.id);
    
    // 3. Punkte für jeden Tipp berechnen und speichern
    if (allPreds) {
      for (let pred of allPreds) {
        const points = calculatePoints(pred, updatedMatch);
        await supabase.from('predictions').update({ points_earned: points }).eq('id', pred.id);
      }
    }

    alert("Ergebnis eingetragen & Punkte verteilt!");
    fetchData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow">
            <h1 className="text-2xl font-bold text-gray-800">Hallo! 👋</h1>
            <div className="flex gap-4">
                {isAdmin && (
                    <button onClick={() => router.push("/admin")} className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700">⚙️ Admin</button>
                )}
                <button onClick={() => router.push("/leaderboard")} className="bg-green-500 text-white px-4 py-2 rounded font-bold hover:bg-green-600">🏆 Rangliste</button>
                <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Logout</button>
            </div>
        </div>

        {isAdmin && (
          <div className="mb-8 p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded text-yellow-800 font-bold">
            👑 Du bist als Admin eingeloggt. Du kannst echte Ergebnisse eintragen!
          </div>
        )}

        <div className="grid gap-6">
          {matches.map((match) => {
            const myPred = myPredictions.find(p => p.match_id === match.id);
            const isFinished = match.status === 'finished';
            const isLocked = new Date() >= new Date(match.match_date);

            return (
              <div key={match.id} className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h2 className="text-xl font-bold text-gray-800">
                    {match.team_home} vs {match.team_away}
                  </h2>
                  <span className={`px-3 py-1 rounded text-sm font-bold ${isFinished ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'}`}>
                    {isFinished ? 'Beendet' : 'Anstehend'}
                  </span>
                </div>

                {/* --- Anzeige für beendete Spiele --- */}
                {isFinished ? (
                  <div>
                    <p className="text-gray-600 font-semibold mb-2">Endergebnis: {match.goals_home}:{match.goals_away}</p>
                    <p className="text-sm text-gray-500">1. Torschütze: {match.first_scorer} | MOTM: {match.motm}</p>
                    {myPred && (
                      <div className="mt-4 p-3 bg-blue-50 rounded text-blue-800 font-bold">
                        Deine Punkte für dieses Spiel: {myPred.points_earned}
                      </div>
                    )}
                  </div>
                ) : (
                  /* --- Tipp-Formular für anstehende Spiele --- */
                  <div className="space-y-4">
                    {myPred && <p className="text-sm text-green-600 font-bold">✓ Du hast bereits getippt (kannst ihn noch ändern)</p>}
                    
                    <div className="flex gap-4">
                      <div className="w-1/2">
                         <label className="block text-xs text-gray-500 uppercase">{match.team_home} Tore</label>
                         <input type="number" min="0" className="w-full border p-2 rounded text-black" defaultValue={myPred?.pred_goals_home} onChange={(e) => handleInputChange(match.id, 'home', parseInt(e.target.value))} />
                      </div>
                      <div className="w-1/2">
                         <label className="block text-xs text-gray-500 uppercase">{match.team_away} Tore</label>
                         <input type="number" min="0" className="w-full border p-2 rounded text-black" defaultValue={myPred?.pred_goals_away} onChange={(e) => handleInputChange(match.id, 'away', parseInt(e.target.value))} />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-1/2">
                         <label className="block text-xs text-gray-500 uppercase">1. Torschütze</label>
                         <input type="text" className="w-full border p-2 rounded text-black" defaultValue={myPred?.pred_first_scorer} onChange={(e) => handleInputChange(match.id, 'scorer', e.target.value)} />
                      </div>
                      <div className="w-1/2">
                         <label className="block text-xs text-gray-500 uppercase">MOTM</label>
                         <input type="text" className="w-full border p-2 rounded text-black" defaultValue={myPred?.pred_motm} onChange={(e) => handleInputChange(match.id, 'motm', e.target.value)} />
                      </div>
                    </div>
                    
                    {isLocked ? (
                        <div className="w-full bg-gray-500 text-white font-bold py-2 rounded text-center cursor-not-allowed">
                            ⏳ Spiel läuft / Tipps gesperrt
                        </div>
                    ) : (
                        <button onClick={() => submitPrediction(match.id)} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">
                            Tipp speichern
                        </button>
                    )}

                    {/* --- ADMIN BEREICH (nur sichtbar wenn isAdmin === true) --- */}
                    {isAdmin && (
                       <div className="mt-6 p-4 border-2 border-yellow-400 bg-yellow-50 rounded">
                         <h3 className="text-yellow-800 font-bold mb-2">🛡️ Admin: Echtes Ergebnis eintragen</h3>
                         <p className="text-xs text-yellow-700 mb-2">Trage die Daten oben in die Felder ein und klicke dann hier, um das Spiel als "beendet" zu markieren. Die Punkte aller Spieler werden automatisch berechnet.</p>
                         <button onClick={() => submitRealResult(match)} className="w-full bg-yellow-500 text-white font-bold py-2 rounded hover:bg-yellow-600">
                           Ergebnis festsetzen & Punkte verteilen
                         </button>
                       </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}