import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { getProgram, getPda, toFixedU8_64, u8ToStringTrim } from "./anchorClient";

function usePhantom() {
  const [pubkey, setPubkey] = useState<PublicKey | null>(null);

  const connect = useCallback(async () => {
    const anyWin = window as any;
    const provider = anyWin?.solana;

    if (!provider || !provider.isPhantom) {
      alert("Phantom nu este instalat. Instalează extensia și reîncarcă pagina.");
      return;
    }

    try {
      const resp = await provider.connect(); // user gesture -> deschide popup
      setPubkey(resp.publicKey ?? null);
    } catch (e) {
      console.error("Phantom connect error:", e);
    }
  }, []);

  // dacă user-ul e deja conectat în Phantom, îl luăm
  useEffect(() => {
    const anyWin = window as any;
    const provider = anyWin?.solana;
    if (provider?.isPhantom) {
      provider.connect({ onlyIfTrusted: true }).then(
        (r: any) => setPubkey(r?.publicKey ?? null),
        () => {}
      );
    }
  }, []);

  return { pubkey, connect };
}

export default function App() {
  const { pubkey, connect } = usePhantom();
  const [status, setStatus] = useState<string>("");
  const [generated, setGenerated] = useState<string>("");
  const [onchain, setOnchain] = useState<string>("");

  const shortPk = useMemo(
    () => (pubkey ? `${pubkey.toBase58().slice(0, 4)}…${pubkey.toBase58().slice(-4)}` : ""),
    [pubkey]
  );

  const ensureProgram = useCallback(() => {
    const { program, provider } = getProgram();
    if (!provider.wallet?.publicKey) throw new Error("Wallet neconectat.");
    return { program, provider };
  }, []);

  const handleInit = useCallback(async () => {
    try {
      setStatus("Initializing PDA…");
      const { program, provider } = ensureProgram();
      const authority = provider.wallet.publicKey!;
      const pda = await getPda(authority);

      await program.methods
        .initUser()
        .accounts({
          userData: pda,
          authority,
          systemProgram: anchor.web3.SystemProgram.programId, // dacă ai tipuri globale; altfel importă SystemProgram
        })
        .rpc();

      setStatus("PDA inițializat.");
    } catch (e: any) {
      console.error(e);
      setStatus(`Init error: ${e?.message ?? e}`);
    }
  }, [ensureProgram]);

  const handleGenerate = useCallback(() => {
    // generator foarte simplu; schimbă-l cu ce vrei tu
    const base = "shadow";
    const n = Math.floor(Math.random() * 10_000);
    const s = `${base}-${n}`;
    setGenerated(s);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      if (!generated) {
        setStatus("Nu ai un nume generat. Apasă Generate.");
        return;
      }
      setStatus("Saving name on-chain…");
      const { program, provider } = ensureProgram();
      const authority = provider.wallet.publicKey!;
      const pda = await getPda(authority);

      const fixed = toFixedU8_64(generated); // === [u8;64]

      await program.methods
        .setName(fixed)
        .accounts({
          userData: pda,
          authority,
        })
        .rpc();

      setStatus("Saved.");
    } catch (e: any) {
      console.error(e);
      setStatus(`Save error: ${e?.message ?? e}`);
    }
  }, [generated, ensureProgram]);

  const handleRead = useCallback(async () => {
    try {
      setStatus("Reading on-chain…");
      const { program, provider } = ensureProgram();
      const authority = provider.wallet.publicKey!;
      const pda = await getPda(authority);

      const acc = await program.account.userData.fetch(pda);
      const name = u8ToStringTrim(acc.name);
      setOnchain(name || "—");
      setStatus("Read OK.");
    } catch (e: any) {
      console.error(e);
      setStatus(`Read error: ${e?.message ?? e}`);
    }
  }, [ensureProgram]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Sol NameGen — Devnet</h1>

        {!pubkey ? (
          <button style={styles.btn} onClick={connect}>
            Connect Phantom
          </button>
        ) : (
          <div style={styles.row}>
            <span style={styles.badge}>Wallet: {shortPk}</span>
            <button style={styles.btn} onClick={handleInit}>Init</button>
            <button style={styles.btn} onClick={handleGenerate}>Generate</button>
            <button style={{ ...styles.btn, opacity: generated ? 1 : 0.5 }} onClick={handleSave}>
              Save
            </button>
            <button style={styles.btn} onClick={handleRead}>Read</button>
          </div>
        )}

        <div style={{ height: 10 }} />

        <div style={styles.section}>
          <div><b>Generated:</b> <code>{generated || "—"}</code></div>
          <div><b>On-chain:</b> <code>{onchain || "—"}</code></div>
        </div>

        <div style={styles.footer}>
          <small>Status: {status || "idle"}</small>
        </div>
      </div>
    </div>
  );
}

// stil rapid ca să nu mai fie pagina „neagră și ilizibilă”
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0f17",
    color: "#e5e7eb",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: 24,
    fontFamily: "ui-sans-serif, system-ui, -apple-system",
  },
  card: {
    width: "100%",
    maxWidth: 920,
    background: "rgba(15,23,42,0.7)",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 6px 30px rgba(0,0,0,.35)",
  },
  title: { margin: 0, marginBottom: 12, fontSize: 24, lineHeight: 1.2 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  btn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #475569",
    background: "#111827",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  badge: {
    fontSize: 14,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#0f172a",
    border: "1px solid #334155",
  },
  section: {
    borderTop: "1px dashed #334155",
    marginTop: 14,
    paddingTop: 12,
    display: "grid",
    gap: 6,
  },
  footer: { marginTop: 10, opacity: 0.8 },
};
