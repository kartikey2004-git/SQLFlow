"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@sql-learn/ui/components/button";
import { Input } from "@sql-learn/ui/components/input";
import { Label } from "@sql-learn/ui/components/label";
import { Alert, AlertDescription } from "@sql-learn/ui/components/alert";
import { Separator } from "@sql-learn/ui/components/separator";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, refresh, logout } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [nameSubmitting, setNameSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameStatus(null);
    setNameSubmitting(true);
    try {
      const { error } = await authClient.updateUser({ name: displayName });
      setNameStatus(error ? (error.message ?? "Failed to update name") : "Saved.");
      if (!error) await refresh();
    } finally {
      setNameSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    setPasswordSubmitting(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        setPasswordStatus(error.message ?? "Failed to change password");
      } else {
        setPasswordStatus("Password changed. Other sessions were signed out.");
        setCurrentPassword("");
        setNewPassword("");
      }
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      const { error } = await authClient.deleteUser({ password: deletePassword });
      if (error) {
        setDeleteError(error.message ?? "Failed to delete account");
        return;
      }
      await logout();
      router.push("/login");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={handleNameSubmit} className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-neutral-900">Profile</h2>
        {nameStatus && <p className="text-sm text-neutral-500">{nameStatus}</p>}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName" className="text-neutral-700">
            Display name
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-neutral-700">Email</Label>
          <p className="mt-1 text-sm text-neutral-500">{user?.email}</p>
        </div>
        <Button type="submit" disabled={nameSubmitting} className="w-fit">
          Save
        </Button>
      </form>

      <Separator />

      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-neutral-900">Change password</h2>
        {passwordStatus && (
          <Alert>
            <AlertDescription>{passwordStatus}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currentPassword" className="text-neutral-700">
            Current password
          </Label>
          <Input
            id="currentPassword"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword" className="text-neutral-700">
            New password
          </Label>
          <Input
            id="newPassword"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={passwordSubmitting} className="w-fit">
          Change password
        </Button>
      </form>

      <Separator />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-red-600">Delete account</h2>
        <p className="text-sm text-neutral-500">
          This permanently deletes your account and cannot be undone.
        </p>
        {deleteError && (
          <Alert variant="destructive">
            <AlertDescription>{deleteError}</AlertDescription>
          </Alert>
        )}
        {confirmingDelete ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deletePassword" className="text-neutral-700">
                Confirm your password to delete your account
              </Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={deleteSubmitting || !deletePassword}
                onClick={handleDelete}
              >
                {deleteSubmitting ? "Deleting..." : "Permanently delete account"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            className="w-fit"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete account
          </Button>
        )}
      </div>
    </div>
  );
}
