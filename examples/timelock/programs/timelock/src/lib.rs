//! An example timelock implementation on Solana.
//!
//! This program allows an arbitrary transaction to be executed by an account
//! provided a certain time has elapsed. This is useful for decentralized
//! governance systems where changes to a program should be publicly visible
//! prior to execution.

use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_lang::solana_program::instruction::Instruction;
use std::convert::Into;

#[program]
pub mod timelock {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        delay: i64,
    ) -> ProgramResult {
        let timelock = &mut ctx.accounts.timelock;
        timelock.delay = delay;
        Ok(())
    }

    pub fn queue_transaction(
        ctx: Context<QueueTransaction>,
        pid: Pubkey,
        accs: Vec<TransactionAccount>,
        data: Vec<u8>
    ) -> ProgramResult {
        let tx = &mut ctx.accounts.transaction;
        let timelock = &ctx.accounts.timelock;
        let clock = Clock::get().unwrap();

        tx.program_id = pid;
        tx.data = data;
        tx.executable_at = clock.unix_timestamp + timelock.delay;
        tx.accounts = accs;
        tx.did_execute = false;

        Ok(())
    }

    // Executes the given transaction if time has elapsed.
    pub fn execute_transaction(
        ctx: Context<ExecuteTransaction>
    ) -> ProgramResult {
        // Has this been executed already?
        if ctx.accounts.transaction.did_execute {
            return Err(ErrorCode::AlreadyExecuted.into());
        }

        // Has sufficient time elapsed?
        let clock = Clock::get().unwrap();
        if ctx.accounts.transaction.executable_at > clock.unix_timestamp {
            return Err(ErrorCode::NotDelayElapsed.into());
        }

        let ix: Instruction = (&*ctx.accounts.transaction).into();
        let seeds = &[
            ctx.accounts.timelock.to_account_info().key.as_ref(),
            &[ctx.accounts.timelock.nonce],
        ];
        let signer = &[&seeds[..]];
        let accounts = ctx.remaining_accounts;

        solana_program::program::invoke_signed(&ix, &accounts, signer)?;

        // Burn the transaction to ensure one time use.
        ctx.accounts.transaction.did_execute = true;

        Ok(())
    }

}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init)]
    timelock: ProgramAccount<'info, Timelock>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct QueueTransaction<'info> {
    timelock: ProgramAccount<'info, Timelock>,
    #[account(init)]
    transaction: ProgramAccount<'info, Transaction>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    timelock: ProgramAccount<'info, Timelock>,
    timelock_signer: AccountInfo<'info>,
    transaction: ProgramAccount<'info, Transaction>,
}

#[account]
pub struct Timelock {
    delay: i64,
    nonce: u8
}

#[account]
pub struct Transaction {
    // Target program to execute against.
    program_id: Pubkey,
    // Accounts required for the transaction.
    accounts: Vec<TransactionAccount>,
    // Instruction data for the transaction.
    data: Vec<u8>,
    // Unix timestamp of when the transaction becomes executable.
    executable_at: i64,
    // Boolean ensuring one time execution.
    did_execute: bool,
}

impl From<&Transaction> for Instruction {
    fn from(tx: &Transaction) -> Instruction {
        Instruction {
            program_id: tx.program_id,
            accounts: tx.accounts.clone().into_iter().map(Into::into).collect(),
            data: tx.data.clone(),
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TransactionAccount {
    pubkey: Pubkey,
    is_signer: bool,
    is_writable: bool,
}

impl From<TransactionAccount> for AccountMeta {
    fn from(account: TransactionAccount) -> AccountMeta {
        match account.is_writable {
            false => AccountMeta::new_readonly(account.pubkey, account.is_signer),
            true => AccountMeta::new(account.pubkey, account.is_signer),
        }
    }
}

#[error]
pub enum ErrorCode {
    #[msg("Timelock delay has not elapsed.")]
    NotDelayElapsed,
    #[msg("The given transaction has already been executed.")]
    AlreadyExecuted,
}
