// Supabase Edge Function: importação de extrato bancário -> lançamentos.
//
// POST /import-statement  { action: "status" }
//   -> { hasKey } — o front usa pra saber se a importação de PDF está disponível.
// POST /import-statement  { action: "parse", account_id, filename, mime, fileBase64 }
//   -> extrai os lançamentos do arquivo e DEVOLVE candidatos (NÃO grava nada).
//      A gravação em cash_flow acontece no front, depois da conferência.
//
// Roteamento por formato:
//   - OFX  -> parser determinístico aqui (formato padrão dos bancos, exato, grátis).
//   - PDF / imagem / CSV -> Google Gemini (gemini-2.5-flash, saída JSON estruturada),
//     que lida com layout arbitrário de cada banco.
//
// A chave do Gemini vive SÓ como secret da função (nunca no banco/navegador):
//   GEMINI_API_KEY
//
// Só admin autenticado chama: a função valida o JWT da sessão (rejeita anon).
// Regras/erros voltam como HTTP 200 { error } pro front ler uniforme.
//
// Deploy:  supabase functions deploy import-statement
//   Secret: supabase secrets set GEMINI_API_KEY='...'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = "gemini-2.5-flash";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Lançamento candidato devolvido pro front (ainda não gravado).
type Candidate = {
  date: string; // 'YYYY-MM-DD'
  value: number; // sempre positivo
  type: "Income" | "Expense"; // sinal do valor no extrato
  description: string;
  category: string | null; // sugestão (texto); o front mapeia/cria
  fingerprint: string; // antiduplicata (ver schema_statement_import.sql)
};

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

