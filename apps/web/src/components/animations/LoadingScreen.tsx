"use client";

import { useState, useEffect } from "react";

export function LoadingScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 100);

    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center">
      <div className="w-16 h-16 mb-8 relative">
        <div className="absolute inset-0 border border-blue-500/30 rounded-full animate-ping" />
        <div className="absolute inset-2 border border-blue-500/50 rounded-full animate-pulse" />
        <div className="absolute inset-4 bg-blue-500 rounded-full" />
      </div>

      <div className="w-48 h-px bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <p className="mt-4 text-xs mono text-zinc-600 uppercase tracking-widest">
        Initializing
      </p>
    </div>
  );
}
