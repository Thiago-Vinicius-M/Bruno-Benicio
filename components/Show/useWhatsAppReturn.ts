"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { loadCommercialShowModelsAction, prepareWhatsAppAction } from "@/app/actions";
import type { CommercialAccess } from "@/lib/sellers/commercialAccess";
import { readSellerCookie } from "@/lib/sellers/sellerLink";
import { parseEventDate, parseEventTime } from "@/lib/showModels/eventSchedule";
import type { CommercialShowModel } from "@/lib/showModels/types";

const noSubscription = () => () => {};

/**
 * Código do vendedor gravado pelo link comercial (/p/<código>), ou null. No servidor (a
 * Home é estática) é sempre null; depois da hidratação vem do cookie. Persiste na
 * sessão do navegador, então sobrevive a recarregar a página e a navegar pelas seções.
 * Não autoriza nada: só indica que vale a pena pedir a versão comercial ao servidor.
 */
export function useSellerCode(): string | null {
  return useSyncExternalStore(noSubscription, () => readSellerCookie(document.cookie), () => null);
}

export type CommercialState = CommercialAccess | { status: "loading" };

/** Folga depois da expiração antes de perguntar de novo ao servidor (relógios diferentes). */
const EXPIRY_RECHECK_MARGIN_MS = 1_000;
/** Limite do setTimeout (~24,8 dias); um link dura no máximo 7. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Versão comercial de NOSSO SHOW (valores e escolha), pedida ao servidor quando há um
 * código de vendedor. Sem código: versão pública. Link desativado ou expirado: a mensagem
 * fica até a página ser recarregada (o servidor já apagou o cookie).
 *
 * Link temporário: quando o prazo informado pelo servidor acaba, a versão comercial é
 * pedida de novo; o servidor (que decide pela validade no banco) responde "expirado" e
 * os valores saem da tela. O relógio do navegador só agenda essa nova consulta.
 */
export function useCommercialAccess(sellerCode: string | null): CommercialState {
  const [result, setResult] = useState<{ code: string; access: CommercialAccess } | null>(null);
  const [check, setCheck] = useState(0);

  useEffect(() => {
    if (!sellerCode) return;
    let current = true;
    loadCommercialShowModelsAction()
      .catch((): CommercialAccess => ({ status: "error" }))
      .then((access) => {
        if (current) setResult({ code: sellerCode, access });
      });
    return () => {
      current = false;
    };
  }, [sellerCode, check]);

  useEffect(() => {
    if (result?.access.status !== "commercial" || result.access.expiresInMs === null) return;
    const delay = Math.min(result.access.expiresInMs + EXPIRY_RECHECK_MARGIN_MS, MAX_TIMEOUT_MS);
    const timer = setTimeout(() => setCheck((value) => value + 1), delay);
    return () => clearTimeout(timer);
  }, [result]);

  if (result?.access.status === "inactive" || result?.access.status === "expired") return result.access;
  if (!sellerCode) return { status: "none" };
  return result?.code === sellerCode ? result.access : { status: "loading" };
}

export type WhatsAppReturnState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string; retry: boolean };

const NETWORK_ERROR = "Não foi possível preparar a mensagem. Verifique a conexão e tente novamente.";

/** Espera o contratante parar de digitar a data/horário antes de pedir o link de novo. */
const SCHEDULE_DEBOUNCE_MS = 350;

type Draft = { model: CommercialShowModel | null; date: string; time: string };

/**
 * Formato escolhido em NOSSO SHOW, data e horário opcionais e o link "Voltar ao WhatsApp"
 * correspondente, preparado no servidor (Server Action) a cada mudança. Só a resposta da
 * última mudança vale: trocar rápido de formato não mostra o link de um formato anterior.
 */
export function useWhatsAppReturn() {
  const [draft, setDraft] = useState<Draft>({ model: null, date: "", time: "" });
  // Cópia síncrona do rascunho para os handlers (o estado só muda no próximo render).
  const draftRef = useRef(draft);
  const [state, setState] = useState<WhatsAppReturnState>({ status: "idle" });
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const prepare = useCallback((next: Draft, delay = 0) => {
    const request = ++latest.current;
    clearTimeout(timer.current);
    const { model } = next;
    if (!model) {
      setState({ status: "idle" });
      return;
    }

    // Validação imediata (a mesma do servidor): data/horário inválidos não viram link.
    const date = parseEventDate(next.date);
    const time = parseEventTime(next.time);
    if (!date.ok) {
      setState({ status: "error", message: date.message, retry: false });
      return;
    }
    if (!time.ok) {
      setState({ status: "error", message: time.message, retry: false });
      return;
    }

    setState({ status: "loading" });
    timer.current = setTimeout(() => {
      prepareWhatsAppAction({ modelId: model.id, name: model.name, price: model.price, date: date.value, time: time.value })
        .then((result) => {
          if (request !== latest.current) return;
          setState(
            result.status === "ready"
              ? { status: "ready", url: result.url }
              : { status: "error", message: result.message, retry: result.reason === "unavailable" },
          );
        })
        .catch(() => {
          if (request === latest.current) setState({ status: "error", message: NETWORK_ERROR, retry: true });
        });
    }, delay);
  }, []);

  const update = useCallback(
    (patch: Partial<Draft>, delay = 0) => {
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      prepare(next, delay);
    },
    [prepare],
  );

  const select = useCallback((model: CommercialShowModel) => update({ model }), [update]);
  const setDate = useCallback((date: string) => update({ date }, SCHEDULE_DEBOUNCE_MS), [update]);
  const setTime = useCallback((time: string) => update({ time }, SCHEDULE_DEBOUNCE_MS), [update]);
  const retry = useCallback(() => prepare(draftRef.current), [prepare]);

  return { selected: draft.model, date: draft.date, time: draft.time, state, select, setDate, setTime, retry };
}
