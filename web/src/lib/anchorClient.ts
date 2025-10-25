"use client";
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import idl from "@/idl/namegen.json";

export function getConnection() {
  const cluster = process.env.NEXT_PUBLIC_CLUSTER || "devnet";
  return new Connection(clusterApiUrl(cluster), "confirmed");
}

export function getProgramId(): PublicKey {
  const pid = process.env.NEXT_PUBLIC_PROGRAM_ID!;
  return new PublicKey(pid);
}

export function getProgram(provider: anchor.Provider) {
  return new anchor.Program(idl as anchor.Idl, getProgramId(), provider);
}

export function pdaForUser(authority: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), authority.toBuffer()],
    getProgramId()
  );
  return pda;
}
