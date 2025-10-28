"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { BorshCoder, Idl } from "@coral-xyz/anchor";
import idl from "../src/idl/namegen.json";
import {
  getProvider,           
  getPda,
  toFixedU8_64,
  u8ToStringTrim,
  SystemProgram,
} from "../src/anchorClient";

function usePhantom() {
  const [pubkey, setPubkey] = useState<PublicKey | null>(null);

  const connect = useCallback(async () => {
    const anyWin = window as any;
    const provider = anyWin?.solana;
    if (!provider?.isPhantom) return alert("Instalează Phantom și reîncarcă.");
    try {
      const r = await provider.connect();
      setPubkey(r.publicKey ?? null);
    } catch (e) {
      console.error("Phantom connect error:", e);
    }
  }, []);

  useEffect(() => {
    const anyWin = window as any;
    const provider = anyWin?.solana;
    provider?.isPhantom &&
      provider.connect({ onlyIfTrusted: true }).then(
        (r: any) => setPubkey(r?.publicKey ?? null),
        () => {}
      );
  }, []);

  return { pubkey, connect };
}

export default function Page() {
  const { pubkey, connect } = usePhantom();
  const [status, setStatus] = useState("");
  const [generated, setGenerated] = useState("");
  const [onchain, setOnchain] = useState("");

  // fix TS
  const coder = useMemo(() => new BorshCoder(idl as unknown as Idl), []);
  const PROGRAM_ID = useMemo(() => new PublicKey((idl as any).address), []);

  const shortPk = useMemo(
    () => (pubkey ? `${pubkey.toBase58().slice(0, 4)}…${pubkey.toBase58().slice(-4)}` : ""),
    [pubkey]
  );

  // Provider
  const ensure = useCallback(() => {
    const provider = getProvider();
    if (!provider.wallet?.publicKey) throw new Error("Wallet neconectat.");
    return { provider };
  }, []);

  
  const ixDisc = useCallback((name: string): Uint8Array => {
    const ins = (idl as any)?.instructions?.find((i: any) => i.name === name);
    if (!ins?.discriminator) throw new Error(`Missing discriminator for ${name}`);
    return Uint8Array.from(ins.discriminator as number[]);
  }, []);

  const buildIx = useCallback(
    (name: string, keys: { pubkey: PublicKey; isSigner?: boolean; isWritable?: boolean }[], dataTail?: Uint8Array) => {
      const data = dataTail
        ? Buffer.concat([Buffer.from(ixDisc(name)), Buffer.from(dataTail)])
        : Buffer.from(ixDisc(name));
      return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: keys.map(k => ({
          pubkey: k.pubkey,
          isSigner: !!k.isSigner,
          isWritable: !!k.isWritable,
        })),
        data,
      });
    },
    [PROGRAM_ID, ixDisc]
  );

  // ——— actions ———
  const handleInit = useCallback(async () => {
    try {
      setStatus("Initializing PDA…");
      const { provider } = ensure();
      const authority = provider.wallet.publicKey!;
      const pda = getPda(authority);

      // init_user(user_data, authority, system_program)
      const ix = buildIx("init_user", [
        { pubkey: pda, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId },
      ]);

      const tx = new Transaction().add(ix);
      await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
      setStatus("PDA inițializat.");
    } catch (e: any) {
      console.error("Init error stack:", e);
      setStatus(`Init error: ${e?.message ?? e}`);
    }
  }, [ensure, buildIx]);

  const handleGenerate = useCallback(() => {
    const n = Math.floor(Math.random() * 10_000);
    setGenerated(`shadow-${n}`);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      if (!generated) return setStatus("Apasă mai întâi Generate.");
      setStatus("Saving name on-chain…");
      const { provider } = ensure();
      const authority = provider.wallet.publicKey!;
      const pda = getPda(authority);

      const info = await provider.connection.getAccountInfo(pda);
      if (!info) {
        setStatus("No account. Apasă INIT mai întâi.");
        return;
      }

      const name64 = Uint8Array.from(toFixedU8_64(generated)); // [u8;64]

      // set_name(user_data, authority, name)
      const ix = buildIx("set_name", [
        { pubkey: pda, isWritable: true },
        { pubkey: authority, isSigner: true },
      ], name64);

      const tx = new Transaction().add(ix);
      await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
      setStatus("Saved.");
    } catch (e: any) {
      console.error("Save error stack:", e);
      setStatus(`Save error: ${e?.message ?? e}`);
    }
  }, [generated, ensure, buildIx]);

  const handleRead = useCallback(async () => {
    try {
      setStatus("Reading on-chain…");
    const { provider } = ensure();
      const authority = provider.wallet.publicKey!;
      const pda = getPda(authority);

      const info = await provider.connection.getAccountInfo(pda);
      if (!info) {
        setOnchain("—");
        setStatus("No account. Apasă INIT mai întâi.");
        return;
      }

      const decoded: any = coder.accounts.decode("UserData", info.data);
      const name = u8ToStringTrim(decoded.name);
      setOnchain(name || "—");
      setStatus("Read OK.");
    } catch (e: any) {
      console.error("Read error stack:", e);
      setStatus(`Read error: ${e?.message ?? e}`);
    }
  }, [ensure, coder]);

  const handleClear = useCallback(async () => {
    try {
      setStatus("Clearing name…");
      const { provider } = ensure();
      const authority = provider.wallet.publicKey!;
      const pda = getPda(authority);

      const info = await provider.connection.getAccountInfo(pda);
      if (!info) {
        setStatus("No account. Apasă INIT mai întâi.");
        return;
      }

      // clear_name(user_data, authority)
      const ix = buildIx("clear_name", [
        { pubkey: pda, isWritable: true },
        { pubkey: authority, isSigner: true },
      ]);

      const tx = new Transaction().add(ix);
      await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
      setOnchain("—");
      setStatus("Cleared.");
    } catch (e: any) {
      console.error("Clear error stack:", e);
      setStatus(`Clear error: ${e?.message ?? e}`);
    }
  }, [ensure, buildIx]);

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
            <button
              style={{ ...styles.btn, opacity: generated ? 1 : 0.5 }}
              onClick={handleSave}
            >
              Save
            </button>
            <button style={styles.btn} onClick={handleRead}>Read</button>
            <button style={styles.btn} onClick={handleClear}>Clear</button>
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
