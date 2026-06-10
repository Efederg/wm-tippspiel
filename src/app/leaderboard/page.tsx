"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    // Holt alle registrierten Spieler
    const { data: profiles } = await supabase.from('profiles').select('*');
    // Holt alle getätigten Tipps aller Spieler
    const { data: predictions } = await supabase.from('predictions').select('*');

    if (profiles && predictions) {
      const scores = profiles.map(profile => {
        // Filtert alle Tipps für den jeweiligen User
        const userPreds = predictions.filter(p => p.user_id === profile.id);
        // Addiert die Punkte aller Tipps zusammen
        const totalPoints = userPreds.reduce((sum, p) => sum + p.points_earned, 0);
        
        return { username: profile.username, points: totalPoints };
      });

      // Sortiert die Liste absteigend nach Punkten
      scores.sort((a, b) => b.points - a.points);
      setLeaderboard(scores);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow">
          <h1 className="text-2xl font-bold text-gray-800">🏆 Rangliste</h1>
          <Link href="/dashboard" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-bold">
            Zurück zu den Spielen
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-gray-500">Punkte werden berechnet...</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-200 text-gray-700">
                  <th className="p-4 border-b font-bold">Platz</th>
                  <th className="p-4 border-b font-bold">Spieler</th>
                  <th className="p-4 border-b font-bold text-right">Punkte</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((user, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-4 border-b font-bold text-gray-500">
                      {index === 0 ? '🥇 1.' : index === 1 ? '🥈 2.' : index === 2 ? '🥉 3.' : `${index + 1}.`}
                    </td>
                    <td className="p-4 border-b font-bold text-gray-800">{user.username}</td>
                    <td className="p-4 border-b font-bold text-right text-blue-600 text-xl">{user.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}