//! This example demonstrates the ability to compose together multiple
//! structs deriving `Accounts`. See `CompositeUpdate`, below.

use anchor_lang::prelude::*;

declare_id!("EHthziFziNoac9LBGxEaVN47Y3uUiRoXvqAiR6oes4iU");

#[program]
mod composite {
    use super::*;
    pub fn initialize(_ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }

    pub fn composite_update(
        _ctx: Context<CompositeUpdate>,
        _dummy_a: u64,

        _dummy_b: u64,
    ) -> ProgramResult {
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct MyArgs {
    foo: u16,
}

#[derive(Accounts)]
#[instruction(args: MyArgs)]
pub struct Initialize<'info> {
    #[account(zero)]
    pub dummy_a: Account<'info, DummyA>,
    #[account(zero)]
    pub dummy_b: Account<'info, DummyB>,
}

#[derive(Accounts)]
#[instruction(args: MyArgs)]
pub struct CompositeUpdate<'info> {
    initialize: Initialize<'info>,
}

#[account]
pub struct DummyA {
    pub data: u64,
}

#[account]
pub struct DummyB {
    pub data: u64,
}
