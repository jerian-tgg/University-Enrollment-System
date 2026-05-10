"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { apiCreateStudent, apiGetStudent, apiUpdateStudent } from "@/lib/api/client";

export function StudentFormModal({
  open,
  onClose,
  editingId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  onSaved: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!editingId) {
      setStudentId("");
      setFirstName("");
      setLastName("");
      setEmail("");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await apiGetStudent(editingId);
        if (cancelled) return;
        setStudentId(s.studentId);
        setFirstName(s.firstName);
        setLastName(s.lastName);
        setEmail(s.email);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load student");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, editingId]);

  async function submit() {
    setError(null);
    if (!studentId.trim() || !firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("All fields are required.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiUpdateStudent(editingId, { studentId, firstName, lastName, email });
      } else {
        await apiCreateStudent({ studentId, firstName, lastName, email });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const title = editingId ? "Edit student" : "Add student";

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
            className="rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#2d3748] hover:bg-[#f8f9fc]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e4d8c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a3a6b] disabled:opacity-50"
          >
            {saving ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : null}
            Save
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#2d3748]">
          <Spinner />
          Loading…
        </div>
      ) : (
        <div className="grid gap-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#2d3748]">Student ID</span>
            <input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              autoComplete="off"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">First name</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Last name</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#2d3748]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
