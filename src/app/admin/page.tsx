"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Admin() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [userPredictions, setUserPredictions] = useState<any[]>([]);
  
  // Formular für neue Spiele
  const [newMatch, setNewMatch] = useState({ home: "", away: "", date: "", underdog: "" });

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/");

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
    if (!profile?.is_admin) return router.push("/dashboard"); // Wirft Nicht-Admins raus
    
    setIsAdmin(true);
    fetchMatches();
  };

  const fetchMatches = async () => {
    const { data } = await supabase.from('matches').select('*').order('match_date', { ascending: true });
    if (data) setMatches(data);
  };

  // --- SPIELE ERSTELLEN ---
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('matches').insert({
      team_home: newMatch.home,
      team_away: newMatch.away,
      match_date: new Date(newMatch.date).toISOString(),
      underdog_team: newMatch.underdog === "" ? null : newMatch.underdog,
      status: 'upcoming'
    });

    if (error) alert("Fehler: " + error.message);
    else {
      alert("Spiel erfolgreich erstellt!");
      setNewMatch({ home: "", away: "", date: "", underdog: "" });
      fetchMatches();
    }
  };

  // --- SPIELE LÖSCHEN ---
  const handleDeleteMatch = async (id: number) => {
    if (!confirm("Sicher, dass du dieses Spiel und ALLE dazugehörigen Tipps löschen willst?")) return;
    await supabase.from('matches').delete().eq('id', id);
    fetchMatches();
  };

  // --- TIPPS BEARBEITEN ---
  const loadPredictionsForMatch = async (match: any) => {
    setSelectedMatch(match);
    // Lädt die Tipps inkl. Benutzername
    const { data } = await supabase
      .from('predictions')
      .select('*, profiles(username)')
      .eq('match_id', match.id);
    if (data) setUserPredictions(data);
  };

  const updatePrediction = async (predId: number, field: string, value: any) => {
    await supabase.from('predictions').update({ [field]: value }).eq('id', predId);
    // State lokal updaten damit es flüssig wirkt
    setUserPredictions(prev => prev.map(p => p.id === predId ? { ...p, [field]: value } : p));
  };

  if (!isAdmin) return <p>Lade Admin-Bereich...</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-gray-800 text-white p-4 rounded-xl shadow">
          <h1 className="text-2xl font-bold">🛠️ Admin Zentrale</h1>
          <Link href="/dashboard" className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 font-bold">
            Zum Dashboard
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* LINKER BEREICH: Neues Spiel anlegen */}
          <div className="bg-white p-6 rounded-xl shadow border-t-4 border-green-500">
            <h2 className="text-xl font-bold mb-4">➕ Neues Spiel anlegen</h2>
            <form onSubmit={handleCreateMatch} className="space-y-4">
              <div className="flex gap-4">
                <input type="text" placeholder="Heim (z.B. Deutschland)" required className="w-1/2 border p-2 rounded text-black" value={newMatch.home} onChange={e => setNewMatch({...newMatch, home: e.target.value})} />
                <input type="text" placeholder="Auswärts (z.B. Brasilien)" required className="w-1/2 border p-2 rounded text-black" value={newMatch.away} onChange={e => setNewMatch({...newMatch, away: e.target.value})} />
              </div>
              <input type="datetime-local" required className="w-full border p-2 rounded text-black" value={newMatch.date} onChange={e => setNewMatch({...newMatch, date: e.target.value})} />
              
              <select className="w-full border p-2 rounded text-black" value={newMatch.underdog} onChange={e => setNewMatch({...newMatch, underdog: e.target.value})}>
                <option value="">Kein Underdog-Bonus für dieses Spiel</option>
                <option value="home">Heimteam ist Underdog (+1 Pkt)</option>
                <option value="away">Auswärtsteam ist Underdog (+1 Pkt)</option>
              </select>

              <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Spiel eintragen</button>
            </form>
          </div>

          {/* RECHTER BEREICH: Spiele verwalten & Tipps ändern */}
          <div className="bg-white p-6 rounded-xl shadow border-t-4 border-red-500 overflow-y-auto max-h-[600px]">
            <h2 className="text-xl font-bold mb-4">⚙️ Spiele verwalten & Tipps korrigieren</h2>
            {matches.map(match => (
              <div key={match.id} className="border-b py-3 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-800">{match.team_home} - {match.team_away}</p>
                  <p className="text-xs text-gray-500">{new Date(match.match_date).toLocaleString('de-DE')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadPredictionsForMatch(match)} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200">Tipps ansehen/ändern</button>
                  <button onClick={() => handleDeleteMatch(match.id)} className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200">Löschen</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BEREICH FÜR TIPPS-KORREKTUR (erscheint nur, wenn oben ein Spiel angeklickt wird) */}
        {selectedMatch && (
          <div className="mt-8 bg-white p-6 rounded-xl shadow border-2 border-blue-500">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold">Tipps korrigieren: {selectedMatch.team_home} vs {selectedMatch.team_away}</h2>
               <button onClick={() => setSelectedMatch(null)} className="text-gray-500 hover:text-black">✖ Schließen</button>
             </div>
             
             {userPredictions.length === 0 ? <p className="text-gray-500">Noch niemand hat für dieses Spiel getippt.</p> : (
               <table className="w-full text-left">
                 <thead>
                   <tr className="bg-gray-100 text-sm">
                     <th className="p-2">Spieler</th>
                     <th className="p-2">Tore Heim</th>
                     <th className="p-2">Tore Auswärts</th>
                     <th className="p-2">1. Torschütze</th>
                     <th className="p-2">MOTM</th>
                   </tr>
                 </thead>
                 <tbody>
                   {userPredictions.map(pred => (
                     <tr key={pred.id} className="border-b">
                       <td className="p-2 font-bold text-gray-700">{pred.profiles?.username}</td>
                       <td className="p-2"><input type="number" min="0" className="border p-1 w-16" value={pred.pred_goals_home} onChange={(e) => updatePrediction(pred.id, 'pred_goals_home', parseInt(e.target.value))} /></td>
                       <td className="p-2"><input type="number" min="0" className="border p-1 w-16" value={pred.pred_goals_away} onChange={(e) => updatePrediction(pred.id, 'pred_goals_away', parseInt(e.target.value))} /></td>
                       <td className="p-2"><input type="text" className="border p-1 w-32" value={pred.pred_first_scorer} onChange={(e) => updatePrediction(pred.id, 'pred_first_scorer', e.target.value)} /></td>
                       <td className="p-2"><input type="text" className="border p-1 w-32" value={pred.pred_motm} onChange={(e) => updatePrediction(pred.id, 'pred_motm', e.target.value)} /></td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
             <p className="text-xs text-green-600 mt-4">Änderungen werden sofort automatisch gespeichert!</p>
          </div>
        )}

      </div>
    </div>
  );
}