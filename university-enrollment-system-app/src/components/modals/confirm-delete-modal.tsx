"use client";

import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";

export function ConfirmDeleteModal({
  open,
  title,
  message,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  busy: boolean;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#2d3748] hover:bg-[#f8f9fc] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : null}
            Delete
          </button>
        </>
      }
    >
      <p className="text-sm text-[#2d3748]">{message}</p>
    </Modal>
  );
}
