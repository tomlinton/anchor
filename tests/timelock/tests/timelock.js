const anchor = require("@project-serum/anchor");
const assert = require("assert");
const { SystemProgram } = anchor.web3;

describe("timelock", async () => {
  const provider = anchor.Provider.local();
  anchor.setProvider(provider);

  // Timelock account
  const timelockAccount = anchor.web3.Keypair.generate();
  const timelockProgram = anchor.workspace.Timelock;
  const timelockDelay = 5;

  // Puppet account
  const puppetAccount = anchor.web3.Keypair.generate();
  // Puppet program to test execution of transaction
  const puppetProgram = anchor.workspace.Puppet;
  const transactionAccount = anchor.web3.Keypair.generate();

  let timelockSigner;
  let nonce;

  beforeEach(async () => {
    [timelockSigner, nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [timelockAccount.publicKey.toBuffer()],
      timelockProgram.programId
    );
  });

  it("Can create a timelock", async () => {
    const tx = await timelockProgram.rpc.initialize(
      new anchor.BN(timelockDelay),
      nonce,
      {
        accounts: {
          timelock: timelockAccount.publicKey,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [timelockAccount],
      }
    );

    const timelockData = await timelockProgram.account.timelock.fetch(
      timelockAccount.publicKey
    );
    assert.deepEqual(timelockData.delay, new anchor.BN(timelockDelay));
  });

  it("Can queue a transaction", async () => {
    // Initialize the puppet program
    const result = await puppetProgram.rpc.initialize({
      accounts: {
        puppet: puppetAccount.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [puppetAccount],
    });

    const data = puppetProgram.coder.instruction.encode("set_data", {
      data: new anchor.BN(5),
    });

    const accounts = [
      {
        pubkey: puppetAccount.publicKey,
        isWritable: true,
        isSigner: false,
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
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [transactionAccount],
      }
    );

    const txAccount = await timelockProgram.account.transaction.fetch(
      transactionAccount.publicKey
    );
    assert.ok(txAccount.programId.equals(puppetProgram.programId));
    assert.deepEqual(txAccount.accounts, accounts);
    assert.deepEqual(txAccount.data, data);
    /*
    assert.deepEqual(
      txAccount.executableAt,
      new anchor.BN(((Date.now() / 1000) + 10))
    )
    */
    assert.equal(txAccount.didExecute, false);
  });

  it("Cannot execute a transaction if delay has not elapsed", async () => {
    try {
      await timelockProgram.rpc.executeTransaction({
        accounts: {
          timelock: timelockAccount.publicKey,
          timelockSigner,
          transaction: transactionAccount.publicKey,
        },
      });
    } catch (error) {
      assert.equal(error.msg, "Timelock delay has not elapsed.");
    }
  });

  it("Can execute a transaction if delay has elapsed", async () => {
    // Make sure delay has elapsed
    await new Promise((resolve) =>
      setTimeout(resolve, (timelockDelay + 1) * 1000)
    );

    await timelockProgram.rpc.executeTransaction({
      accounts: {
        timelock: timelockAccount.publicKey,
        timelockSigner,
        transaction: transactionAccount.publicKey,
      },
      remainingAccounts: puppetProgram.instruction.setData
        .accounts({
          puppet: puppetAccount.publicKey,
        })
        .concat({
          // Note that the program id of the instruction being issued must also be included
          pubkey: puppetProgram.programId,
          isWritable: false,
          isSigner: false,
        }),
    });

    const txAccount = await timelockProgram.account.transaction.fetch(
      transactionAccount.publicKey
    );
    assert.equal(txAccount.didExecute, true);

    const puppetData = await puppetProgram.account.data.fetch(
      puppetAccount.publicKey
    );

    assert(puppetData.data.eq(new anchor.BN(5)));
  });

  it("Cannot execute a transaction if already executed", async () => {
    try {
      await timelockProgram.rpc.executeTransaction({
        accounts: {
          timelock: timelockAccount.publicKey,
          timelockSigner,
          transaction: transactionAccount.publicKey,
        },
        remainingAccounts: puppetProgram.instruction.setData
          .accounts({
            puppet: puppetAccount.publicKey,
          })
          .concat({
            // Note that the program id of the instruction being issued must also be included
            pubkey: puppetProgram.programId,
            isWritable: false,
            isSigner: false,
          }),
      });
    } catch (error) {
      assert.equal(error.msg, "Transaction has already been executed.");
    }
  });
});
