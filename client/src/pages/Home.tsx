import { trpc } from "@/lib/trpc";
import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  CircleDot,
  Leaf,
  LoaderCircle,
  Orbit,
  Sparkles,
} from "lucide-react";

type Intent = "launch" | "clarify" | "protect" | "discover";

const sampleSignals = [
  "کاربران تیم‌های فروش می‌گویند بعد از انتقال لید به CRM، پیگیری بعدی گم می‌شود و مدیران نمی‌فهمند چه زمانی باید مداخله کنند.",
  "در هنگام پرداخت، بعضی مشتریان می‌گویند مبلغ نهایی با مبلغ صفحه محصول فرق دارد و درخواست بازپرداخت فوری دارند.",
  "تیم محتوا دیده کاربران تازه‌کار برای پیدا کردن قالب مناسب سردرگم‌اند، اما هنوز مشخص نیست کدام دسته بیشترین اصطکاک را دارد.",
];

const intentCopy: Record<Intent, { title: string; note: string }> = {
  launch: {
    title: "یک آزمایش کوچک طراحی کن",
    note: "مسئله و نتیجه مطلوب به‌قدر کافی واضح‌اند تا با یک تجربه محدود آزموده شوند.",
  },
  clarify: {
    title: "یک سؤال روشن‌کننده بپرس",
    note: "برای ساختن فرضیه دقیق‌تر، ابتدا باید دامنه یا نتیجه مطلوب را شفاف کرد.",
  },
  protect: {
    title: "اول از کاربر محافظت کن",
    note: "این سیگنال می‌تواند به ریسک، نارضایتی جدی یا فوریت عملیاتی اشاره داشته باشد.",
  },
  discover: {
    title: "برای کشف الگو وقت بگذار",
    note: "این متن ارزش بررسی دارد، اما هنوز بیشتر یک فرصت پژوهش است تا یک درخواست مستقیم ساخت.",
  },
};

function Meter({ label, value, tone = "moss" }: { label: string; value: number; tone?: "moss" | "gold" | "water" }) {
  const percentage = Math.max(0, Math.min(100, value));
  return (
    <div className="meter-row">
      <div className="meter-label">
        <span>{label}</span>
        <span dir="ltr">{percentage}%</span>
      </div>
      <div className={`meter-track ${tone}`} aria-hidden="true">
        <div className="meter-fill" style={{ "--fill": `${percentage}%` } as CSSProperties} />
      </div>
    </div>
  );
}

function ResultPanel({
  data,
  isPending,
  error,
}: {
  data: ReturnType<typeof trpc.signal.analyze.useMutation>["data"];
  isPending: boolean;
  error: string | null;
}) {
  if (isPending) {
    return (
      <section className="analysis-panel analysis-loading" aria-live="polite" aria-busy="true">
        <div className="analysis-orb" />
        <div>
          <p className="analysis-kicker">سه داوری مستقل در حال اجراست</p>
          <h3>متن را به سیگنال‌های قابل‌استفاده تبدیل می‌کنیم.</h3>
          <p>Choice، Noul و Score هم‌زمان روی همان متن کار می‌کنند.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="analysis-panel analysis-error" role="status">
        <span className="status-mark">!</span>
        <div>
          <p className="analysis-kicker">تحلیل فعلاً در دسترس نیست</p>
          <h3>یک‌بار دیگر تلاش کن.</h3>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="analysis-panel analysis-empty" aria-live="polite">
        <div className="empty-matrix" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div>
          <p className="analysis-kicker">فضای آزمایش آماده است</p>
          <h3>یک سیگنال واقعی وارد کن.</h3>
          <p>سه داوری، مقصد، فوریت و میزان آمادگی آن را بدون تولید متن اضافی برمی‌گردانند.</p>
        </div>
      </section>
    );
  }

  const intent = intentCopy[data.intent.choice as Intent];
  const urgency = Math.round(data.urgency.noul * 100);
  const readiness = Math.round((data.readiness.score / 3) * 100);
  const confidence = Math.round(data.intent.confidence * 100);

  return (
    <section className="analysis-panel analysis-result" aria-live="polite">
      <div className="result-topline">
        <p className="analysis-kicker">حرکت پیشنهادی</p>
        <span className={data.route === "advance" ? "route-badge advance" : "route-badge review"}>
          {data.route === "advance" ? "آماده برای حرکت" : "نیازمند مرور انسانی"}
        </span>
      </div>
      <h3>{intent.title}</h3>
      <p className="result-note">{intent.note}</p>
      <div className="meter-set">
        <Meter label="اعتماد به انتخاب" value={confidence} tone="moss" />
        <Meter label="فوریت در متن" value={urgency} tone="gold" />
        <Meter label="آمادگی برای آزمایش" value={readiness} tone="water" />
      </div>
      <div className="result-footnote">
        <span>نوع تصمیم: <b dir="ltr">{data.intent.choice}</b></span>
        {data.usage && <span dir="ltr">{data.usage.inputTokens + data.usage.outputTokens} tokens</span>}
      </div>
    </section>
  );
}

