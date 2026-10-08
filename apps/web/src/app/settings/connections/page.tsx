"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@sql-learn/ui/components/button";
import { Alert, AlertDescription } from "@sql-learn/ui/components/alert";
import { Badge } from "@sql-learn/ui/components/badge";

interface LinkedAccount {
  id: string;
  providerId: string;
  createdAt: Date;
}

const PROVIDER_LABELS: Record<string, string> = {
  credential: "Email / Password",
  google: "Google",
  github: "GitHub",
};

export default function ConnectionsSettingsPage() {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: listError } = await authClient.listAccounts();
    if (listError) {
      setError(listError.message ?? "Failed to load connected accounts");
      return;
    }
    setAccounts(data ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const handleUnlink = async (accountId: string, providerId: string) => {
    setError(null);
    setBusyProviderId(providerId);
    try {
      const { error: unlinkError } = await authClient.unlinkAccount({ accountId });
      if (unlinkError) {
        setError(unlinkError.message ?? "Failed to disconnect");
        return;
      }
      await load();
    } finally {
      setBusyProviderId(null);
    }
  };

  const handleLink = async (provider: "google" | "github") => {
    setError(null);
    setBusyProviderId(provider);
    await authClient.linkSocial({ provider, callbackURL: `${window.location.origin}/settings/connections` });
  };

  const connectedProviderIds = new Set((accounts ?? []).map((a) => a.providerId));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium text-neutral-900">Connected accounts</h2>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {accounts === null ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-900">
                  {PROVIDER_LABELS[account.providerId] ?? account.providerId}
                </span>
                <Badge variant="secondary">Connected</Badge>
              </div>
              {account.providerId !== "credential" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyProviderId === account.providerId}
                  onClick={() => handleUnlink(account.id, account.providerId)}
                >
                  Disconnect
                </Button>
              )}
            </li>
          ))}

          {(["google", "github"] as const)
            .filter((provider) => !connectedProviderIds.has(provider))
            .map((provider) => (
              <li
                key={provider}
                className="flex items-center justify-between rounded-md border border-dashed border-neutral-200 px-4 py-3"
              >
                <span className="text-sm text-neutral-500">{PROVIDER_LABELS[provider]}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyProviderId === provider}
                  onClick={() => handleLink(provider)}
                >
                  Connect
                </Button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
