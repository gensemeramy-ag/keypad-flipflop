import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const C = {
  bg: "#07111f",
  panel: "#101e30",
  panel2: "#14263a",
  line: "#29415a",
  muted: "#9ab0c4",
  text: "#f2f7fb",
  cyan: "#55d6e8",
  green: "#70e0aa",
  amber: "#ffc66d",
  red: "#ff7b82",
  dark: "#07111b",
};

type Step = {
  at: number;
  key: string;
  expected: string;
  d: string;
  next: string;
  valid: boolean;
  note: string;
};

const STEPS: Step[] = [
  { at: 150, key: "2", expected: "2", d: "01", next: "WAIT 5", valid: true, note: "First key accepted" },
  { at: 340, key: "5", expected: "5", d: "10", next: "WAIT 8", valid: true, note: "Second key accepted" },
  { at: 530, key: "4", expected: "8", d: "00", next: "WAIT 2", valid: false, note: "Wrong key → reset" },
  { at: 720, key: "2", expected: "2", d: "01", next: "WAIT 5", valid: true, note: "Try again: first key" },
  { at: 910, key: "5", expected: "5", d: "10", next: "WAIT 8", valid: true, note: "Try again: second key" },
  { at: 1100, key: "8", expected: "8", d: "11", next: "UNLOCK", valid: true, note: "Correct sequence → unlock" },
];

const getEventPhase = (frame: number, step: Step | undefined) => {
  if (!step) return "idle";
  const t = frame - step.at;
  if (t < 0) return "idle";
  if (t < 24) return "press";
  if (t < 52) return "decode";
  if (t < 78) return "compare";
  if (t < 100) return "data";
  if (t < 126) return "clock";
  return "hold";
};

const stateBefore = (frame: number) => {
  let state = "00";
  for (const s of STEPS) {
    if (frame >= s.at + 100) state = s.d;
  }
  return state;
};

const Panel: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22, ...style }}>{children}</div>
);

const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.muted }) => (
  <div style={{ color, fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{children}</div>
);

const Keypad: React.FC<{ frame: number; activeKey: string | null }> = ({ frame, activeKey }) => {
  const press = STEPS.find((s) => frame >= s.at && frame < s.at + 24)?.key;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "✕", "0", "↵"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: 18, background: "#0a1725", border: `1px solid ${C.line}`, borderRadius: 18, width: 190 }}>
      {keys.map((key) => {
        const down = key === press;
        const selected = key === activeKey;
        return <div key={key} style={{ height: 42, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, background: down ? C.cyan : selected ? "#18364b" : C.panel2, color: down ? C.dark : selected ? C.cyan : C.text, fontSize: 22, fontWeight: 800, border: `1px solid ${down ? C.cyan : C.line}`, scale: down ? "0.94" : "1" }}>{key}</div>;
      })}
    </div>
  );
};

const Door: React.FC<{ unlocked: boolean }> = ({ unlocked }) => (
  <svg width="230" height="255" viewBox="0 0 230 255" role="img">
    <rect x="20" y="17" width="190" height="222" rx="8" fill="#102337" stroke={C.line} strokeWidth="4" />
    <rect x="38" y={unlocked ? 95 : 30} width="154" height={unlocked ? 125 : 190} rx="5" fill="#1a3148" stroke={unlocked ? C.green : "#547089"} strokeWidth="4" />
    {[0, 1, 2, 3, 4].map((n) => <line key={n} x1="42" x2="188" y1={unlocked ? 112 + n * 19 : 60 + n * 31} y2={unlocked ? 112 + n * 19 : 60 + n * 31} stroke="#304a63" strokeWidth="3" />)}
    <circle cx="174" cy={unlocked ? 204 : 132} r="6" fill={unlocked ? C.green : C.amber} />
    {unlocked && <path d="M174 102v-18a16 16 0 0 1 32 0v18" fill="none" stroke={C.green} strokeWidth="7" strokeLinecap="round" />}
  </svg>
);

