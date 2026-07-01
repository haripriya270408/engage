'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  phone?: string;
}

interface Team {
  manager: TeamMember;
  reps: TeamMember[];
}

export default function TeamsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'ADMIN') {
      router.push('/dashboard/manager');
      return;
    }
    if (!loading && user) {
      fetchTeams();
    }
  }, [loading, user, router]);

  const fetchTeams = async () => {
    try {
      const { data } = await api.get('/teams/all');
      setTeams(data || []);
    } catch {
      toast.error('Failed to load teams');
    } finally {
      setPageLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground mb-6">Teams</h1>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-16 text-center">
          <p className="text-muted">No teams found. Approve managers to create teams.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {teams.map((team) => (
            <div key={team.manager.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-primary-light border-b border-border">
                <h2 className="text-lg font-semibold text-primary">
                  {team.manager.first_name} {team.manager.last_name}
                </h2>
                <p className="text-sm text-primary/70">{team.manager.email}</p>
              </div>
              {team.reps.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted border-b border-border bg-gray-50">
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.reps.map((rep) => (
                      <tr key={rep.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                        <td className="px-6 py-3.5 font-medium text-foreground">{rep.first_name} {rep.last_name}</td>
                        <td className="px-6 py-3.5 text-muted">{rep.email}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                            rep.status === 'ACTIVE' ? 'bg-green-50 text-success' : 'bg-yellow-50 text-warning'
                          }`}>
                            {rep.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-8 text-center text-muted text-sm">
                  No reps assigned yet
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
