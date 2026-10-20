import { ImageResponse } from "next/og";

const FILES = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const spec = FILES[file as keyof typeof FILES];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, maskable } = spec;
  // Maskable icons keep the glyph inside the 80% safe zone and fill the canvas.
  const glyph = Math.round(size * (maskable ? 0.42 : 0.56));
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
          fontSize: glyph,
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
