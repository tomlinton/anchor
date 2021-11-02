use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod puppet {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }

    pub fn set_data(ctx: Context<SetData>, data: u64) -> ProgramResult {
        let puppet = &mut ctx.accounts.puppet;
        puppet.data = data;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 8)]
    pub puppet: ProgramAccount<'info, Puppet>,
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SetData<'info> {
    #[account(mut)]
    pub puppet: ProgramAccount<'info, Puppet>,
}

#[account]
pub struct Puppet {
    pub data: u64,
}
