use anchor_lang::prelude::*;

declare_id!("njCkgAPdDfewLAZmWZE1ckRDGAiPTwvWMouGGNCJkiR");

// poți păstra const pentru uz intern, dar în struct și semnături folosim LITERAL 64
pub const MAX_NAME_LEN: usize = 64;

#[program]
pub mod namegen {
    use super::*;

    pub fn init_user(ctx: Context<InitUser>) -> Result<()> {
        let data = &mut ctx.accounts.user_data;
        data.owner = ctx.accounts.authority.key();
        data.name = [0u8; 64]; // <— literal
        Ok(())
    }

    pub fn set_name(ctx: Context<UpdateName>, name: [u8; 64]) -> Result<()> { // <— literal
        let data = &mut ctx.accounts.user_data;
        require_keys_eq!(data.owner, ctx.accounts.authority.key(), CustomError::NotOwner);
        data.name = name;
        Ok(())
    }

    pub fn clear_name(ctx: Context<UpdateName>) -> Result<()> {
        let data = &mut ctx.accounts.user_data;
        require_keys_eq!(data.owner, ctx.accounts.authority.key(), CustomError::NotOwner);
        data.name = [0u8; 64]; // <— literal
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + UserData::SIZE,
        seeds = [b"user", authority.key().as_ref()],
        bump
    )]
    pub user_data: Account<'info, UserData>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateName<'info> {
    #[account(
        mut,
        seeds = [b"user", authority.key().as_ref()],
        bump
    )]
    pub user_data: Account<'info, UserData>,
    pub authority: Signer<'info>,
}

#[account]
pub struct UserData {
    pub owner: Pubkey,        // 32
    pub name: [u8; 64],       // <— literal (important pentru IDL)
}

impl UserData {
    pub const SIZE: usize = 32 + 64; // <— literal
}

#[error_code]
pub enum CustomError {
    #[msg("Only the owner can modify this account.")]
    NotOwner,
}

