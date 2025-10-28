// src/anchorClient.ts
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import idl from "./idl/namegen.json"; 

export const PROGRAM_ID = new PublicKey(
 
  "njCkgAPdDfewLAZmWZE1ckRDGAiPTwvWMouGGNCJkiR" 
);

export function getConnection() {
  return new Connection(clusterApiUrl("devnet"), "processed");
}

export function getProvider() {
  const anyWin = window as any;
  const wallet = anyWin?.solana;
  if (!wallet || !wallet.isPhantom) {
    throw new Error("Phantom isnt detected in the browser.");
  }
  const connection = getConnection();
  return new AnchorProvider(connection, wallet, { commitment: "processed" });
}

export function getProgram() {
  const provider = getProvider();
  const program = new Program(idl as Idl, PROGRAM_ID, provider);
  return { program, provider };
}

export async function getPda(authority: PublicKey) {
  const [pda] = await PublicKey.findProgramAddressSync(
    [Buffer.from("user"), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

// convert: string -> [u8;64]  (trim + zero-pad)
export function toFixedU8_64(input: string): number[] {
  const size = 64;
  const out = new Uint8Array(size);
  const src = Buffer.from(input ?? "", "utf8").slice(0, size);
  out.set(src, 0);
  return Array.from(out); // Anchor acceptă array number[] pentru [u8;64]
}

// invers: [u8;64] -> string 
export function u8ToStringTrim(buf: number[] | Uint8Array): string {
  const b = Buffer.from(buf);
  return b.toString("utf8").replace(/\0+$/, "");
}