export default function Home() {
  const [signal, setSignal] = useState(sampleSignals[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const analysis = trpc.signal.analyze.useMutation();

  const submitSignal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const productNote = signal.trim();

    if (productNote.length < 12) {
      setFormError("برای تحلیل، حداقل یک جمله کوتاه بنویس.");
      return;
    }

    setFormError(null);
    analysis.mutate({ productNote });
  };

  return (
    <div className="garden-page" dir="rtl">
      <div className="site-grain" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Signal Garden home">
          <span className="brand-seed"><Leaf strokeWidth={1.8} /></span>
          <span>Signal Garden</span>
        </a>
        <nav className="topnav" aria-label="پیمایش اصلی">
          <a href="#method">روش کار</a>
          <a href="#lab">آزمایشگاه</a>
        </nav>
        <a className="header-cta" href="#lab">
          آزمایش کن
          <ArrowLeft size={16} aria-hidden="true" />
        </a>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="eyebrow-dot" />
              <span>تصمیم‌های کوچک، مسیرهای بزرگ</span>
            </div>
            <h1>به هر سیگنال،<br />مسیر درست رشد را بده.</h1>
            <p className="hero-intro">
              Signal Garden یک الگوی محصول برای تیم‌هایی است که می‌خواهند از متن‌های خام،
              <strong> تصمیم‌های محدود، قابل‌فهم و همراه با میزان اطمینان</strong> بسازند.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#lab">
                دیدن تصمیم زنده
                <ArrowUpLeft size={19} aria-hidden="true" />
              </a>
              <a className="text-action" href="#method">چرا TypeSafe AI؟</a>
            </div>
            <div className="hero-footnote">
              <CircleDot size={14} aria-hidden="true" />
              <span>مدل معنا را می‌سنجد؛ سیاست و اقدام همچنان در اختیار کد شماست.</span>
            </div>
          </div>

          <div className="signal-terrarium" aria-label="تصویر مفهومی تبدیل متن به تصمیم">
            <div className="terrarium-rings ring-one" />
            <div className="terrarium-rings ring-two" />
            <div className="terrarium-axis axis-x" />
            <div className="terrarium-axis axis-y" />
            <div className="terrarium-core">
              <span>signal</span>
              <b>متن خام</b>
            </div>
            <div className="growth-node node-first"><span>choice</span><b>مسیر</b></div>
            <div className="growth-node node-second"><span>noul</span><b>فوریت</b></div>
            <div className="growth-node node-third"><span>score</span><b>آمادگی</b></div>
            <div className="terrarium-caption">
              <Sparkles size={17} aria-hidden="true" />
              <p>یک متن، سه داوری مستقل،<br />و یک حرکت قابل‌اعتماد.</p>
            </div>
          </div>
        </section>

        <section className="principle-strip" aria-label="اصول Signal Garden">
          <p>خروجی متن آزاد نیست؛ یک قرارداد قابل‌مصرف برای محصول است.</p>
          <span aria-hidden="true">✳</span>
          <p>ابهام پنهان نمی‌ماند؛ با confidence وارد طراحی تصمیم می‌شود.</p>
          <span aria-hidden="true">✳</span>
          <p>هر داوری، کوچک و قابل‌اندازه‌گیری می‌ماند.</p>
        </section>

        <section className="method-section" id="method">
          <div className="section-intro">
            <p className="section-marker">منطق پشت باغ</p>
            <h2>هوش مصنوعی را به یک جواب بزرگ تبدیل نکن. آن را به چند سؤال دقیق تقسیم کن.</h2>
          </div>
          <div className="method-grid">
            <article className="method-card">
              <div className="method-index"><span>۱</span><Orbit size={18} /></div>
              <h3>متن را به‌عنوان state نگه دار</h3>
              <p>سیگنال محصول، زمینه‌ای است که هر داوری برای فهمیدن معنای واقعی آن نیاز دارد.</p>
            </article>
            <article className="method-card featured-method">
              <div className="method-index"><span>۲</span><Check size={18} /></div>
              <h3>فقط همان چیزی را بپرس که کد نمی‌داند</h3>
              <p>انتخاب حرکت، سنجش فوریت و درجه آمادگی؛ هرکدام یک خروجی typed و مشخص دارند.</p>
            </article>
            <article className="method-card">
              <div className="method-index"><span>۳</span><Sparkles size={18} /></div>
              <h3>احتمال را به سیاست تبدیل کن</h3>
              <p>کد شما تعیین می‌کند کدام confidence برای حرکت خودکار کافی است و کجا باید انسان وارد شود.</p>
            </article>
          </div>
        </section>

        <section className="lab-section" id="lab">
          <div className="lab-header">
            <div>
              <p className="section-marker">آزمایشگاه زنده</p>
              <h2>یک یادداشت محصول را به حرکت بعدی تبدیل کن.</h2>
            </div>
            <p>این نمونه به یک API server-side متصل است. کلید TypeSafe AI در مرورگر ارسال نمی‌شود.</p>
          </div>

          <div className="lab-grid">
            <form className="signal-form" onSubmit={submitSignal}>
              <label htmlFor="product-signal">سیگنال محصول</label>
              <textarea
                id="product-signal"
                value={signal}
                onChange={event => setSignal(event.target.value)}
                maxLength={1200}
                placeholder="مثلاً مشتریان برای انجام یک کار مشخص با مشکل روبه‌رو شده‌اند..."
              />
              <div className="form-tools">
                <div className="sample-actions" aria-label="نمونه‌ها">
                  {sampleSignals.map((sample, index) => (
                    <button
                      type="button"
                      className="sample-button"
                      onClick={() => {
                        setSignal(sample);
                        setFormError(null);
                      }}
                      key={sample}
                    >
                      نمونه {index + 1}
                    </button>
                  ))}
                </div>
                <span className="char-count" dir="ltr">{signal.length}/1200</span>
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <button className="analyze-button" type="submit" disabled={analysis.isPending}>
                {analysis.isPending ? <LoaderCircle className="spin" size={18} /> : <Leaf size={18} />}
                {analysis.isPending ? "در حال سنجش سیگنال" : "حرکت بعدی را پیدا کن"}
              </button>
            </form>

            <ResultPanel data={analysis.data} isPending={analysis.isPending} error={analysis.error?.message ?? null} />
          </div>
        </section>

        <section className="contract-section">
          <div className="contract-copy">
            <p className="section-marker">قرارداد، نه حدس</p>
            <h2>خروجی برای یک انسان خواناست و برای نرم‌افزار هم قابل‌اتکاست.</h2>
            <p>به‌جای parsing پاسخ‌های آزاد، هر primitive فقط همان ساختاری را برمی‌گرداند که لایه بعدی واقعاً به آن نیاز دارد.</p>
          </div>
          <div className="contract-code" dir="ltr" aria-label="نمونه ساختار پاسخ">
            <div className="code-top"><span /><span /><span /><b>signal-response.json</b></div>
            <pre>{`{
  "intent": "clarify",
  "confidence": 0.82,
  "urgency": 0.09,
  "readiness": 1.74
}`}</pre>
            <div className="code-note">A clear shape keeps your product in control.</div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand" href="#top">
          <span className="brand-seed"><Leaf strokeWidth={1.8} /></span>
          <span>Signal Garden</span>
        </a>
        <p>Built around TypeSafe AI System One decisions.</p>
        <a href="#lab">بازگشت به آزمایشگاه <ArrowLeft size={15} aria-hidden="true" /></a>
      </footer>
    </div>
  );
}