const Waveform: React.FC<{ frame: number; event: Step | undefined }> = ({ frame, event }) => {
  const base = event?.at ?? 0;
  const t = frame - base;
  const sampleX = 68 + Math.max(0, Math.min(1, t / 126)) * 438;
  const rows = [
    { y: 38, label: "D₀", high: event ? event.d.endsWith("1") : false, color: C.amber },
    { y: 87, label: "CLK", high: t >= 100 && t < 126, color: C.cyan },
    { y: 136, label: "Q₀", high: stateBefore(frame).endsWith("1"), color: C.green },
  ];
  return (
    <svg viewBox="0 0 560 172" width="100%" height="172" style={{ overflow: "visible" }}>
      {rows.map((row) => {
        let path = `M 68 ${row.y + 12}`;
        if (row.label === "CLK") path += " H 416 V 62 H 506 V 99 H 506";
        else if (row.label === "D₀") path += ` H 339 V ${row.high ? row.y - 4 : row.y + 12} H 506`;
        else path += ` H ${t >= 100 ? 416 : 339} V ${row.high ? row.y - 4 : row.y + 12} H 506`;
        return <g key={row.label}>
          <text x="4" y={row.y + 8} fill={C.muted} fontSize="15" fontWeight="700">{row.label}</text>
          <path d={path} fill="none" stroke={row.color} strokeWidth="4" strokeLinejoin="round" opacity={event ? 1 : 0.6} />
        </g>;
      })}
      <line x1={sampleX} x2={sampleX} y1="8" y2="158" stroke="#ffffff" strokeDasharray="5 6" opacity="0.5" />
      <text x="68" y="168" fill={C.muted} fontSize="13">before edge</text>
      <text x="390" y="168" fill={C.muted} fontSize="13">sample / hold</text>
    </svg>
  );
};

export const MyComposition = () => (
  <Composition id="KeypadSequence" component={KeypadSequence} durationInFrames={1440} fps={30} width={1920} height={1080} />
);

