import type { ReactNode } from "react";

// Small, reusable building blocks for rendering a numbered legal document
// (Terms, Privacy Policy, etc.) inside LegalPage's content slot. Plain
// typography only, no color/gradient flourish, consistent with LegalPage's
// "this is a document, not a landing page" intent.

export function LegalSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">
        {number}. {title}
      </h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 font-semibold text-slate-900">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? "border-b border-slate-100" : ""}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalContact({ name, email }: { name: string; email: string }) {
  return (
    <p>
      <span className="block font-semibold text-slate-900">{name}</span>
      <a href={`mailto:${email}`} className="text-teal-600 transition hover:underline">
        {email}
      </a>
    </p>
  );
}
