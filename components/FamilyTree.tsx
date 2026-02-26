"use client";

import React, { useEffect, useRef, useState } from "react";

import { Person, Relationship } from "@/types";
import FamilyNodeCard from "./FamilyNodeCard";

interface SpouseData {
  person: Person;
  note?: string | null;
}

export default function FamilyTree({
  personsMap,
  relationships,
  roots,
}: {
  personsMap: Map<string, Person>;
  relationships: Relationship[];
  roots: Person[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const hasDraggedRef = useRef(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  useEffect(() => {
    // Center the scroll area horizontally on initial render
    if (containerRef.current) {
      const el = containerRef.current;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }
  }, [roots]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPressed(true);
    hasDraggedRef.current = false;
    setDragStart({ x: e.pageX, y: e.pageY });
    if (containerRef.current) {
      setScrollStart({
        left: containerRef.current.scrollLeft,
        top: containerRef.current.scrollTop,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPressed || !containerRef.current) return;

    // Only start dragging if moved a bit to allow simple clicks
    const dx = e.pageX - dragStart.x;
    const dy = e.pageY - dragStart.y;

    if (!hasDraggedRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      setIsDragging(true);
      hasDraggedRef.current = true;
    }

    if (hasDraggedRef.current) {
      e.preventDefault();
      containerRef.current.scrollLeft = scrollStart.left - dx;
      containerRef.current.scrollTop = scrollStart.top - dy;
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsPressed(false);
    setIsDragging(false);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    // Intercept clicks if we were dragging, prevent links from opening
    if (hasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDraggedRef.current = false;
    }
  };

  // Helper function to resolve tree connections for a person
  const getTreeData = (personId: string) => {
    const spousesList: SpouseData[] = relationships
      .filter(
        (r) =>
          r.type === "marriage" &&
          (r.person_a === personId || r.person_b === personId),
      )
      .map((r) => {
        const spouseId = r.person_a === personId ? r.person_b : r.person_a;
        return {
          person: personsMap.get(spouseId)!,
          note: r.note,
        };
      })
      .filter((s) => s.person);

    const childRels = relationships.filter(
      (r) =>
        (r.type === "biological_child" || r.type === "adopted_child") &&
        r.person_a === personId,
    );

    const childrenList = (
      childRels
        .map((r) => personsMap.get(r.person_b))
        .filter(Boolean) as Person[]
    ).sort((a, b) => {
      // 1. birth_order ascending (null → pushed to end)
      const aOrder = a.birth_order ?? Infinity;
      const bOrder = b.birth_order ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // 2. birth_year ascending (null → pushed to end)
      const aYear = a.birth_year ?? Infinity;
      const bYear = b.birth_year ?? Infinity;
      return aYear - bYear;
    });

    // If there is only one spouse, or NO spouse, we can just lump all children together.
    // Standard family trees often combine all children under the main node
    // for simplicity of drawing, especially when dealing with CSS-based trees.
    return {
      person: personsMap.get(personId)!,
      spouses: spousesList,
      children: childrenList,
    };
  };

  // Recursive function for rendering nodes
  // Tracks visited IDs to prevent infinite loops from circular relationships
  const renderTreeNode = (
    personId: string,
    visited: Set<string> = new Set(),
  ): React.ReactNode => {
    if (visited.has(personId)) return null; // cycle guard
    visited.add(personId);

    const data = getTreeData(personId);
    if (!data.person) return null;

    return (
      <li>
        <div className="node-container inline-flex flex-col items-center">
          {/* Main Person & Spouses Row */}
          <div className="flex relative z-10 bg-white rounded-2xl shadow-md border border-stone-200/80 transition-opacity">
            <FamilyNodeCard person={data.person} isMainNode={true} />

            {data.spouses.length > 0 && (
              <>
                {/* <div className="mt-6 size-5 sm:w-6 sm:h-6 rounded-full shadow-sm bg-white border border-stone-200 z-20 flex items-center justify-center text-[10px] sm:text-xs">
                  💍
                </div> */}
                {data.spouses.map((spouseData, idx) => (
                  <div key={spouseData.person.id} className="flex relative">
                    <FamilyNodeCard
                      isRingVisible={idx === 0}
                      isPlusVisible={idx > 0}
                      person={spouseData.person}
                      role={
                        spouseData.person.gender === "male" ? "Chồng" : "Vợ"
                      }
                      note={spouseData.note}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Render Children (if any) */}
        {data.children.length > 0 && (
          <ul>
            {data.children.map((child) => (
              <React.Fragment key={child.id}>
                {renderTreeNode(child.id, new Set(visited))}
              </React.Fragment>
            ))}
          </ul>
        )}
      </li>
    );
  };

  if (roots.length === 0)
    return (
      <div className="text-center p-10 text-stone-500">
        Không tìm thấy dữ liệu.
      </div>
    );

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-auto bg-stone-50 ${isPressed ? "cursor-grabbing" : "cursor-grab"}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onClickCapture={handleClickCapture}
      onDragStart={(e) => e.preventDefault()} // Prevent browser default dragging of links/images
    >
      {/* We use a style block to inject the CSS logic for the family tree lines */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .css-tree ul {
          padding-top: 30px; 
          position: relative;
          display: flex;
          justify-content: center;
          padding-left: 0;
        }

        .css-tree li {
          float: left; text-align: center;
          list-style-type: none;
          position: relative;
          padding: 30px 5px 0 5px;
        }

        /* Connecting lines */
        .css-tree li::before, .css-tree li::after {
          content: '';
          position: absolute; top: 0; right: 50%;
          border-top: 2px solid #d6d3d1;
          width: 50%; height: 30px;
        }
        .css-tree li::after {
          right: auto; left: 50%;
          border-left: 2px solid #d6d3d1;
        }

        /* Remove left-right connectors from elements without siblings */
        .css-tree li:only-child::after {
          display: none;
        }
        .css-tree li:only-child::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid #d6d3d1;
          width: 0;
          height: 30px;
        }

        /* Remove top connector from first child */
        .css-tree ul:first-child > li {
          padding-top: 0px;
        }
        .css-tree ul:first-child > li::before {
          display: none;
        }

        /* Remove left connector from first child and right connector from last child */
        .css-tree li:first-child::before, .css-tree li:last-child::after {
          border: 0 none;
        }

        /* Add back the vertical connector to the last nodes */
        .css-tree li:last-child::before {
          border-right: 2px solid #d6d3d1;
          border-radius: 0 12px 0 0;
        }
        .css-tree li:first-child::after {
          border-radius: 12px 0 0 0;
        }

        /* Downward connectors from parents */
        .css-tree ul ul::before {
          content: '';
          position: absolute; top: 0; left: 50%;
          border-left: 2px solid #d6d3d1;
          width: 0; height: 30px;
        }
      `,
        }}
      />

      {/* 
        Use w-max to prevent wrapping and allow scrolling. 
        mx-auto centers it if smaller than screen. 
        p-8 adds padding inside scroll area.
      */}
      <div
        id="export-container"
        className={`w-max min-w-full mx-auto p-4 css-tree transition-opacity duration-200 ${isDragging ? "opacity-90" : ""}`}
      >
        <ul>
          {roots.map((root) => (
            <React.Fragment key={root.id}>
              {renderTreeNode(root.id)}
            </React.Fragment>
          ))}
        </ul>
      </div>
    </div>
  );
}
