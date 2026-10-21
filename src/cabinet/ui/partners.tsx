"use client";

import { ChevronRight, Copy, HeartHandshake, Share2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { ApiError, api } from "../api/client";
import { OWNER_PERMISSIONS, type OwnerPartnerLink, type OwnerPermission, type PartnerOfLink } from "../api/types";
import { setSelectedPartner } from "../state/selectedDay";
import { Button, Card, Sheet, Spinner, Switch } from "./primitives";
import { useUI } from "./ui-context";

const MAX_INVITES = 5;

/** Only links of this site / Telegram are shown and shared. */
function safeShareUrl(v: string): string | null {
  try {
    const u = new URL(v);
    if (u.protocol === "https:" || (u.protocol === "http:" && u.hostname === "localhost")) return u.toString();
  } catch {
    /* invalid */
  }
  return null;
}

async function shareOrCopy(url: string, title: string, text: string): Promise<"shared" | "copied" | "failed"> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share && /Android|iPhone|iPad/.test(navigator.userAgent)) {
    try {
      await nav.share({ title, text, url });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Settings -> Partner: invites and what each partner may see (contract 10, owner side). */
export function PartnersCard() {
  const t = useTranslations("cab.partners");
  const tc = useTranslations("cab");
  const ui = useUI();
  const [links, setLinks] = useState<OwnerPartnerLink[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<OwnerPartnerLink | null>(null);
  const [editing, setEditing] = useState<OwnerPartnerLink | null>(null);

  const load = useCallback(
    () =>
      api.partners().then(
        (r) => {
          setLinks(r.links);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    try {
      const r = await api.createPartner(label.trim() || undefined);
      setCreating(false);
      setLabel("");
      setCreated(r.link);
      await load();
    } catch (e) {
      ui.toast(e instanceof ApiError && e.code === "limit_reached" ? t("limit", { max: MAX_INVITES }) : tc("errors.generic"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function share(link: OwnerPartnerLink) {
    const url = safeShareUrl(link.webShareUrl);
    if (!url) return;
    const r = await shareOrCopy(url, "Sana", t("shareText"));
    if (r === "copied") ui.toast(t("copied"));
    else if (r === "failed") ui.toast(t("copyFailed"), { tone: "error" });
  }

  async function revoke(link: OwnerPartnerLink) {
    const ok = await ui.confirm({
      title: link.accepted ? t("revokeTitle") : t("revokeInviteTitle"),
      body: link.accepted ? t("revokeBody", { name: nameOf(link) }) : t("revokeInviteBody"),
      confirmLabel: t("revoke"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.revokePartner(link.partnerUuid);
      setEditing(null);
      await load();
      ui.toast(t("revoked"));
    } catch {
      ui.toast(tc("errors.generic"), { tone: "error" });
    }
  }

  function nameOf(l: OwnerPartnerLink): string {
    return l.partner?.firstName || (l.partner?.username ? `@${l.partner.username}` : null) || l.label || t("unnamed");
  }

  return (
    <Card>
      <p className="text-sm text-c-muted">{t("intro")}</p>
      {failed ? <p className="mt-2 text-sm text-c-muted">{tc("errors.offlineFeature")}</p> : null}
      {links === null && !failed ? <Spinner className="mt-3 text-c-accent" /> : null}
      {links && links.length ? (
        <ul className="mt-2 divide-y divide-c-line">
          {links.map((l) => (
            <li key={l.partnerUuid}>
              <button type="button" onClick={() => setEditing(l)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-c-accent-soft text-c-accent">
                  <HeartHandshake className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base">{nameOf(l)}</span>
                  <span className={`block text-sm ${l.accepted ? "text-c-fertile" : "text-c-muted"}`}>{l.accepted ? t("accepted") : t("pending")}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-c-subtle" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {links && links.length < MAX_INVITES ? (
        <Button variant="soft" block className="mt-3" onClick={() => setCreating(true)}>
          <UserPlus className="h-5 w-5" aria-hidden /> {t("invite")}
        </Button>
      ) : links ? (
        <p className="mt-3 text-sm text-c-muted">{t("limit", { max: MAX_INVITES })}</p>
      ) : null}

      <Sheet open={creating} onClose={() => setCreating(false)} title={t("invite")} labelClose={tc("common.close")}>
        <p className="mb-4 text-sm text-c-muted">{t("inviteText")}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="flex flex-col gap-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-c-muted">{t("labelField")}</span>
            <input
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
              className="min-h-12 w-full rounded-2xl border border-c-line bg-c-bg px-4 text-base text-c-ink outline-none placeholder:text-c-subtle focus:border-c-accent"
            />
          </label>
          <Button type="submit" block loading={busy}>
            {t("createLink")}
          </Button>
        </form>
      </Sheet>

      <Sheet open={!!created} onClose={() => setCreated(null)} title={t("linkReady")} labelClose={tc("common.close")}>
        {created ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-c-muted">{t("linkReadyText")}</p>
            <p className="break-all rounded-2xl bg-c-raised p-3 font-mono text-xs text-c-ink" data-invite-url>
              {safeShareUrl(created.webShareUrl) ?? ""}
            </p>
            <Button block onClick={() => void share(created)}>
              <Share2 className="h-5 w-5" aria-hidden /> {t("share")}
            </Button>
            <Button
              variant="outline"
              block
              onClick={() => {
                const url = safeShareUrl(created.webShareUrl);
                if (url) void navigator.clipboard.writeText(url).then(() => ui.toast(t("copied")), () => ui.toast(t("copyFailed"), { tone: "error" }));
              }}
            >
              <Copy className="h-5 w-5" aria-hidden /> {t("copy")}
            </Button>
            <p className="text-xs text-c-subtle">{t("linkOnce")}</p>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ? nameOf(editing) : ""} labelClose={tc("common.close")}>
        {editing ? (
          <LinkEditor
            key={editing.partnerUuid}
            link={editing}
            onShare={() => void share(editing)}
            onRevoke={() => void revoke(editing)}
            onChange={(l) => {
              setEditing(l);
              setLinks((cur) => (cur ? cur.map((x) => (x.partnerUuid === l.partnerUuid ? l : x)) : cur));
            }}
          />
        ) : null}
      </Sheet>
    </Card>
  );
}

function LinkEditor({ link, onShare, onRevoke, onChange }: { link: OwnerPartnerLink; onShare: () => void; onRevoke: () => void; onChange: (l: OwnerPartnerLink) => void }) {
  const t = useTranslations("cab.partners");
  const tc = useTranslations("cab");
  const ui = useUI();
  const [label, setLabel] = useState(link.label ?? "");

  async function patch(body: { label?: string | null; permissions?: Partial<Record<OwnerPermission, boolean>> }) {
    try {
      const r = await api.updatePartner(link.partnerUuid, body);
      onChange(r.link);
    } catch {
      ui.toast(tc("errors.generic"), { tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!link.accepted ? (
        <>
          <p className="text-sm text-c-muted">{t("pendingText")}</p>
          <Button variant="soft" block onClick={onShare}>
            <Share2 className="h-5 w-5" aria-hidden /> {t("share")}
          </Button>
        </>
      ) : null}
      <label className="block">
        <span className="mb-1.5 block text-sm text-c-muted">{t("labelField")}</span>
        <input
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if ((label.trim() || null) !== link.label) void patch({ label: label.trim() || null });
          }}
          placeholder={t("labelPlaceholder")}
          className="min-h-12 w-full rounded-2xl border border-c-line bg-c-bg px-4 text-base text-c-ink outline-none placeholder:text-c-subtle focus:border-c-accent"
        />
      </label>
      <div>
        <h3 className="mb-1 text-base font-medium">{t("whatTheySee")}</h3>
        {OWNER_PERMISSIONS.map((k) => (
          <Switch key={k} checked={!!link.permissions[k]} label={t(`perm.${k}`)} onChange={(v) => void patch({ permissions: { [k]: v } })} />
        ))}
      </div>
      <Button variant="danger" block onClick={onRevoke}>
        {link.accepted ? t("revokeTitle") : t("revokeInviteTitle")}
      </Button>
    </div>
  );
}

/** Settings -> "Shared with me": owners whose cycle I can see (contract 10, partner side). */
export function SharedWithMe() {
  const t = useTranslations("cab.partners");
  const router = useRouter();
  const [links, setLinks] = useState<PartnerOfLink[] | null>(null);
  useEffect(() => {
    api.partnerOf().then(
      (r) => setLinks(r.links),
      () => setLinks([]),
    );
  }, []);
  if (!links || !links.length) return null;
  return (
    <Card className="mt-3">
      <h3 className="mb-1 text-base font-medium">{t("sharedWithMe")}</h3>
      <ul className="divide-y divide-c-line">
        {links.map((l) => (
          <li key={l.partnerUuid}>
            <button
              type="button"
              onClick={() => {
                setSelectedPartner(l.partnerUuid);
                router.push("/app/partner");
              }}
              className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-c-period-soft text-base font-semibold uppercase text-c-period">
                {(l.ownerName ?? "S").slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 truncate text-base">{t("cycleOf", { name: l.ownerName ?? t("unnamed") })}</span>
              <ChevronRight className="h-5 w-5 text-c-subtle" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
