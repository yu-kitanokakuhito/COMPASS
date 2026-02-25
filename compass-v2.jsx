import { useState, useEffect, useRef } from "react";

// ─── Storage Keys ───────────────────────────────────────────
const STORAGE_SESSIONS = "compass_v2_sessions";
const STORAGE_GROWTH   = "compass_v2_growth";

// ─── Phase Config ───────────────────────────────────────────
const PHASES = [
  { id: 1, name: "傾聴",     icon: "👂", color: "#7C9EFF", desc: "今の状態を話す" },
  { id: 2, name: "掘り下げ", icon: "🔍", color: "#FF8C69", desc: "なぜ？を探る" },
  { id: 3, name: "価値観",   icon: "💡", color: "#FFD166", desc: "本質を炙り出す" },
  { id: 4, name: "ビジョン", icon: "🔭", color: "#06D6A0", desc: "理想を描く" },
  { id: 5, name: "行動",     icon: "⚡", color: "#FF6B9D", desc: "明日を決める" },
];

const THEORY_BASIS = [
  { name: "ICF コーチングモデル", desc: "国際コーチング連盟の傾聴・質問フレームワーク" },
  { name: "自己決定理論", desc: "Ryan & Deci（1985）内発的動機づけの心理学" },
  { name: "マズロー欲求階層", desc: "自己実現に向けた欲求構造の理解" },
  { name: "スーパーのキャリア発達理論", desc: "人生全体を通じたキャリア形成モデル" },
];

// ─── System Prompt ───────────────────────────────────────────
const buildSystemPrompt = (phase, insights) => `
あなたは「COMPASS」という名の、世界トップクラスのライフコーチAIです。
ICF（国際コーチング連盟）のコーチングモデル、自己決定理論（Ryan & Deci）、マズローの欲求階層理論に基づいて会話を進めます。

【現在のフェーズ】${phase}フェーズ
フェーズ1「傾聴」: ユーザーの今の状態・悩みをありのまま受け取る。評価せず、ただ深く聴く。
フェーズ2「掘り下げ」: 「なぜそう感じるのか」「いつからそうなのか」を探る。
フェーズ3「価値観」: 言葉の裏にある本当の価値観・信念を炙り出す。「あなたが大切にしていること」を鏡のように反射する。
フェーズ4「ビジョン」: 「もし何でも叶うなら？」「10年後の理想は？」で未来を一緒に描く。
フェーズ5「行動」: 「まず明日、一つだけやるとしたら？」で具体的な一歩を決める。

【これまでの気づき】
${insights.keywords.length > 0 ? `キーワード: ${insights.keywords.join("、")}` : "まだなし"}
${insights.coreValue ? `コアバリュー: ${insights.coreValue}` : ""}

【会話スタイル】
- 知的・洗練・プロコーチとして話す。押しつけず、でも核心を突く。
- 1回の返答は3〜5文程度。必ず最後は一つの質問で締める。
- ユーザーが話した言葉をそのまま使って反射する（オウム返しではなく本質を捉えて）。
- 「そうなんですね」「それは辛かったですね」など共感を自然に挟む。
- フェーズが進むにつれて、より深く・より未来志向に。

【重要】
- JSON返答不要。自然な会話文のみ返す。
- 説教・アドバイス・答えの押しつけは絶対にしない。
- ユーザー自身が「気づく」瞬間を作ることが最大の目的。
`.trim();

const INSIGHT_PROMPT = `
以下の会話から、ユーザーの気づきを抽出してください。
必ず以下のJSON形式のみで返してください（他のテキスト不要）:
{
  "keywords": ["キーワード1", "キーワード2", "キーワード3"],
  "coreValue": "最も重要な価値観（一言）",
  "phase": 現在のフェーズ番号(1-5),
  "scores": {
    "selfAwareness": 0-100の数値,
    "clarity": 0-100の数値,
    "motivation": 0-100の数値,
    "actionReady": 0-100の数値
  },
  "insight": "ユーザーへの一文インサイト（気づきを促す言葉）"
}
`;

