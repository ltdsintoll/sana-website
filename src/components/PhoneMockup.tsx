"use client";

import { motion } from "framer-motion";

export default function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative mx-auto h-[580px] w-[280px] md:h-[660px] md:w-[320px]"
    >
      <div className="bg-ink absolute inset-0 rounded-[48px] p-3 shadow-2xl">
        <div className="from-accent-soft relative h-full w-full overflow-hidden rounded-[36px] bg-gradient-to-b to-white">
          <div className="bg-ink absolute top-0 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl" />

          <div className="flex flex-col items-center px-6 pt-12">
            <div className="text-text-muted mt-4 text-xs tracking-widest uppercase">
              Sana
            </div>
            <div className="text-text mt-1 text-sm font-light">Day 14 · Ovulation</div>

            <div className="relative mt-8 h-44 w-44">
              <svg
                viewBox="0 0 100 100"
                className="h-full w-full -rotate-90"
                aria-hidden
              >
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#EDE9FB"
                  strokeWidth="6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#8B7FD6"
                  strokeWidth="6"
                  strokeDasharray="276"
                  strokeDashoffset="138"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-text text-4xl font-light">14</div>
                <div className="text-text-muted mt-1 text-xs">of 28</div>
              </div>
            </div>

            <div className="mt-8 w-full space-y-3">
              <div className="border-border flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
                <div className="bg-accent-soft h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <div className="bg-surface-soft h-2 w-3/4 rounded" />
                  <div className="bg-surface-soft mt-1.5 h-2 w-1/2 rounded" />
                </div>
              </div>
              <div className="border-border flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
                <div className="bg-accent-soft h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <div className="bg-surface-soft h-2 w-2/3 rounded" />
                  <div className="bg-surface-soft mt-1.5 h-2 w-1/3 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-accent-soft/40 absolute -inset-8 -z-10 rounded-full blur-3xl" />
    </motion.div>
  );
}
