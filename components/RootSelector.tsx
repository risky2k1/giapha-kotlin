"use client";

import { Person } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDashboard } from "./DashboardContext";

export default function RootSelector({
  persons,
  currentRootId,
}: {
  persons: Person[];
  currentRootId: string;
}) {
  const { setRootId } = useDashboard();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Default to finding the current root person
  const currentRootPerson = persons.find((p) => p.id === currentRootId);

  const filteredPersons = persons.filter((p) =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelect = (personId: string) => {
    setRootId(personId);
    setIsOpen(false);
    setSearchTerm("");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full sm:w-64" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-white/60 backdrop-blur-md border rounded-xl px-3.5 py-2.5 text-sm shadow-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 group
          ${isOpen ? "border-amber-300 bg-white shadow-md ring-2 ring-amber-500/10" : "border-stone-200/60 hover:border-amber-300 hover:bg-white/90 hover:shadow-md"}`}
      >
        <span className="truncate text-stone-800 font-medium select-none">
          Gốc:{" "}
          {currentRootPerson ? currentRootPerson.full_name : "Chọn người..."}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChevronDown
            className={`w-4 h-4 transition-colors ${isOpen ? "text-amber-600" : "text-stone-400 group-hover:text-stone-600"}`}
          />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-xl border border-stone-200/80 rounded-xl shadow-xl max-h-80 flex flex-col overflow-hidden ring-1 ring-black/5"
          >
            <div className="p-2 border-b border-stone-100/80 bg-stone-50/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  className="w-full text-stone-900 placeholder-stone-400 bg-white border border-stone-200/80 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all shadow-sm"
                  placeholder="Tìm thành viên..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
              {filteredPersons.length > 0 ? (
                <div className="space-y-0.5">
                  {filteredPersons.map((person) => {
                    const isSelected = person.id === currentRootId;
                    return (
                      <button
                        key={person.id}
                        onClick={() => handleSelect(person.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group/item
                          ${
                            isSelected
                              ? "bg-amber-50 text-amber-900 border border-amber-200/50 shadow-sm"
                              : "text-stone-700 hover:bg-stone-100/80 border border-transparent"
                          }`}
                      >
                        <span
                          className={`truncate ${isSelected ? "font-semibold" : "font-medium group-hover/item:text-stone-900"}`}
                        >
                          {person.full_name}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mb-1">
                    <Search className="w-5 h-5 text-stone-300" />
                  </div>
                  <div className="text-sm font-medium text-stone-600">
                    Không tìm thấy kết quả
                  </div>
                  <div className="text-xs text-stone-400">
                    Thử tìm với tên khác
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