const KeypadSequence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const current = [...STEPS].reverse().find((s) => frame >= s.at);
  const previous = [...STEPS].reverse().find((s) => frame >= s.at + 126);
  const phase = getEventPhase(frame, current);
  const q = stateBefore(frame);
  const unlocked = q === "11";
  const inputLit = phase === "press" || phase === "decode";
  const compareLit = phase === "compare";
  const dataLit = phase === "data" || phase === "clock";
  const clockLit = phase === "clock";
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const headline = (() => {
    if (frame < 150) return "A keypad press becomes stored state";
    if (!current) return "Enter code 2 • 5 • 8";
    if (phase === "press") return `Key ${current.key} pressed`;
    if (phase === "decode") return `The keypad decodes ${current.key} into an input signal`;
    if (phase === "compare" && !current.valid) return `Mismatch: ${current.key} is not the expected ${current.expected}`;
    if (phase === "compare") return `Match: ${current.key} is correct; prepare next state ${current.d}`;
    if (phase === "data" && !current.valid) return "D = 00 is prepared as the reset state";
    if (phase === "data") return `D = ${current.d} is ready for the next clock edge`;
    if (phase === "clock" && !current.valid) return "Rising clock edge loads 00 into Q — sequence resets";
    if (phase === "clock") return `Rising clock edge copies D = ${current.d} into Q`;
    if (!current.valid) return "Reset complete: Q holds 00; enter 2 to start again";
    if (current.d === "11") return "State 11: code accepted — unlock output turns on";
    return `Q holds ${current.d}; circuit now expects ${current.next.replace("WAIT ", "key ")}`;
  })();
  const activeKey = inputLit ? current?.key ?? null : null;
  const codeProgress = unlocked ? "2   5   8" : q === "10" ? "2   5   _" : q === "01" ? "2   _   _" : "_   _   _";
  const expected = current && phase !== "idle" ? current.expected : q === "00" ? "2" : q === "01" ? "5" : q === "10" ? "8" : "—";
  const decoded = current && phase !== "idle" ? current.key : "—";
  const match = current && (phase === "compare" || phase === "data" || phase === "clock" || phase === "hold") ? current.valid : undefined;
  const dataValue = current && (phase === "data" || phase === "clock") ? current.d : current && phase === "hold" ? current.d : previous?.d ?? "00";
  const doorOpacity = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.bg, color: C.text, fontFamily: "Inter, Avenir Next, Arial, sans-serif", padding: "48px 64px", opacity: doorOpacity }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <Label color={C.cyan}>Digital Electronics • Sequential Logic</Label>
          <div style={{ fontSize: 48, fontWeight: 850, letterSpacing: -1, marginTop: 9 }}>How the keypad remembers</div>
        </div>
        <div style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 14, padding: "12px 18px", color: C.muted, fontSize: 16 }}>SAMPLE CODE <b style={{ color: C.text, marginLeft: 10 }}>2 → 5 → 8</b></div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: current?.valid === false && phase !== "idle" ? C.red : C.text, minHeight: 38, marginBottom: 18, opacity: titleOpacity }}>{headline}</div>
      <div style={{ display: "grid", gridTemplateColumns: "620px 1fr", gap: 22, height: 760 }}>
        <Panel style={{ padding: 26, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <Label>Macro • real-world system</Label>
            <span style={{ color: unlocked ? C.green : C.amber, fontSize: 16, fontWeight: 800 }}>{unlocked ? "ACCESS GRANTED" : "LOCKED"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flex: 1 }}>
            <div style={{ textAlign: "center" }}>
              <Keypad frame={frame} activeKey={activeKey} />
              <div style={{ marginTop: 14, color: C.muted, fontSize: 17 }}>KEYPAD</div>
              <div style={{ marginTop: 8, minHeight: 30, color: inputLit ? C.cyan : C.muted, fontFamily: "monospace", fontSize: 20, fontWeight: 800 }}>{inputLit ? `KEY ${current?.key} PRESSED` : "READY"}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <Door unlocked={unlocked} />
              <div style={{ marginTop: 10, color: C.muted, fontSize: 17 }}>GARAGE DOOR</div>
              <div style={{ color: unlocked ? C.green : C.muted, fontSize: 18, fontWeight: 800, marginTop: 7 }}>{unlocked ? "OPENING" : "CLOSED"}</div>
            </div>
          </div>
          <div style={{ background: C.panel2, borderRadius: 15, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><Label>Sequence progress</Label><div style={{ fontFamily: "monospace", fontSize: 27, letterSpacing: 5, marginTop: 8, color: unlocked ? C.green : C.text }}>{codeProgress}</div>
              {current && !current.valid && phase !== "idle" && <div style={{ color: C.red, fontSize: 16, fontWeight: 750, marginTop: 7 }}>Key {current.key} entered • expected {current.expected} • reset to start</div>}
            </div>
            <div style={{ width: 12, height: 12, borderRadius: 20, background: unlocked ? C.green : C.amber, boxShadow: `0 0 16px ${unlocked ? C.green : C.amber}` }} />
          </div>
        </Panel>

        <Panel style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>Micro • signals and memory</Label>
            <div style={{ color: C.muted, fontSize: 16 }}>The flip-flops store <b style={{ color: C.text }}>progress</b>, not the printed digit.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { title: "1  DECODE", value: decoded, sub: inputLit ? "key → binary code" : "keypad input", active: inputLit, color: C.cyan },
              { title: "2  COMPARE", value: match === undefined ? "—" : match ? "MATCH" : "NO MATCH", sub: `expected key ${expected}`, active: compareLit || match !== undefined && phase !== "hold", color: match === false ? C.red : C.amber },
              { title: "3  NEXT STATE", value: current && phase !== "idle" ? current.next : q === "00" ? "WAIT 2" : q === "01" ? "WAIT 5" : q === "10" ? "WAIT 8" : "UNLOCK", sub: "combinational logic", active: dataLit, color: C.green },
            ].map((box) => <div key={box.title} style={{ minHeight: 104, borderRadius: 15, border: `1px solid ${box.active ? box.color : C.line}`, background: box.active ? `${box.color}12` : C.panel2, padding: "14px 16px" }}>
              <Label color={box.active ? box.color : C.muted}>{box.title}</Label>
              <div style={{ fontSize: 24, fontWeight: 850, color: box.active ? box.color : C.text, marginTop: 9 }}>{box.value}</div>
              <div style={{ fontSize: 15, color: C.muted, marginTop: 4 }}>{box.sub}</div>
            </div>)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18, flex: 1, minHeight: 260 }}>
            <div style={{ background: C.dark, border: `1px solid ${C.line}`, borderRadius: 16, padding: "17px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}><Label>Timing • what changes when</Label><span style={{ color: C.muted, fontSize: 14 }}>logic level</span></div>
              <Waveform frame={frame} event={current} />
              <div style={{ color: C.muted, fontSize: 15, lineHeight: 1.4 }}>D can settle before the edge. <b style={{ color: C.cyan }}>On the rising clock edge</b>, Q takes D; between edges, Q holds its value.</div>
            </div>
            <div style={{ background: C.dark, border: `1px solid ${clockLit ? C.cyan : C.line}`, borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div><Label>D FLIP-FLOP • 2 BITS</Label><div style={{ fontSize: 17, color: C.muted, marginTop: 8 }}>State register</div></div>
              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                {[0, 1].map((i) => <div key={i} style={{ width: 82, height: 104, borderRadius: 13, border: `2px solid ${clockLit ? C.cyan : C.line}`, background: C.panel2, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                  <div style={{ color: C.amber, fontSize: 16, fontWeight: 800 }}>D{i}</div><div style={{ color: C.text, fontFamily: "monospace", fontSize: 26, margin: "4px 0 8px" }}>{dataValue[i] ?? "0"}</div>
                  <div style={{ width: 1, height: 1, borderLeft: `10px solid ${clockLit ? C.cyan : C.muted}`, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", transform: "rotate(90deg)" }} />
                  <div style={{ color: C.green, fontSize: 16, fontWeight: 800, marginTop: 5 }}>Q{i} <span style={{ color: C.text, fontFamily: "monospace", marginLeft: 6 }}>{q[i] ?? "0"}</span></div>
                </div>)}
              </div>
              <div style={{ borderRadius: 10, background: clockLit ? "#16394a" : C.panel2, padding: "11px 13px", textAlign: "center", color: clockLit ? C.cyan : C.muted, fontWeight: 800, fontSize: 16 }}>CLK {clockLit ? "↑ SAMPLE NOW" : "— WAITING"}</div>
            </div>
          </div>
          <div style={{ background: C.dark, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <Label>What the two stored bits mean</Label><span style={{ color: C.muted, fontSize: 14 }}>state progress • not the keypad digit</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { bits: "00", meaning: "Waiting for 2" },
                { bits: "01", meaning: "2 accepted • wait for 5" },
                { bits: "10", meaning: "2, 5 accepted • wait for 8" },
                { bits: "11", meaning: "Code complete • unlock" },
              ].map((item) => {
                const active = q === item.bits;
                return <div key={item.bits} style={{ border: `1px solid ${active ? C.green : C.line}`, background: active ? "#102c2a" : C.panel2, borderRadius: 9, padding: "9px 11px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: active ? C.green : C.amber, fontFamily: "monospace", fontSize: 20, fontWeight: 850 }}>{item.bits}</span>
                  <span style={{ color: active ? C.text : C.muted, fontSize: 14, fontWeight: active ? 750 : 550 }}>{item.meaning}</span>
                </div>;
              })}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.panel2, borderRadius: 13, padding: "13px 18px" }}>
            <div style={{ color: C.muted, fontSize: 16 }}>STORED STATE <b style={{ color: C.green, fontFamily: "monospace", fontSize: 22, marginLeft: 12 }}>{q}</b></div>
            <div style={{ color: unlocked ? C.green : current?.valid === false && phase !== "idle" ? C.red : C.muted, fontSize: 16, fontWeight: 800 }}>
              {unlocked ? "UNLOCK OUTPUT = 1" : current?.valid === false && phase === "compare" ? "MISMATCH IN CODE SEQUENCE = RESET" : current?.valid === false && phase === "data" ? "RESET VALUE READY • Q STILL HOLDS" : current?.valid === false && phase === "clock" ? "CLOCK EDGE • Q BECOMES 00" : current?.valid === false && phase === "hold" ? "RESET COMPLETE • WAITING FOR 2" : "Q HOLDS BETWEEN CLOCK EDGES"}
            </div>
          </div>
        </Panel>
      </div>
      <div style={{ position: "absolute", bottom: 22, left: 64, right: 64, display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 14 }}><span>Teaching model • simplified keypad encoding and state machine</span><span>Q is memory • the expected key depends on the current state</span></div>
    </AbsoluteFill>
  );
};
