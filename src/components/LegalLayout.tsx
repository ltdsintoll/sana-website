import type { ReactNode } from "react";

type Props = {
  title: string;
  updated: string;
  children: ReactNode;
};

export default function LegalLayout({ title, updated, children }: Props) {
  return (
    <main className="py-20 md:py-28">
      <article className="mx-auto max-w-3xl px-6">
        <header className="border-border mb-12 border-b pb-8">
          <h1 className="text-text text-4xl font-light tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="text-text-subtle mt-3 text-sm">{updated}</p>
        </header>

        <div className="prose-sana">{children}</div>
      </article>
    </main>
  );
}
