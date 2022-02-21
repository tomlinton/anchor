use anchor_lang::prelude::*;

pub const MAX_SIZE: usize = 10;
pub const MAX_SIZE_U8: u8 = 11;

#[account]
pub struct Data {
    pub udata: u128,
    pub idata: i128,
}

#[account]
#[derive(Default)]
pub struct DataU16 {
    pub data: u16,
}

#[account]
#[derive(Default)]
pub struct DataI8 {
    pub data: i8,
}

#[account]
pub struct DataI16 {
    pub data: i16,
}

#[account(zero_copy)]
#[derive(Default)]
pub struct DataZeroCopy {
    pub data: u16,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct DataWithFilter {
    pub authority: Pubkey,
    pub filterable: Pubkey,
}

#[account]
pub struct DataMultidimensionalArray {
    pub data: [[u8; 10]; 10],
}

#[account]
pub struct DataConstArraySize {
    pub data: [u8; MAX_SIZE],
}

#[account]
pub struct DataConstCastArraySize {
    pub data_one: [u8; MAX_SIZE as usize],
    pub data_two: [u8; MAX_SIZE_U8 as usize],
}

#[account]
pub struct DataMultidimensionalArrayConstSizes {
    pub data: [[u8; MAX_SIZE_U8 as usize]; MAX_SIZE],
}
