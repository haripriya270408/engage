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
}

interface TeamData {
  manager: TeamMember;
  reps: TeamMember[];
}

export default function MyTeamPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'MANAGER') {
      router.push('/dashboard/admin');
      return;
    }
    if (!loading && user) {
      fetchTeam();
    }
  }, [loading, user, router]);

  const fetchTeam = async () => {
    try {
      const { data } = await api.get('/teams/my-team');
      setTeam(data);
    } catch {
      toast.error('Failed to load team');
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
      <h1 className="text-2xl font-semibold text-foreground mb-6">My Team</h1>

      {!team || team.reps.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-16 text-center">
          <p className="text-muted">No team members assigned yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
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
        </div>
      )}
    </>
  );
}
