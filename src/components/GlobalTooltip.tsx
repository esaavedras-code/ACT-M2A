"use client";
import React, { useEffect, useState, useRef } from 'react';

export default function GlobalTooltip() {
    const [tooltipData, setTooltipData] = useState<{ text: string, x: number, y: number } | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const activeElementRef = useRef<HTMLElement | null>(null);
    const originalTitleRef = useRef<string>("");

    useEffect(() => {
        const handleMouseOver = (e: MouseEvent) => {
            // Find closest element with a title attribute
            const target = (e.target as HTMLElement).closest('[title]') as HTMLElement;
            if (!target) return;
            
            const titleText = target.getAttribute('title');
            if (!titleText) return;

            // Save original title and remove it to prevent native OS tooltip
            originalTitleRef.current = titleText;
            target.setAttribute('data-original-title', titleText);
            target.removeAttribute('title');
            activeElementRef.current = target;

            // Clear any existing timeout
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            // Set 2 second delay (2000ms)
            timeoutRef.current = setTimeout(() => {
                const rect = target.getBoundingClientRect();
                setTooltipData({
                    text: originalTitleRef.current,
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 8 // offset below the element
                });
            }, 2000);
        };

        const handleMouseOut = (e: MouseEvent) => {
            if (activeElementRef.current) {
                // Restore original title so it can trigger again
                if (originalTitleRef.current) {
                    activeElementRef.current.setAttribute('title', originalTitleRef.current);
                }
                activeElementRef.current.removeAttribute('data-original-title');
            }
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setTooltipData(null);
            activeElementRef.current = null;
            originalTitleRef.current = "";
        };

        const handleMouseDown = () => {
            // Hide tooltip when clicking
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setTooltipData(null);
        };

        // Use event delegation on the document body
        document.body.addEventListener('mouseover', handleMouseOver);
        document.body.addEventListener('mouseout', handleMouseOut);
        document.body.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('scroll', handleMouseDown, true);

        return () => {
            document.body.removeEventListener('mouseover', handleMouseOver);
            document.body.removeEventListener('mouseout', handleMouseOut);
            document.body.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', handleMouseDown, true);
        };
    }, []);

    if (!tooltipData) return null;

    return (
        <div 
            className="fixed z-[9999] px-3 py-2 text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 animate-in fade-in duration-200 border border-slate-600/50 break-words"
            style={{ 
                left: tooltipData.x, 
                top: tooltipData.y, 
                maxWidth: '250px', 
                textAlign: 'center' 
            }}
        >
            {tooltipData.text}
            {/* Tooltip Arrow */}
            <div className="absolute -top-1 left-1/2 -ml-1 w-2 h-2 bg-slate-800 dark:bg-slate-700 rotate-45 border-t border-l border-slate-600/50"></div>
        </div>
    );
}
