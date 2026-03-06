import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { $getErrorPeople } from '../server/fn/profiles';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const Route = createFileRoute('/wall-of-shame')({
  component: WallOfShamePage,
});

type ErrorPerson = {
  personSlug: string;
  url: string;
  statusCode: number | null;
  fetchedAt: string;
  title: string | null;
  name: string;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function WallOfShamePage() {
  const [people, setPeople] = useState<ErrorPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await $getErrorPeople();
        if (!cancelled) setPeople(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to directory
        </Link>
      </div>

      <h2 className="text-xl font-semibold">Wall of Shame</h2>
      <p className="text-sm text-muted-foreground">
        People whose /uses pages are currently returning errors or 404s.
        {people.length > 0 && (
          <> Found <strong className="text-foreground">{people.length}</strong> broken pages.</>
        )}
      </p>

      {people.length === 0 ? (
        <p className="text-muted-foreground">No broken pages found. Everyone is in good standing!</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Checked</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow key={person.personSlug}>
                <TableCell>
                  <Link
                    to="/people/$personSlug"
                    params={{ personSlug: person.personSlug }}
                    className="hover:underline"
                  >
                    {person.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {person.statusCode ? (
                    <Badge variant="destructive">{person.statusCode}</Badge>
                  ) : (
                    <Badge variant="destructive">error</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {timeAgo(person.fetchedAt)}
                </TableCell>
                <TableCell className="max-w-[400px] truncate">
                  <a
                    href={person.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:underline text-sm"
                  >
                    {person.url}
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
