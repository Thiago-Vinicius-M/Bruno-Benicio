/**
 * Bloco de código com um realce de sintaxe mínimo (sem dependências).
 * Não é um parser de verdade: apenas separa comentários, strings, números,
 * palavras-chave, gsap/ScrollTrigger e chaves de objeto para facilitar a leitura.
 */
import { useMemo, type ReactNode } from "react";

const TOKEN_RE = new RegExp(
  [
    String.raw`(\/\/[^\n]*|\/\*[\s\S]*?\*\/)`, // 1 comentário
    String.raw`("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + "`(?:[^`\\\\]|\\\\.)*`)", // 2 string
    String.raw`\b(\d+(?:\.\d+)?)\b`, // 3 número
    String.raw`\b(const|let|var|function|return|if|else|import|export|from|type|new|as|typeof|for|of|null|undefined|true|false|void)\b`, // 4 palavra-chave
    String.raw`\b(gsap|ScrollTrigger)\b`, // 5 API GSAP
    String.raw`([A-Za-z_$][\w$]*)(?=\s*:(?!:))`, // 6 chave de objeto
  ].join("|"),
  "g",
);

const CLASS_BY_GROUP = ["", "tok-c", "tok-s", "tok-n", "tok-k", "tok-g", "tok-p"];

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(TOKEN_RE); // cópia local: lastIndex independente
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(code))) {
    if (match.index > last) out.push(code.slice(last, match.index));
    const group = match.findIndex((value, i) => i > 0 && value !== undefined);
    out.push(
      <span key={key++} className={CLASS_BY_GROUP[group]}>
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

type Props = { code: string; label?: string };

export function CodeBlock({ code, label }: Props) {
  const nodes = useMemo(() => highlight(code.trim()), [code]);
  return (
    <pre className="code" aria-label={label} tabIndex={0}>
      <code>{nodes}</code>
    </pre>
  );
}
