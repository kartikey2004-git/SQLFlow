"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@sql-learn/ui/components/button";
import { Alert, AlertDescription } from "@sql-learn/ui/components/alert";
import { Badge } from "@sql-learn/ui/components/badge";

interface SessionRow {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const describeUserAgent = (userAgent?: string | null): string => {
  if (!userAgent) return "Unknown device";
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/Chrome\//.test(userAgent)) return "Chrome";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "Unknown browser";
};

export default function SessionsSettingsPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const load = useCallback(async () => {
    const [{ data: session }, { data: list, error: listError }] = await Promise.all([
      authClient.getSession(),
      authClient.listSessions(),
    ]);
    setCurrentToken(session?.session.token ?? null);
    if (listError) {
      setError(listError.message ?? "Failed to load sessions");
      return;
    }
    setSessions(list ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const handleRevoke = async (token: string) => {
    setError(null);
    setBusyToken(token);
    try {
      const { error: revokeError } = await authClient.revokeSession({ token });
      if (revokeError) {
        setError(revokeError.message ?? "Failed to revoke session");
        return;
      }
      await load();
    } finally {
      setBusyToken(null);
    }
  };

  const handleRevokeOthers = async () => {
    setError(null);
    setRevokingOthers(true);
    try {
      const { error: revokeError } = await authClient.revokeOtherSessions();
      if (revokeError) {
        setError(revokeError.message ?? "Failed to revoke other sessions");
        return;
      }
      await load();
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Active sessions</h2>
        {(sessions?.length ?? 0) > 1 && (
          <Button type="button" size="sm" variant="outline" disabled={revokingOthers} onClick={handleRevokeOthers}>
            Log out all other devices
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="destructive" className="border-red-900/50 bg-red-950/40">
          <AlertDescription className="text-red-300">{error}</AlertDescription>
        </Alert>
      )}
      {sessions === null ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => {
            const isCurrent = session.token === currentToken;
            return (
              <li
                key={session.id}
                className="flex items-center justify-between rounded-md border border-surface-dark-border bg-surface-dark-alt px-4 py-3"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{describeUserAgent(session.userAgent)}</span>
                    {isCurrent && <Badge>Current session</Badge>}
                  </div>
                  <span className="text-xs text-gray-400">
                    {session.ipAddress ? `${session.ipAddress} · ` : ""}
                    Last active {session.updatedAt.toLocaleString()}
                  </span>
                </div>
                {!isCurrent && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyToken === session.token}
                    onClick={() => handleRevoke(session.token)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