// sha1 hex de uma string (Web Crypto, disponível no Deno).
async function sha1(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Fingerprint dos itens sem id de banco (PDF/CSV): hash de data|valor|descrição,
// com sufixo de desempate quando há linhas idênticas no mesmo extrato.
async function fingerprintByHash(
  accountId: string,
  items: Omit<Candidate, "fingerprint">[],
): Promise<Candidate[]> {
  const seen = new Map<string, number>();
  const out: Candidate[] = [];
  for (const it of items) {
    const base = `${it.date}|${it.value.toFixed(2)}|${it.type}|${
      it.description.trim().toLowerCase()
    }`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const hash = await sha1(base + (n > 1 ? `#${n}` : ""));
    out.push({ ...it, fingerprint: `hash:${accountId}:${hash}` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// OFX (determinístico)
// ---------------------------------------------------------------------------

function ofxTag(block: string, tag: string): string {
  // OFX é SGML: valores podem ou não ter tag de fechamento. Pega até a próxima
  // tag (<) ou fim de linha.
  const m = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
  return m ? m[1].trim() : "";
}

// Data OFX 'YYYYMMDD...' (com hora/tz opcionais) -> 'YYYY-MM-DD'.
function ofxDate(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "").slice(0, 8);
  if (d.length < 8) return "";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

async function parseOfx(text: string, accountId: string): Promise<Candidate[]> {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const out: Candidate[] = [];
  for (const b of blocks) {
    const amt = parseFloat(ofxTag(b, "TRNAMT").replace(",", "."));
    if (!isFinite(amt) || amt === 0) continue;
    const date = ofxDate(ofxTag(b, "DTPOSTED"));
    if (!date) continue;
    const memo = ofxTag(b, "MEMO") || ofxTag(b, "NAME") || "Lançamento";
    const fitid = ofxTag(b, "FITID");
    // FITID é único por conta no banco -> dedup perfeito. Sem FITID, cai no hash.
    const fingerprint = fitid
      ? `ofx:${accountId}:${fitid}`
      : `hash:${accountId}:${await sha1(`${date}|${amt}|${memo}`)}`;
    out.push({
      date,
      value: Math.abs(amt),
      type: amt < 0 ? "Expense" : "Income",
      description: memo.replace(/\s+/g, " ").trim().slice(0, 300),
      category: null,
      fingerprint,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gemini (PDF / imagem / CSV)
// ---------------------------------------------------------------------------

// Categorias existentes: a IA é obrigada a escolher entre elas (enum), e o
// typeByName valida no servidor que a categoria escolhida bate com o tipo
// (entrada/saída) da transação.
async function loadCategoryNames(): Promise<
  { income: string[]; expense: string[]; typeByName: Record<string, "Income" | "Expense"> }
> {
  const { data } = await supabase
    .from("cash_flow_categories")
    .select("name, type");
  const income: string[] = [];
  const expense: string[] = [];
  const typeByName: Record<string, "Income" | "Expense"> = {};
  for (const c of data ?? []) {
    (c.type === "Income" ? income : expense).push(c.name);
    typeByName[c.name] = c.type === "Income" ? "Income" : "Expense";
  }
  return { income, expense, typeByName };
}

async function parseWithGemini(
  accountId: string,
  mime: string,
  fileBase64: string,
  asText: string | null, // CSV/texto já decodificado; null para binário (PDF/imagem)
): Promise<Candidate[]> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY não configurada — importação de PDF/CSV indisponível. Use OFX ou configure a chave.",
    );
  }
  const cats = await loadCategoryNames();

  const instruction =
    `Você é um extrator de extratos bancários brasileiros. Extraia TODAS as ` +
    `transações do documento e devolva um array JSON. Regras:\n` +
    `- date: data da transação no formato YYYY-MM-DD.\n` +
    `- amount: valor numérico. NEGATIVO para saídas/débitos, POSITIVO para entradas/créditos. ` +
    `Use ponto decimal (ex.: -1234.56). Formato BR: "1.234,56" = 1234.56.\n` +
    `- description: descrição/histórico da transação, limpa.\n` +
    `- category: você DEVE escolher exatamente uma categoria da lista permitida — ` +
    `não invente nomes novos. Para CRÉDITOS/entradas (amount positivo) escolha uma de: ` +
    `[${cats.income.join(", ") || "(nenhuma)"}]. Para DÉBITOS/saídas (amount negativo) escolha uma de: ` +
    `[${cats.expense.join(", ") || "(nenhuma)"}]. Escolha sempre a mais próxima do histórico da transação.\n` +
    `- IGNORE linhas de saldo, saldo anterior, saldo do dia, subtotais e cabeçalhos. ` +
    `Só transações reais.`;

  const parts: unknown[] = [{ text: instruction }];
  if (asText !== null) {
    parts.push({ text: `\n\nConteúdo do extrato:\n${asText}` });
  } else {
    parts.push({ inline_data: { mime_type: mime, data: fileBase64 } });
  }

  // enum força a IA a devolver EXATAMENTE um nome de categoria existente (união
  // de entradas + saídas). Só aplica se houver categorias cadastradas.
  const allNames = [...cats.income, ...cats.expense];
  const categoryProp = allNames.length > 0
    ? { type: "STRING", enum: allNames }
    : { type: "STRING" };
  const required = allNames.length > 0
    ? ["date", "amount", "description", "category"]
    : ["date", "amount", "description"];

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING" },
            amount: { type: "NUMBER" },
            description: { type: "STRING" },
            category: categoryProp,
          },
          required,
        },
      },
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ||
      `Gemini HTTP ${res.status}`;
    throw new Error(`Gemini: ${msg}`);
  }

  const raw =
    (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
      ?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  let rows: { date?: string; amount?: number; description?: string; category?: string }[];
  try {
    rows = JSON.parse(raw);
  } catch {
    throw new Error("Gemini devolveu um JSON inválido.");
  }
  if (!Array.isArray(rows)) rows = [];

  const items = rows
    .filter((r) => r && r.date && typeof r.amount === "number" && r.amount !== 0)
    .map((r) => {
      const type = (Number(r.amount) < 0 ? "Expense" : "Income") as "Income" | "Expense";
      const picked = r.category ? String(r.category).slice(0, 100) : null;
      // Só aceita a categoria da IA se ela existir e for do tipo certo; senão
      // deixa null pra você escolher na conferência (não grava tipo trocado).
      const category = picked && cats.typeByName[picked] === type ? picked : null;
      return {
        date: String(r.date).slice(0, 10),
        value: Math.abs(Number(r.amount)),
        type,
        description: String(r.description ?? "Lançamento").replace(/\s+/g, " ")
          .trim().slice(0, 300),
        category,
      };
    })
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.value > 0);

  return fingerprintByHash(accountId, items);
}

// Classifica candidatos já parseados (OFX) — a IA só escolhe a categoria,
// mantendo data/valor/descrição exatos do parser. No-op se não há chave ou
// categorias cadastradas (aí a categoria fica null pra escolher na conferência).
async function classifyCandidates(candidates: Candidate[]): Promise<Candidate[]> {
  if (!GEMINI_API_KEY || candidates.length === 0) return candidates;
  const cats = await loadCategoryNames();
  const allNames = [...cats.income, ...cats.expense];
  if (allNames.length === 0) return candidates;

  const list = candidates.map((c, i) => ({ id: i, type: c.type, description: c.description }));
  const instruction =
    `Você classifica transações bancárias. Para cada item, escolha exatamente ` +
    `uma categoria da lista permitida — não invente nomes. Categorias de ENTRADA ` +
    `(type=Income): [${cats.income.join(", ") || "(nenhuma)"}]. Categorias de SAÍDA ` +
    `(type=Expense): [${cats.expense.join(", ") || "(nenhuma)"}]. Use o type de cada ` +
    `item para escolher da lista certa. Devolva um array [{id, category}] com o mesmo id.\n\n` +
    `Transações:\n${JSON.stringify(list)}`;

  const body = {
    contents: [{ parts: [{ text: instruction }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "INTEGER" },
            category: { type: "STRING", enum: allNames },
          },
          required: ["id", "category"],
        },
      },
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return candidates; // falha na classificação não derruba a importação
    const raw = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
      ?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const picks: { id?: number; category?: string }[] = JSON.parse(raw);
    const byId = new Map<number, string>();
    for (const p of Array.isArray(picks) ? picks : []) {
      if (typeof p.id === "number" && p.category) byId.set(p.id, String(p.category));
    }
    return candidates.map((c, i) => {
      const picked = byId.get(i);
      // valida tipo: só aplica se a categoria for do tipo certo.
      if (picked && cats.typeByName[picked] === c.type) return { ...c, category: picked };
      return c;
    });
  } catch {
    return candidates; // qualquer erro: mantém sem categoria (revisão manual)
  }
}

// ---------------------------------------------------------------------------
// Detecção de formato + decodificação
// ---------------------------------------------------------------------------

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// OFX/CSV podem vir em ISO-8859-1 (comum no Brasil). Tenta UTF-8 e, se houver
// caractere de substituição, cai pra latin1.
function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("iso-8859-1").decode(bytes);
}

