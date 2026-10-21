import { ImageResponse } from "next/og";
import { SPLASH_SCREENS, splashFile } from "@/cabinet/lib/splash";

type Spec =
  | { kind: "icon"; size: number; maskable: boolean }
  | { kind: "badge"; size: number }
  | { kind: "splash"; width: number; height: number };

const FILES: Record<string, Spec> = {
  "icon-192.png": { kind: "icon", size: 192, maskable: false },
  "icon-512.png": { kind: "icon", size: 512, maskable: false },
  "maskable-512.png": { kind: "icon", size: 512, maskable: true },
  // Android status-bar badge: white glyph on transparent.
  "badge-96.png": { kind: "badge", size: 96 },
  ...Object.fromEntries(SPLASH_SCREENS.map((s) => [splashFile(s), { kind: "splash", width: s.w * s.r, height: s.h * s.r } as Spec])),
};

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

function glyph(size: number, radius: number) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #8B7FD6, #6B5FB8)",
        borderRadius: radius,
        color: "#fff",
        fontSize: Math.round(size * 0.56),
        fontWeight: 600,
        letterSpacing: "-0.04em",
      }}
    >
      S
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const spec = FILES[file];
  if (!spec) return new Response("Not found", { status: 404 });

  if (spec.kind === "badge") {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 76, fontWeight: 700 }}>
          S
        </div>
      ),
      { width: spec.size, height: spec.size },
    );
  }

  if (spec.kind === "splash") {
    const icon = Math.round(Math.min(spec.width, spec.height) * 0.26);
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f6fb" }}>
          {glyph(icon, Math.round(icon * 0.22))}
        </div>
      ),
      { width: spec.width, height: spec.height },
    );
  }

  const { size, maskable } = spec;
  // Maskable icons keep the glyph inside the 80% safe zone and fill the canvas.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #8B7FD6, #6B5FB8)",
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
          color: "#fff",
          fontSize: Math.round(size * (maskable ? 0.42 : 0.56)),
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        S
      </div>
    ),
    { width: size, height: size },
  );
}
