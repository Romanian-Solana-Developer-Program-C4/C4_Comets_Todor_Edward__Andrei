"use client";

import { useEffect, useMemo, useState } from "react";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import rawIdl from "../idl/namegen.json";

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER || "devnet";


function patchIdlForUserData(raw: any) {
  const idl = JSON.parse(JSON.stringify(raw));

  const forceArrayField = (node: any) => {
    if (!node || node.kind !== "struct" || !Array.isArray(node.fields)) return;
    node.fields = node.fields.map((f: any) => {
      if (f?.name === "name") {
        
        if (
          !f.type ||
          (typeof f.type === "string" && f.type.toLowerCase() === "string") ||
          (typeof f.type === "object" && !("array" in f.type))
        ) {
          f.type = { array: ["u8", 64] };
        }
      }
      return f;
    });
  };

  if (Array.isArray(idl.types)) {
    idl.types.forEach((t: any) => {
      if (t?.name === "UserData" && t?.type) forceArrayField(t.type);
    });
  }
  if (Array.isArray(idl.accounts)) {
    idl.accounts.forEach((acc: any) => {
      if (acc?.name === "UserData" && acc?.type) forceArrayField(acc.type);
    });
  }

  return idl as anchor.Idl;
}

export default function NameGen() {
  const [walletPk, setWalletPk] = useState<PublicKey | null>(null);
  const [provider, setProvider] = useState<anchor.AnchorProvider | null>(null);
  const [program, setProgram] = useState<anchor.Program | null>(null);
  const [generatedName, setGeneratedName] = useState("");
  const [currentName, setCurrentName] = useState<string>("");
  const [status, setStatus] = useState("");

  const connection = useMemo(
    () => new Connection(clusterApiUrl(CLUSTER), "confirmed"),
    []
  );

  // connect Phantom
  const connectWallet = async () => {
    if (!("solana" in window)) {
      alert("Phantom Wallet nu este instalat!");
      return;
    }
    const prov = (window as any).solana;
    const resp = await prov.connect();
    setWalletPk(new PublicKey(resp.publicKey.toString()));
  };

  // init provider + program 
  useEffect(() => {
    if (!walletPk || !connection) return;

    const walletAdapter = {
      publicKey: walletPk,
      signTransaction: async (tx: any) => await (window as any).solana.signTransaction(tx),
      signAllTransactions: async (txs: any[]) => await (window as any).solana.signAllTransactions(txs),
    };

    const prov = new anchor.AnchorProvider(connection, walletAdapter as any, {
      commitment: "confirmed",
    });
    setProvider(prov);

    try {
      const idl = patchIdlForUserData(rawIdl);
      const prog = new anchor.Program(idl, PROGRAM_ID, prov);
      setProgram(prog);
      setStatus(" Program created with succes.");
    } catch (e) {
      console.error(e);
      setStatus(" Error at creating the program: " + (e as Error).message);
    }
  }, [walletPk, connection]);

  // PDA pentru user
  const pdaForUser = useMemo(() => {
    if (!walletPk) return null;
    return PublicKey.findProgramAddressSync(
      [Buffer.from("user"), walletPk.toBuffer()],
      PROGRAM_ID
    )[0];
  }, [walletPk]);

  // generate
  const generateName = () => {
    const words = ["Shadow", "Wolf", "Storm", "Drift", "Ghost", "Nova", "Blade"];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(Math.random() * 9999);
    setGeneratedName(`${w}-${n}`);
  };

  // init user PDA
  const initUser = async () => {
    if (!provider || !program || !walletPk || !pdaForUser) return;
    try {
      await program.methods
        .initUser()
        .accounts({
          authority: walletPk,
          userData: pdaForUser,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      setStatus(" User PDA created.");
    } catch (e) {
      setStatus(" Eroare init_user: " + (e as Error).message);
    }
  };

  // save name
  const saveName = async () => {
    if (!provider || !program || !walletPk || !pdaForUser) return;
    try {
      await program.methods
        .setName(generatedName)
        .accounts({
          authority: walletPk,
          userData: pdaForUser,
        })
        .rpc();
      setStatus(` Name Saved: ${generatedName}`);
    } catch (e) {
      setStatus(" Error set_name: " + (e as Error).message);
    }
  };

  // read name
  const readName = async () => {
    if (!program || !pdaForUser) return;
    try {
      const acc: any = await program.account.userData.fetch(pdaForUser);
      // acc.name este [u8;64] → tăiem la primul 0
      const bytes: number[] = Array.from(acc.name as number[]);
      const end = bytes.indexOf(0);
      const used = end === -1 ? bytes : bytes.slice(0, end);
      const str = new TextDecoder().decode(new Uint8Array(used));
      setCurrentName(str);
      setStatus("📖 Citit cu succes.");
    } catch (e) {
      setStatus("❌ Eroare read: " + (e as Error).message);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-white" style={{background:"#0a0a0a"}}>
      <h1 className="text-3xl font-bold">Sol NameGen — Devnet</h1>

      {!walletPk ? (
        <button onClick={connectWallet} className="px-4 py-2 rounded bg-purple-600">Connect Phantom</button>
      ) : (
        <>
          <p className="text-sm opacity-70">{walletPk.toBase58()}</p>

          <div className="flex gap-4">
            <button onClick={initUser} className="px-4 py-2 rounded bg-black border">Init</button>
            <button onClick={generateName} className="px-4 py-2 rounded bg-black border">Generate</button>
            <button onClick={saveName} className="px-4 py-2 rounded bg-black border" disabled={!generatedName}>Save</button>
            <button onClick={readName} className="px-4 py-2 rounded bg-black border">Read</button>
          </div>

          <div className="text-lg">
            <div><b>Generated:</b> {generatedName || "—"}</div>
            <div><b>On-chain:</b> {currentName || "—"}</div>
          </div>
        </>
      )}

      <p className="text-sm opacity-70 mt-8">Program ID: {PROGRAM_ID.toBase58()}</p>
      {status && <p className="text-sm opacity-70">{status}</p>}
    </main>
  );
}