// ---------------------------------------------------------------------------
// Auth: exige usuário autenticado (não anon).
// ---------------------------------------------------------------------------
async function requireUser(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  // getUser com a anon key devolve erro/sem user -> bloqueia.
  return !error && !!data.user && data.user.role !== "anon";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Método não suportado." }, 405);
  }

  try {
    const payload = await req.json().catch(() => null);
    if (!payload) return json({ error: "Payload inválido." });

    if (payload.action === "status") {
      return json({ hasKey: !!GEMINI_API_KEY });
    }

    if (payload.action !== "parse") {
      return json({ error: "Ação desconhecida." });
    }

    if (!(await requireUser(req))) {
      return json({ error: "Não autorizado." }, 401);
    }

    const accountId = String(payload.account_id ?? "").trim();
    if (!accountId) return json({ error: "Conta bancária é obrigatória." });

    const fileBase64 = String(payload.fileBase64 ?? "");
    if (!fileBase64) return json({ error: "Arquivo vazio." });

    const filename = String(payload.filename ?? "").toLowerCase();
    const mime = String(payload.mime ?? "");
    const bytes = base64ToBytes(fileBase64);

    const isOfx = filename.endsWith(".ofx") || mime.includes("ofx") ||
      decodeText(bytes.slice(0, 512)).includes("<OFX>");
    const isPdf = filename.endsWith(".pdf") || mime === "application/pdf";
    const isImage = mime.startsWith("image/") ||
      /\.(png|jpe?g|webp|heic)$/.test(filename);
    const isCsvOrText = filename.endsWith(".csv") || filename.endsWith(".txt") ||
      mime.includes("csv") || mime.startsWith("text/");
    const isXlsx = filename.endsWith(".xlsx") || filename.endsWith(".xls") ||
      mime.includes("spreadsheet") || mime.includes("excel");

    let candidates: Candidate[];
    if (isOfx) {
      // OFX: parser determinístico (data/valor exatos) + IA só pra categoria.
      candidates = await classifyCandidates(await parseOfx(decodeText(bytes), accountId));
    } else if (isPdf || isImage) {
      candidates = await parseWithGemini(accountId, mime || "application/pdf", fileBase64, null);
    } else if (isCsvOrText) {
      candidates = await parseWithGemini(accountId, mime, fileBase64, decodeText(bytes));
    } else if (isXlsx) {
      return json({
        error: "Excel ainda não é suportado. Exporte o extrato como CSV, OFX ou PDF.",
      });
    } else {
      return json({ error: "Formato não reconhecido. Use OFX, PDF, imagem ou CSV." });
    }

    if (candidates.length === 0) {
      return json({ error: "Nenhuma transação encontrada no arquivo." });
    }

    // Ordena por data e informa quais fingerprints já existem no banco, pra
    // o front marcar/ocultar os já importados.
    candidates.sort((a, b) => a.date.localeCompare(b.date));
    const { data: existing } = await supabase
      .from("cash_flow")
      .select("import_fingerprint")
      .in("import_fingerprint", candidates.map((c) => c.fingerprint));
    const already = new Set(
      (existing ?? []).map((e) => e.import_fingerprint),
    );

    return json({
      candidates: candidates.map((c) => ({
        ...c,
        duplicate: already.has(c.fingerprint),
      })),
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Erro inesperado." },
      500,
    );
  }
});
