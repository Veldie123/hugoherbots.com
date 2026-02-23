import { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
import { videoApi } from "@/services/videoApi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Loader2, Users, Clock, CheckCircle2 } from "lucide-react";

interface UserProgress {
  user_id: string;
  name: string;
  email: string;
  totalVideosWatched: number;
  completedVideos: number;
  totalWatchTimeMinutes: number;
  lastActivity: string | null;
}

interface AdminProgressProps {
  navigate?: (page: string) => void;
}

export function AdminProgress({ navigate }: AdminProgressProps) {
  const [progressData, setProgressData] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProgress() {
      try {
        setLoading(true);
        setError(null);
        const data = await videoApi.getAdminProgress();
        setProgressData(data);
      } catch (err: any) {
        setError(err.message || "Er is een fout opgetreden bij het laden van de voortgang.");
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Geen activiteit";
    const date = new Date(dateString);
    return date.toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatWatchTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} uur ${remainingMinutes} min`;
  };

  const totalUsers = progressData.length;
  const totalCompleted = progressData.reduce((sum, p) => sum + p.completedVideos, 0);
  const totalWatchTime = progressData.reduce((sum, p) => sum + p.totalWatchTimeMinutes, 0);

  return (
    <AdminLayout currentPage="admin-progress" navigate={navigate}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-hh-ink">Voortgang Deelnemers</h1>
          <p className="text-hh-muted mt-1">
            Bekijk hoeveel video's elke deelnemer heeft bekeken en voltooid.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-hh-muted">Actieve Deelnemers</CardTitle>
              <Users className="h-4 w-4 text-hh-muted" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-hh-ink">{totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-hh-muted">Voltooide Video's</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-hh-ink">{totalCompleted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-hh-muted">Totale Kijktijd</CardTitle>
              <Clock className="h-4 w-4 text-hh-muted" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-hh-ink">{formatWatchTime(totalWatchTime)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overzicht per Deelnemer</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#9333ea' }} />
                <span className="ml-3 text-hh-muted">Voortgang wordt geladen...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 text-lg">{error}</p>
                <p className="text-hh-muted mt-2">
                  Probeer de pagina te vernieuwen. Neem contact op met ondersteuning als het probleem aanhoudt.
                </p>
              </div>
            ) : progressData.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-hh-muted mx-auto mb-4" />
                <p className="text-hh-muted text-lg">Nog geen deelnemers hebben video's bekeken.</p>
                <p className="text-hh-muted mt-1">
                  Zodra deelnemers beginnen met kijken, verschijnt hun voortgang hier.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Naam</TableHead>
                      <TableHead className="min-w-[200px]">E-mail</TableHead>
                      <TableHead className="text-center">Video's bekeken</TableHead>
                      <TableHead className="text-center">Voltooid</TableHead>
                      <TableHead className="text-center">Kijktijd</TableHead>
                      <TableHead className="min-w-[180px]">Laatste activiteit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {progressData.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-hh-muted">{user.email}</TableCell>
                        <TableCell className="text-center">{user.totalVideosWatched}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1">
                            {user.completedVideos}
                            {user.completedVideos > 0 && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{formatWatchTime(user.totalWatchTimeMinutes)}</TableCell>
                        <TableCell className="text-hh-muted">{formatDate(user.lastActivity)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
