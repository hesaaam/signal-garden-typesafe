type ChoiceAnswer = {
  type: "choice";
  choice: "launch" | "clarify" | "protect" | "discover";
  probabilities: Record<string, number>;
  confidence: number;
};

type NoulAnswer = {
  type: "noul";
  noul: number;
};

type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

type TypeSafePayload = {
  answers: {
    next_move?: ChoiceAnswer;
    time_sensitive?: NoulAnswer;
    delivery_readiness?: ScoreAnswer;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
};

export type SignalAnalysis = {
  intent: ChoiceAnswer;
  urgency: NoulAnswer;
  readiness: ScoreAnswer;
  route: "advance" | "review";
  usage: {
    inputTokens: number;
    outputTokens: number;
  } | null;
};

const endpoint = "https://api.typesafe.ai/v1/systemone";
const retryableStatuses = new Set([429, 529]);

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function assertValidPayload(payload: TypeSafePayload): asserts payload is TypeSafePayload & {
  answers: {
    next_move: ChoiceAnswer;
    time_sensitive: NoulAnswer;
    delivery_readiness: ScoreAnswer;
  };
} {
  const { next_move, time_sensitive, delivery_readiness } = payload.answers ?? {};

  if (
    next_move?.type !== "choice" ||
    typeof next_move.confidence !== "number" ||
    time_sensitive?.type !== "noul" ||
    typeof time_sensitive.noul !== "number" ||
    delivery_readiness?.type !== "score" ||
    typeof delivery_readiness.score !== "number" ||
    typeof delivery_readiness.confidence !== "number"
  ) {
    throw new Error("TypeSafe AI returned an unexpected response shape.");
  }
}

/**
 * Runs three independent TypeSafe judgments over one product signal.
 * All policy stays in code: the model supplies semantic probabilities only.
 */
export async function analyzeSignal(productNote: string): Promise<SignalAnalysis> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error("TypeSafe AI is not configured on this server.");
  }

  const body = {
    state: { productNote },
    model: "jev-latest",
    questions: {
      next_move: {
        type: "choice",
        instructions:
          "با توجه به `productNote`، مناسب‌ترین گام بعدی محصول را انتخاب کن. فقط معنی متن را ارزیابی کن و خروجی را به یکی از گزینه‌های مشخص محدود کن.",
        criteria: {
          launch: "درخواست یک قابلیت یا تجربه مشخص با زمینه کافی برای ساخت یا عرضه محدود است.",
          clarify: "هدف یا دامنه مبهم است و قبل از طراحی یا ساخت، یک سؤال روشن‌کننده بیشترین ارزش را دارد.",
          protect: "متن حاوی ریسک، نارضایتی جدی، نقض حریم خصوصی، امنیت یا فوریت عملیاتی است که باید پیش از توسعه رسیدگی شود.",
          discover: "سیگنال ارزش بررسی دارد، اما بیشتر یک مشاهده، فرصت یا الگو برای پژوهش است تا یک درخواست مستقیم ساخت.",
        },
      },
      time_sensitive: {
        type: "noul",
        instructions: "آیا `productNote` به یک زمان‌بندی فوری، موعد مشخص یا نیاز به واکنش سریع اشاره می‌کند؟",
        criteria: {
          true: "یک محدودیت زمانی روشن، فوریت یا ریسک تأخیر بیان شده است.",
          false: "متن به فوریت یا بازه زمانی حساس اشاره نمی‌کند.",
        },
      },
      delivery_readiness: {
        type: "score",
        instructions:
          "میزان آمادگی `productNote` برای تبدیل‌شدن به یک آزمایش کوچک محصول را ارزیابی کن. به وضوح مسئله، مخاطب و نتیجه مطلوب توجه کن.",
        criteria: [
          "کاملاً مبهم: مسئله، مخاطب یا نتیجه مشخص نیست.",
          "نشانه اولیه: یک نیاز یا فرصت قابل‌فهم وجود دارد، اما جزئیات کلیدی کم است.",
          "آماده برای آزمایش: مسئله و نتیجه مطلوب به‌اندازه کافی روشن‌اند تا یک فرضیه محدود ساخته شود.",
          "آماده برای اجرای محدود: مخاطب، مسئله و اقدام پیشنهادی مشخص‌اند و می‌توان یک تجربه کوچک را اجرا کرد.",
        ],
      },
    },
  };

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!retryableStatuses.has(response.status) || attempt === 2) break;
    await wait(350 * 2 ** attempt);
  }

  if (!response?.ok) {
    throw new Error("Semantic evaluation is temporarily unavailable. Please try again.");
  }

  const payload = (await response.json()) as TypeSafePayload;
  assertValidPayload(payload);

  const route =
    payload.answers.next_move.confidence >= 0.68 &&
    payload.answers.delivery_readiness.score >= 1.65
      ? "advance"
      : "review";

  return {
    intent: payload.answers.next_move,
    urgency: payload.answers.time_sensitive,
    readiness: payload.answers.delivery_readiness,
    route,
    usage: payload.usage
      ? {
          inputTokens: payload.usage.input_tokens,
          outputTokens: payload.usage.output_tokens,
        }
      : null,
  };
}
