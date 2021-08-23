const anchor = require('@project-serum/anchor');
const assert = require("assert");

describe('timelock', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // Timelock account
  const timelockAccount = anchor.web3.Keypair.generate();
  const timelockProgram = anchor.workspace.Timelock;

  // Puppet account
  const puppetAccount = anchor.web3.Keypair.generate();
  // Puppet program to test execution of transaction
  const puppetProgram = anchor.workspace.Puppet;

  const transactionAccount = anchor.web3.Keypair.generate();

  it('Can create a timelock', async () => {
    const [
      timelockSigner,
      nonce,
    ] = await anchor.web3.PublicKey.findProgramAddress(
      [timelockAccount.publicKey.toBuffer()],
      timelockProgram.programId
    );
    const timelockDelay = new anchor.BN(10)
    const tx = await timelockProgram.rpc.createTimelock(timelockDelay, nonce, {
      accounts: {
        timelock: timelockAccount.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      instructions: [
        await timelockProgram.account.timelock.createInstruction(timelockAccount),
      ],
      signers: [timelockAccount]
    });
  });

  it('Can queue a transaction', async () => {
    const data = puppetProgram.coder.instruction.encode('initialize', {
      puppet: puppetAccount.publicKey
    });

    const [
      timelockSigner
    ] = await anchor.web3.PublicKey.findProgramAddress(
      [timelockAccount.publicKey.toBuffer()],
      timelockProgram.programId
    );
    const accounts = [
      {
        pubkey: timelockAccount.publicKey,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: timelockSigner,
        isWritable: false,
        isSigner: true,
      },
    ];

    await timelockProgram.rpc.queueTransaction(puppetProgram.programId, accounts, data, {
      accounts: {
        timelock: timelockAccount.publicKey,
        transaction: transactionAccount.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      instructions: [
        await timelockProgram.account.transaction.createInstruction(
          transactionAccount,
          1000
        ),
      ],
      signers: [transactionAccount],
    });

    const txAccount = await timelockProgram.account.transaction.fetch(transactionAccount.publicKey);
    assert.ok(txAccount.programId.equals(puppetProgram.programId));
    assert.deepEqual(txAccount.data, data);
    // assert.equal(txAccount.executableAt, new anchor.BN(Date.now() + 10))
    // assert.deepEqual(txAccount.accounts, [])
    assert.equal(txAccount.didExecute, false);
  })

  it('Cannot execute a transaction if delay has not elapsed', async () => {
    const [
      timelockSigner
    ] = await anchor.web3.PublicKey.findProgramAddress(
      [timelockAccount.publicKey.toBuffer()],
      timelockProgram.programId
    );
    const txAccount = await timelockProgram.account.transaction.fetch(transactionAccount.publicKey);
    await timelockProgram.rpc.executeTransaction({
      accounts: {
        timelock: timelockAccount.publicKey,
        timelockSigner,
        transaction: transactionAccount.publicKey,
      },
      signers: [transactionAccount],
    });
  })

  it('Can execute a transaction if delay has elapsed')
});

