"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
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
  const [existingStudentId, setExistingStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!editingId) {
      setExistingStudentId("");
      setFirstName("");
      setMiddleName("");
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
        setExistingStudentId(s.studentId);
        setFirstName(s.firstName);
        setMiddleName(s.middleName ?? "");
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
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("All fields are required.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiUpdateStudent(editingId, { firstName, middleName, lastName, email });
      } else {
        await apiCreateStudent({ firstName, middleName, lastName, email });
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
  const year = new Date().getFullYear();

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      wide
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
        <div className="grid min-w-0 gap-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {isAdmin && editingId ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Student ID</span>
              <input
                value={existingStudentId}
                readOnly
                className="rounded-lg border border-[#cbd5e1] bg-[#f8f9fc] px-3 py-2 font-mono text-[#2d3748]"
              />
            </label>
          ) : null}
          {isAdmin && !editingId ? (
            <p className="text-xs text-[#2d3748]/70">
              Student ID is generated automatically (e.g. {year}-4821-A).
            </p>
          ) : null}
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">First name</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="min-w-0 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Middle name</span>
              <input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Optional"
                className="min-w-0 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Last name</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="min-w-0 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
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