const REPORT_PROMPT = `
以下の会話セッション全体を分析して、人生設計レポートをJSON形式で生成してください。
必ずこのJSON形式のみで返してください:
{
  "personalityType": "パーソナリティタイプ名（例：情熱の開拓者）",
  "summary": "200字程度のパーソナリティ分析",
  "vision": "10年後のビジョン文（200〜300字、ユーザーの言葉を使いながら具体的に）",
  "swot": {
    "strengths": ["強み1","強み2","強み3","強み4"],
    "weaknesses": ["課題1","課題2","課題3"],
    "opportunities": ["機会1","機会2","機会3"],
    "threats": ["リスク1","リスク2"]
  },
  "roadmap": [
    {"period":"1年目","theme":"テーマ","actions":["行動1","行動2","行動3"],"milestone":"マイルストーン"},
    {"period":"2〜3年目","theme":"テーマ","actions":["行動1","行動2","行動3"],"milestone":"マイルストーン"},
    {"period":"4〜5年目","theme":"テーマ","actions":["行動1","行動2","行動3"],"milestone":"マイルストーン"},
    {"period":"6〜10年目","theme":"テーマ","actions":["行動1","行動2","行動3"],"milestone":"マイルストーン"}
  ],
  "top5": [
    {"rank":1,"action":"アクション名","detail":"詳細と理由","by":"期限"},
    {"rank":2,"action":"アクション名","detail":"詳細と理由","by":"期限"},
    {"rank":3,"action":"アクション名","detail":"詳細と理由","by":"期限"},
    {"rank":4,"action":"アクション名","detail":"詳細と理由","by":"期限"},
    {"rank":5,"action":"アクション名","detail":"詳細と理由","by":"期限"}
  ],
  "message": "ユーザーへの温かいメッセージ（100字）"
}
`;

