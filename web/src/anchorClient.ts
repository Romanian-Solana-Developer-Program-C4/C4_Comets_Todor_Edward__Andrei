// web/src/anchorClient.ts
import * as anchor from "@coral-xyz/anchor";
import type { Idl, Program } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram as Web3SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import idl from "./idl/namegen.json";

export const SystemProgram = Web3SystemProgram;

// Conexiune Devnet (confirmed)
export function getConnection() {
  return new Connection(clusterApiUrl("devnet"), "confirmed");
}

// Provider bazat pe Phantom
export function getProvider() {
  const anyWin = window as any;
  const wallet = anyWin?.solana;
  if (!wallet || !wallet.isPhantom) {
    throw new Error("Phantom nu este detectat.");
  }
  const connection = getConnection();
  // Cast simplu la anchor.Wallet pentru TS
  return new anchor.AnchorProvider(
    connection,
    wallet as unknown as anchor.Wallet,
    { commitment: "confirmed" }
  );
}

// Program Anchor – folosim cast pe constructor ca să evităm bugul de tipare
export function getProgram(): { program: Program; provider: anchor.AnchorProvider } {
  const provider = getProvider();
  const programId = new PublicKey("njCkgAPdDfewLAZmWZE1ckRDGAiPTwvWMouGGNCJkiR");

  // 👇 Cast “any” pe constructorul Program ca să nu mai confunde Address cu Provider
  const program = new (anchor as any).Program(idl as Idl, programId, provider) as Program;

  return { program, provider };
}

// PDA: ["user", authority]
export function getPda(authority: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), authority.toBuffer()],
    new PublicKey("njCkgAPdDfewLAZmWZE1ckRDGAiPTwvWMouGGNCJkiR")
  );
  return pda;
}

// string -> [u8;64]
export function toFixedU8_64(input: string): number[] {
  const enc = new TextEncoder();
  const bytes = enc.encode(input ?? "");
  const out = new Uint8Array(64);
  out.set(bytes.subarray(0, 64));
  return Array.from(out);
}

// [u8;64] -> string (taie 0-urile finale)
export function u8ToStringTrim(buf: number[] | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : Uint8Array.from(buf);
  let end = u8.length;
  while (end > 0 && u8[end - 1] === 0) end--;
  return new TextDecoder().decode(u8.subarray(0, end));
}
