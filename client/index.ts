import * as anchor from "@coral-xyz/anchor";
import { Connection, clusterApiUrl, PublicKey, Keypair } from "@solana/web3.js";
import idl from "./idl/namegen.json";

const PROGRAM_ID = new PublicKey("njCkgAPdDfewLAZmWZE1ckRDGAiPTwvWMouGGNCJkiR"); // pune ID-ul tău

async function pdaForUser(authority: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  // provider din keypair-ul CLI (id.json)
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(
      Uint8Array.from(
        // citește id.json al CLI
        require("fs").readFileSync(
          `${process.env.HOME}/.config/solana/id.json`,
          "utf-8"
        )
        .replace(/[\[\]\s]/g, "")
        .split(",")
        .map(Number)
      )
    )
  );

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);

  const authority = provider.wallet.publicKey;
  const userPda = await pdaForUser(authority);

  // 1) init_user (o singură dată per autoritate)
  try {
    await program.methods
      .initUser()
      .accounts({
        userData: userPda,
        authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("init_user: OK");
  } catch (e) {
    console.log("init_user (probabil deja creat):", (e as Error).message);
  }

  // 2) set_name
  const newName = "shadow-edward";
  await program.methods
    .setName(newName) // ajustează numele metodei exact ca în programul tău
    .accounts({
      userData: userPda,
      authority,
    })
    .rpc();
  console.log("set_name:", newName);

  // 3) read back
  const acc = await program.account.userData.fetch(userPda);
  console.log("userData:", acc);
}

main().catch((e) => console.error(e));