// ─── Main App ────────────────────────────────────────────────
export default function CompassV2() {
  const [screen, setScreen] = useState("welcome");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(1);
  const [turnCount, setTurnCount] = useState(0);
  const [insights, setInsights] = useState({ keywords: [], coreValue: "", scores: { selfAwareness: 0, clarity: 0, motivation: 0, actionReady: 0 }, insight: "" });
  const [insightOpen, setInsightOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [growthData, setGrowthData] = useState([]);
  const [activeTab, setActiveTab] = useState("chat");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load persisted data
  useEffect(() => {
    const load = async () => {
      try {
        const s = await window.storage.get(STORAGE_SESSIONS);
        if (s) setSessions(JSON.parse(s.value));
        const g = await window.storage.get(STORAGE_GROWTH);
        if (g) setGrowthData(JSON.parse(g.value));
      } catch {}
    };
    load();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Auto-advance phase
  useEffect(() => {
    if (turnCount >= 4 && phase === 1) setPhase(2);
    else if (turnCount >= 8 && phase === 2) setPhase(3);
    else if (turnCount >= 13 && phase === 3) setPhase(4);
    else if (turnCount >= 18 && phase === 4) setPhase(5);
  }, [turnCount]);

  const startSession = () => {
    const id = Date.now().toString();
    setCurrentSessionId(id);
    setMessages([{
      role: "assistant",
      text: "はじめまして。私はCOMPASS——あなたの内側にある答えを、一緒に見つけるコーチです。\n\nまず聞かせてください。今、あなたの心の中にあることを、自由に話してもらえますか？どんな小さなことでも構いません。",
      phase: 1
    }]);
    setPhase(1);
    setTurnCount(0);
    setInsights({ keywords: [], coreValue: "", scores: { selfAwareness: 0, clarity: 0, motivation: 0, actionReady: 0 }, insight: "" });
    setReport(null);
    setScreen("chat");
  };

  const buildHistory = () => messages.map(m => ({
    role: m.role,
    content: m.text
  }));

  const send = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    const newMsg = { role: "user", text: userText, phase };
    setMessages(m => [...m, newMsg]);
    setLoading(true);

    const history = [...buildHistory(), { role: "user", content: userText }];

    try {
      // Main reply
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          system: buildSystemPrompt(PHASES[phase - 1].name, insights),
          messages: history
        })
      });
      const data = await res.json();
      const reply = data.content?.map(c => c.text || "").join("") || "";
      const newTurn = turnCount + 1;
      setTurnCount(newTurn);
      setMessages(m => [...m, { role: "assistant", text: reply, phase }]);

      // Insight extraction (every 3 turns)
      if (newTurn % 3 === 0) {
        const convo = history.map(h => `${h.role === "user" ? "ユーザー" : "COMPASS"}: ${h.content}`).join("\n");
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 400,
            system: INSIGHT_PROMPT,
            messages: [{ role: "user", content: convo }]
          })
        }).then(r => r.json()).then(d => {
          const raw = d.content?.map(c => c.text || "").join("");
          try {
            const j = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
            setInsights(j);
          } catch {}
        }).catch(() => {});
      }
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "少し考えすぎてしまいました。もう一度話しかけてください。", phase }]);
    }
    setLoading(false);
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    setReportProgress(0);
    const interval = setInterval(() => {
      setReportProgress(p => { if (p >= 88) { clearInterval(interval); return 88; } return p + Math.random() * 7; });
    }, 500);
    const convo = messages.map(m => `${m.role === "user" ? "ユーザー" : "COMPASS"}: ${m.text}`).join("\n\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          system: REPORT_PROMPT,
          messages: [{ role: "user", content: `以下の会話を分析してレポートを生成してください:\n\n${convo}` }]
        })
      });
      const data = await res.json();
      const raw = data.content?.map(c => c.text || "").join("");
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
      clearInterval(interval);
      setReportProgress(100);

      // Save session
      const sessionData = {
        id: currentSessionId,
        date: new Date().toLocaleDateString("ja-JP"),
        turns: turnCount,
        insights,
        report: parsed,
        messages: messages.slice(-6)
      };
      const newSessions = [sessionData, ...sessions].slice(0, 10);
      setSessions(newSessions);
      const newGrowth = [...growthData, {
        date: new Date().toLocaleDateString("ja-JP"),
        ...insights.scores
      }].slice(-12);
      setGrowthData(newGrowth);
      try {
        await window.storage.set(STORAGE_SESSIONS, JSON.stringify(newSessions));
        await window.storage.set(STORAGE_GROWTH, JSON.stringify(newGrowth));
      } catch {}

      setTimeout(() => { setReport(parsed); setGeneratingReport(false); setScreen("report"); }, 600);
    } catch {
      clearInterval(interval);
      setGeneratingReport(false);
      alert("レポート生成中にエラーが発生しました。");
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  // ── WELCOME ──────────────────────────────────────────────
  if (screen === "welcome") return (
    <div style={{ minHeight: "100vh", background: "#0D0D14", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      {/* Ambient bg */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "10%", left: "15%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,158,255,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "20%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,214,160,0.10) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: "50%", right: "30%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,157,0.08) 0%, transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto", padding: "80px 32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(124,158,255,0.1)", border: "1px solid rgba(124,158,255,0.25)", borderRadius: 50, padding: "6px 18px", marginBottom: 48, animation: "fadeIn 0.8s ease" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C9EFF", boxShadow: "0 0 8px #7C9EFF" }} />
          <span style={{ color: "#7C9EFF", fontSize: 12, fontWeight: 600, letterSpacing: "0.15em" }}>AI LIFE COACHING</span>
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 56, animation: "fadeUp 0.8s ease 0.1s both" }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(44px, 8vw, 72px)", color: "white", margin: "0 0 8px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            COMPASS
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, letterSpacing: "0.4em", fontWeight: 500, marginBottom: 32 }}>YOUR INNER COMPASS</p>
          <p style={{ fontSize: "clamp(18px, 3vw, 22px)", color: "rgba(255,255,255,0.75)", lineHeight: 1.75, maxWidth: 560, margin: "0 auto", fontWeight: 300 }}>
            情報に溢れた時代に、<strong style={{ color: "white", fontWeight: 600 }}>あなただけの答え</strong>を見つける。<br />
            会話を通じて自分を知り、人生を設計する。
          </p>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 72, animation: "fadeUp 0.8s ease 0.3s both" }}>
          <button onClick={startSession} style={{
            background: "linear-gradient(135deg, #7C9EFF 0%, #06D6A0 100%)",
            color: "white", border: "none", borderRadius: 50,
            padding: "18px 56px", fontSize: 16, fontWeight: 600,
            cursor: "pointer", letterSpacing: "0.05em",
            boxShadow: "0 0 40px rgba(124,158,255,0.35)",
            transition: "all 0.3s"
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 60px rgba(124,158,255,0.55)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 40px rgba(124,158,255,0.35)"; }}
          >
            セッションを始める
          </button>
          {sessions.length > 0 && (
            <button onClick={() => setScreen("history")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", borderRadius: 50, padding: "12px 32px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            >
              過去のセッションを見る ({sessions.length})
            </button>
          )}
        </div>

        {/* Features */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, width: "100%", marginBottom: 56, animation: "fadeUp 0.8s ease 0.4s both" }}>
          {[
            { icon: "🧠", title: "5フェーズ構造", desc: "傾聴→掘り下げ→価値観→ビジョン→行動" },
            { icon: "✨", title: "リアルタイム気づき", desc: "会話中に価値観・キーワードが浮かび上がる" },
            { icon: "📈", title: "成長トラッキング", desc: "セッションを重ねるほど自己理解が深まる" },
          ].map((f, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "24px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{f.title}</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Theory basis */}
        <div style={{ width: "100%", background: "rgba(124,158,255,0.05)", border: "1px solid rgba(124,158,255,0.12)", borderRadius: 20, padding: "24px 28px", animation: "fadeUp 0.8s ease 0.5s both" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(124,158,255,0.6)", marginBottom: 16, fontWeight: 600 }}>EVIDENCE-BASED</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {THEORY_BASIS.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7C9EFF", flexShrink: 0, marginTop: 7 }} />
                <div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, lineHeight: 1.5 }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  );

  // ── REPORT GENERATING ────────────────────────────────────
  if (generatingReport) return (
    <div style={{ minHeight: "100vh", background: "#0D0D14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", maxWidth: 480, padding: 32 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #7C9EFF, #06D6A0)", margin: "0 auto 32px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, animation: "pulse 2s ease-in-out infinite" }}>🧭</div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", color: "white", fontSize: 28, marginBottom: 12 }}>人生設計図を生成中</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 40, fontSize: 15 }}>あなたの会話から、すべてを分析しています...</p>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 50, height: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 50, background: "linear-gradient(90deg, #7C9EFF, #06D6A0)", width: `${reportProgress}%`, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>{Math.round(reportProgress)}%</div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 30px rgba(124,158,255,0.4)} 50%{box-shadow:0 0 60px rgba(124,158,255,0.8)} } *{box-sizing:border-box}`}</style>
    </div>
  );

  // ── REPORT ───────────────────────────────────────────────
  if (screen === "report" && report) return <ReportScreen report={report} onNewSession={() => { startSession(); }} onBack={() => setScreen("welcome")} />;

  // ── HISTORY ──────────────────────────────────────────────
  if (screen === "history") return (
    <div style={{ minHeight: "100vh", background: "#0D0D14", fontFamily: "'DM Sans', sans-serif", padding: "40px 24px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={() => setScreen("welcome")} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14, marginBottom: 32, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>← 戻る</button>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", color: "white", fontSize: 32, marginBottom: 8 }}>セッション履歴</h2>
        <p style={{ color: "rgba(255,255,255,0.35)", marginBottom: 40, fontSize: 15 }}>{sessions.length}回のセッションが記録されています</p>

        {/* Growth chart */}
        {growthData.length > 1 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 28, marginBottom: 32 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em", marginBottom: 20 }}>成長トラッキング</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { key: "selfAwareness", label: "自己認識", color: "#7C9EFF" },
                { key: "clarity", label: "明確さ", color: "#06D6A0" },
                { key: "motivation", label: "モチベ", color: "#FFD166" },
                { key: "actionReady", label: "行動力", color: "#FF6B9D" },
              ].map(item => {
                const latest = growthData[growthData.length - 1]?.[item.key] || 0;
                const prev = growthData[growthData.length - 2]?.[item.key] || 0;
                const diff = latest - prev;
                return (
                  <div key={item.key} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{latest}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>{item.label}</div>
                    {diff !== 0 && <div style={{ fontSize: 11, color: diff > 0 ? "#06D6A0" : "#FF6B6B", fontWeight: 600 }}>{diff > 0 ? `+${diff}` : diff}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sessions.map((s, i) => (
          <div key={s.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ color: "white", fontWeight: 600, fontSize: 16 }}>{s.report?.personalityType || "セッション"}</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 2 }}>{s.date} · {s.turns}ターン</div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: 50 }}>#{sessions.length - i}</div>
            </div>
            {s.insights?.keywords?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {s.insights.keywords.map((kw, ki) => (
                  <span key={ki} style={{ fontSize: 12, color: "rgba(124,158,255,0.8)", background: "rgba(124,158,255,0.1)", padding: "3px 10px", borderRadius: 50 }}>{kw}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <style>{`*{box-sizing:border-box}`}</style>
    </div>
  );

  // ── CHAT ─────────────────────────────────────────────────
  const currentPhase = PHASES[phase - 1];

  return (
    <div style={{ height: "100vh", background: "#0D0D14", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "rgba(13,13,20,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #7C9EFF, #06D6A0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧭</div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", color: "white", fontSize: 16, lineHeight: 1 }}>COMPASS</div>
            <div style={{ color: currentPhase.color, fontSize: 11, marginTop: 2, fontWeight: 500 }}>{currentPhase.icon} {currentPhase.name}フェーズ</div>
          </div>
        </div>

        {/* Phase progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {PHASES.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: phase > p.id ? 8 : phase === p.id ? 10 : 6,
                height: phase > p.id ? 8 : phase === p.id ? 10 : 6,
                borderRadius: "50%",
                background: phase > p.id ? p.color : phase === p.id ? p.color : "rgba(255,255,255,0.15)",
                boxShadow: phase === p.id ? `0 0 10px ${p.color}` : "none",
                transition: "all 0.4s"
              }} />
              {i < 4 && <div style={{ width: 16, height: 1, background: phase > p.id ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)" }} />}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {turnCount >= 8 && (
            <button onClick={generateReport} style={{
              background: "linear-gradient(135deg, #7C9EFF, #06D6A0)",
              color: "white", border: "none", borderRadius: 50,
              padding: "8px 20px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit"
            }}>レポート生成</button>
          )}
          <button onClick={() => setScreen("welcome")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", borderRadius: 50, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>終了</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 28, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "msgIn 0.4s ease" }}>
              {m.role === "assistant" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${PHASES[(m.phase || 1) - 1].color}, ${PHASES[Math.min((m.phase || 1), 4)].color})`, flexShrink: 0, marginRight: 12, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, boxShadow: `0 0 16px ${PHASES[(m.phase || 1) - 1].color}50` }}>🧭</div>
              )}
              <div style={{ maxWidth: "78%", padding: "14px 20px", borderRadius: m.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px", background: m.role === "user" ? "rgba(124,158,255,0.15)" : "rgba(255,255,255,0.04)", border: m.role === "user" ? "1px solid rgba(124,158,255,0.25)" : "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.88)", fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap", fontWeight: 300 }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${currentPhase.color}, #06D6A0)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🧭</div>
              <div style={{ display: "flex", gap: 5, padding: "14px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px 20px 20px 4px" }}>
                {[0, 1, 2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: currentPhase.color, opacity: 0.6, animation: `blink 1.2s ease-in-out ${j * 0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Insight Panel */}
      {insights.keywords.length > 0 && (
        <div style={{ flexShrink: 0, background: "rgba(13,13,20,0.98)", borderTop: `1px solid ${insightOpen ? "rgba(124,158,255,0.2)" : "rgba(255,255,255,0.06)"}`, transition: "all 0.3s" }}>
          <button onClick={() => setInsightOpen(o => !o)} style={{ width: "100%", background: "transparent", border: "none", padding: "12px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C9EFF", boxShadow: "0 0 8px #7C9EFF", animation: "pulse2 2s ease-in-out infinite" }} />
              <span style={{ color: "rgba(124,158,255,0.8)", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em" }}>あなたの気づき</span>
              <div style={{ display: "flex", gap: 6 }}>
                {insights.keywords.slice(0, 3).map((kw, i) => (
                  <span key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 50 }}>{kw}</span>
                ))}
              </div>
            </div>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, transform: insightOpen ? "rotate(180deg)" : "none", transition: "transform 0.3s", display: "inline-block" }}>▲</span>
          </button>

          {insightOpen && (
            <div style={{ padding: "0 24px 20px", maxWidth: 680, margin: "0 auto", animation: "fadeUp 0.3s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  { key: "selfAwareness", label: "自己認識", color: "#7C9EFF" },
                  { key: "clarity", label: "明確さ", color: "#06D6A0" },
                  { key: "motivation", label: "モチベ", color: "#FFD166" },
                  { key: "actionReady", label: "行動準備", color: "#FF6B9D" },
                ].map(item => (
                  <div key={item.key} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{insights.scores?.[item.key] || 0}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                      <div style={{ height: "100%", borderRadius: 2, background: item.color, width: `${insights.scores?.[item.key] || 0}%`, transition: "width 1s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
              {insights.insight && (
                <div style={{ background: "rgba(124,158,255,0.06)", border: "1px solid rgba(124,158,255,0.15)", borderRadius: 12, padding: "12px 16px" }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, fontStyle: "italic" }}>💡 {insights.insight}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ flexShrink: 0, background: "rgba(13,13,20,0.98)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px 20px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 12, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="話してみてください..."
            rows={2}
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "14px 18px", color: "rgba(255,255,255,0.88)", fontSize: 15, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, resize: "none", outline: "none", transition: "border-color 0.2s", fontWeight: 300 }}
            onFocus={e => e.target.style.borderColor = "rgba(124,158,255,0.4)"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{ width: 48, height: 48, borderRadius: "50%", background: input.trim() ? `linear-gradient(135deg, ${currentPhase.color}, #06D6A0)` : "rgba(255,255,255,0.06)", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: input.trim() ? `0 0 20px ${currentPhase.color}50` : "none", transition: "all 0.2s" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "white" : "rgba(255,255,255,0.2)"} strokeWidth="2.5"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
        <div style={{ maxWidth: 680, margin: "6px auto 0", textAlign: "right" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{turnCount}ターン完了 · {turnCount >= 8 ? "レポート生成可能" : `あと${8 - turnCount}ターンでレポート生成可能`}</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes pulse2 { 0%,100%{opacity:0.6} 50%{opacity:1} }
        * { box-sizing:border-box; }
        textarea::-webkit-scrollbar{width:3px}
        textarea::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
      `}</style>
    </div>
  );
}

// ─── Report Screen ────────────────────────────────────────────
function ReportScreen({ report, onNewSession, onBack }) {
  const [tab, setTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "概要", emoji: "✨" },
    { id: "swot",     label: "SWOT", emoji: "📊" },
    { id: "vision",   label: "ビジョン", emoji: "🔭" },
    { id: "roadmap",  label: "ロードマップ", emoji: "🗺️" },
    { id: "actions",  label: "TOP5", emoji: "⚡" },
  ];
  const phaseColors = ["#7C9EFF", "#FF8C69", "#FFD166", "#06D6A0", "#FF6B9D"];

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FC", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0D0D14 0%, #1a1a2e 100%)", padding: "56px 24px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 30% 50%, rgba(124,158,255,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(6,214,160,0.12) 0%, transparent 50%)" }} />
        <div style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "rgba(255,255,255,0.35)", marginBottom: 20, fontWeight: 600 }}>YOUR LIFE DESIGN REPORT</div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: "white", fontSize: "clamp(28px,5vw,44px)", marginBottom: 20, lineHeight: 1.2 }}>あなたの人生設計図</h1>
          <div style={{ display: "inline-block", background: "linear-gradient(135deg, #7C9EFF, #06D6A0)", borderRadius: 50, padding: "10px 32px", marginBottom: 20 }}>
            <span style={{ color: "white", fontWeight: 600, fontSize: 18 }}>「{report.personalityType}」</span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.8, fontWeight: 300 }}>{report.summary}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "white", borderBottom: "1px solid #eee", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", overflowX: "auto", padding: "0 16px" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "18px 20px", border: "none", borderBottom: tab === t.id ? "3px solid #7C9EFF" : "3px solid transparent", background: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif", fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#7C9EFF" : "#aaa", fontSize: 14, transition: "all 0.2s" }}>
              <span>{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>

        {tab === "overview" && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <div style={{ background: "linear-gradient(135deg, #7C9EFF10, #06D6A010)", border: "1.5px solid #7C9EFF25", borderRadius: 24, padding: 36, marginBottom: 24 }}>
              <p style={{ fontSize: 16, lineHeight: 2, color: "#333", margin: 0, textAlign: "center", fontStyle: "italic" }}>「{report.message}」</p>
            </div>
            <div style={{ background: "white", borderRadius: 24, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#aaa", marginBottom: 16, fontWeight: 600 }}>EVIDENCE-BASED</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {THEORY_BASIS.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", background: "#F8F9FF", borderRadius: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: phaseColors[i], flexShrink: 0, marginTop: 7 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "swot" && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 24, color: "#1a1a2e" }}>SWOT分析</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { key: "strengths",    label: "強み", sub: "Strengths",    color: "#06D6A0", bg: "#F0FFFE", icon: "💪" },
                { key: "weaknesses",   label: "課題", sub: "Weaknesses",   color: "#FF8C69", bg: "#FFF5F0", icon: "🔧" },
                { key: "opportunities",label: "機会", sub: "Opportunities", color: "#7C9EFF", bg: "#F5F7FF", icon: "🚀" },
                { key: "threats",      label: "リスク",sub: "Threats",     color: "#aaa",    bg: "#F8F8F8", icon: "⚠️" },
              ].map(sw => (
                <div key={sw.key} style={{ background: sw.bg, border: `1.5px solid ${sw.color}25`, borderRadius: 20, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: 18 }}>{sw.icon}</span>
                    <span style={{ fontWeight: 700, color: sw.color, fontSize: 14 }}>{sw.label} <span style={{ opacity: 0.5, fontSize: 12 }}>({sw.sub})</span></span>
                  </div>
                  {(report.swot?.[sw.key] || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: sw.color, flexShrink: 0, marginTop: 8 }} />
                      <span style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "vision" && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 24, color: "#1a1a2e" }}>10年後のビジョン</h2>
            <div style={{ background: "linear-gradient(135deg, #0D0D14, #1a1a2e)", borderRadius: 28, padding: "52px 48px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(6,214,160,0.18) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(124,158,255,0.18) 0%, transparent 50%)" }} />
              <div style={{ position: "relative", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 28 }}>🔭</div>
                <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 17, lineHeight: 2, margin: 0, fontStyle: "italic", fontWeight: 300 }}>{report.vision}</p>
              </div>
            </div>
          </div>
        )}

        {tab === "roadmap" && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 28, color: "#1a1a2e" }}>年次ロードマップ</h2>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 26, top: 0, bottom: 0, width: 2, background: "linear-gradient(180deg, #7C9EFF, #06D6A0, #FFD166, #FF6B9D)" }} />
              {(report.roadmap || []).map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 24, marginBottom: 24 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: phaseColors[i], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 11, flexShrink: 0, zIndex: 1, boxShadow: `0 0 20px ${phaseColors[i]}50`, textAlign: "center", lineHeight: 1.3 }}>{r.period.replace("年目", "").replace("〜", "-")}<br /><span style={{ fontSize: 8 }}>年目</span></div>
                  <div style={{ flex: 1, background: "white", borderRadius: 20, padding: "20px 24px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", border: `1.5px solid ${phaseColors[i]}18` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>{r.period}</span>
                      <span style={{ background: `${phaseColors[i]}18`, color: phaseColors[i], fontSize: 12, fontWeight: 600, padding: "3px 12px", borderRadius: 50 }}>{r.theme}</span>
                    </div>
                    {(r.actions || []).map((a, ai) => (
                      <div key={ai} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        <span style={{ color: phaseColors[i], fontWeight: 700, fontSize: 14, flexShrink: 0 }}>→</span>
                        <span style={{ fontSize: 14, color: "#555", lineHeight: 1.5 }}>{a}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 14, padding: "10px 14px", background: `${phaseColors[i]}10`, borderRadius: 10, borderLeft: `3px solid ${phaseColors[i]}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: phaseColors[i] }}>🏆 </span>
                      <span style={{ fontSize: 13, color: "#555" }}>{r.milestone}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "actions" && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 8, color: "#1a1a2e" }}>今すぐやるべき TOP5</h2>
            <p style={{ color: "#aaa", marginBottom: 28, fontSize: 15 }}>あなたの会話から導き出された、最重要アクションです。</p>
            {(report.top5 || []).map((a, i) => (
              <div key={i} style={{ background: "white", borderRadius: 20, padding: "24px 28px", marginBottom: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.05)", border: `1.5px solid ${phaseColors[i]}18`, display: "flex", gap: 20, transition: "all 0.2s", cursor: "default" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${phaseColors[i]}20`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.05)"; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: phaseColors[i], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: "#1a1a2e", marginBottom: 6 }}>{a.action}</div>
                  <div style={{ fontSize: 14, color: "#666", lineHeight: 1.7, marginBottom: 10 }}>{a.detail}</div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${phaseColors[i]}12`, color: phaseColors[i], padding: "4px 14px", borderRadius: 50, fontSize: 12, fontWeight: 600 }}>⏰ {a.by}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 56, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          <button onClick={onNewSession} style={{ background: "linear-gradient(135deg, #7C9EFF, #06D6A0)", color: "white", border: "none", borderRadius: 50, padding: "14px 36px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>新しいセッションを始める</button>
          <button onClick={onBack} style={{ background: "transparent", border: "1.5px solid #ddd", borderRadius: 50, padding: "14px 32px", fontSize: 14, color: "#aaa", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>トップへ戻る</button>
        </div>
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>
    </div>
  );
}
