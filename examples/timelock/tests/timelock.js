const anchor = require('@project-serum/anchor');
const assert = require("assert");

describe('timelock', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // Timelock account
  const timelockAccount = anchor.web3.Keypair.generate();
  const timelockProgram = anchor.workspace.Timelock;
  const timelockDelay = 10

  // Puppet account
  const puppetAccount = anchor.web3.Keypair.generate();
  // Puppet program to test execution of transaction
  const puppetProgram = anchor.workspace.Puppet;

  const transactionAccount = anchor.web3.Keypair.generate();

  let timelockProgramSigner

  beforeEach(async () => {
    [
      timelockProgramSigner
    ] = await anchor.web3.PublicKey.findProgramAddress(
      [timelockAccount.publicKey.toBuffer()],
      timelockProgram.programId
    );

  })

  it('Can create a timelock', async () => {
    const tx = await timelockProgram.rpc.initialize(new anchor.BN(timelockDelay), {
      accounts: {
        timelock: timelockAccount.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      instructions: [
        // Create the timelockAccount prior to running initialize
        await timelockProgram.account.timelock.createInstruction(timelockAccount),
      ],
      signers: [timelockAccount],
    });

    const timelockData = await timelockProgram.account.timelock.fetch(
      timelockAccount.publicKey
    )
    assert.deepEqual(timelockData.delay, new anchor.BN(timelockDelay));
  });

  it('Can queue a transaction', async () => {
    const data = puppetProgram.coder.instruction.encode('initialize', {
      puppet: puppetAccount.publicKey
    });

    const accounts = [
      {
        pubkey: timelockAccount.publicKey,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: timelockProgramSigner,
        isWritable: false,
        isSigner: true,
      },
    ];

    const tx = await timelockProgram.rpc.queueTransaction(
      puppetProgram.programId,
      accounts,
      data,
      {
        accounts: {
          timelock: timelockAccount.publicKey,
          transaction: transactionAccount.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        instructions: [
          await timelockProgram.account.transaction.createInstruction(
            transactionAccount,
            1000 // Sets the space for the account? Why necessary?
          ),
        ],
        signers: [transactionAccount],
      }
    );

    const accountData = await timelockProgram.account.transaction.fetch(
      transactionAccount.publicKey
    );
    assert.ok(accountData.programId.equals(puppetProgram.programId));
    assert.deepEqual(accountData.data, data);
    /*
    assert.deepEqual(
      accountData.executableAt,
      new anchor.BN(((Date.now() / 1000) + 10))
    )
    */
    assert.equal(accountData.didExecute, false);
  })

  it('Cannot execute a transaction if delay has not elapsed', async () => {
    try {
      await timelockProgram.rpc.executeTransaction({
        accounts: {
          timelock: timelockAccount.publicKey,
          timelockSigner: timelockProgramSigner,
          transaction: transactionAccount.publicKey,
        }
      });
    } catch (error) {
      assert.equal(error.msg, "Timelock delay has not elapsed.")
    }
  })

  it('Can execute a transaction if delay has elapsed', async () => {
    // Make sure delay has elapsed
    await new Promise(resolve => setTimeout(resolve, timelockDelay * 1000));

    await timelockProgram.rpc.executeTransaction({
      accounts: {
        timelock: timelockAccount.publicKey,
        timelockSigner: timelockProgramSigner,
        transaction: transactionAccount.publicKey,
      }
    });
  })
});
