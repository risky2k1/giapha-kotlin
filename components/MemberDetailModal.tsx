"use client";

import MemberDetailContent from "@/components/MemberDetailContent";
import { Person } from "@/types";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Edit2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "./DashboardContext";

export default function MemberDetailModal() {
  const { memberModalId: memberId, setMemberModalId } = useDashboard();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [person, setPerson] = useState<Person | null>(null);
  const [privateData, setPrivateData] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Close modal by removing query parameter while keeping others
  const closeModal = () => {
    setMemberModalId(null);
  };

  const fetchData = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        // 1. Check auth / role
        let currentIsAdmin = isAdmin;
        if (!authChecked) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .single();
            currentIsAdmin = profile?.role === "admin";
            setIsAdmin(currentIsAdmin);
          }
          setAuthChecked(true);
        }

        // 2. Fetch Person Public Data
        const { data: personData, error: personError } = await supabase
          .from("persons")
          .select("*")
          .eq("id", id)
          .single();

        if (personError || !personData) {
          throw new Error("Không thể tải thông tin thành viên.");
        }
        setPerson(personData);

        // 3. Fetch Private Data if Admin
        if (currentIsAdmin) {
          const { data: privData } = await supabase
            .from("person_details_private")
            .select("*")
            .eq("person_id", id)
            .single();
          setPrivateData(privData || {});
        }
      } catch (err) {
        console.error("Error fetching member details:", err);
        // @ts-expect-error - err is caught as unknown, but we check for message
        setError(err?.message || "Đã xảy ra lỗi hệ thống.");
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, authChecked, supabase],
  );

  // Sync state with URL parameter
  useEffect(() => {
    if (memberId) {
      setIsOpen(true);
      fetchData(memberId);
    } else {
      setIsOpen(false);
      // Clean up previous data when closing to prevent flash on next open
      setTimeout(() => {
        setPerson(null);
        setPrivateData(null);
        setError(null);
      }, 300);
    }
  }, [memberId, fetchData]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-stone-900/40 backdrop-blur-sm"
        >
          {/* Click-away backdrop */}
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={closeModal}
          ></div>

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-stone-200"
          >
            {/* Sticky Header Actions */}
            <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20 flex items-center gap-2">
              {isAdmin && person && (
                <Link
                  href={`/dashboard/members/${person.id}/edit`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-100/80 backdrop-blur-md text-amber-800 rounded-full hover:bg-amber-200 font-semibold text-sm shadow-sm border border-amber-200/50 transition-colors"
                  onClick={closeModal}
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Chỉnh sửa</span>
                </Link>
              )}
              <button
                onClick={closeModal}
                className="w-10 h-10 flex items-center justify-center bg-stone-100/80 backdrop-blur-md text-stone-600 rounded-full hover:bg-stone-200 hover:text-stone-900 shadow-sm border border-stone-200/50 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex-1 min-h-[400px] flex items-center justify-center flex-col gap-4">
                <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-stone-500 font-medium">Đang tải...</p>
              </div>
            ) : error ? (
              <div className="flex-1 min-h-[400px] flex items-center justify-center flex-col gap-4 p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <p className="text-red-600 font-medium text-lg">{error}</p>
                <button
                  onClick={closeModal}
                  className="mt-2 px-6 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-full transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            ) : person ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <MemberDetailContent
                  person={person}
                  privateData={privateData}
                  isAdmin={isAdmin}
                  onLinkClick={closeModal}
                />
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
