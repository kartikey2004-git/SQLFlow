"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@sql-learn/ui/components/button";

interface ResetSandboxButtonProps {
  disabled?: boolean;
  resetting: boolean;
  onReset: () => void;
}

export function ResetSandboxButton({ disabled, resetting, onReset }: ResetSandboxButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (resetting) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="size-4 animate-spin" />
        Resetting...
      </Button>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm" role="alertdialog" aria-label="Confirm sandbox reset">
        <span className="text-neutral-600">Erase all your changes to this database?</span>
        <Button
          variant="outline"
          className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          onClick={() => {
            setConfirming(false);
            onReset();
          }}
        >
          Yes, reset
        </Button>
        <Button variant="outline" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" disabled={disabled} onClick={() => setConfirming(true)}>
      Reset sandbox
    </Button>
  );
}
