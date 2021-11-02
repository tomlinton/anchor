const anchor = require("@project-serum/anchor");
const assert = require("assert");

describe("timelock", async () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // Timelock account
  const timelock = anchor.web3.Keypair.generate();
  const program = anchor.workspace.Timelock;
  const timelockDelay = 5;

  // Puppet account
  const puppet = anchor.web3.Keypair.generate();
  // Puppet program to test execution of transaction
  const puppetProgram = anchor.workspace.Puppet;
  const transactionAccount = anchor.web3.Keypair.generate();

  let timelockSigner;
  let nonce;

  beforeEach(async () => {
    [timelockSigner, nonce] = await anchor.web3.PublicKey.findProgramAddress(
      [timelock.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Can create a timelock", async () => {
    const tx = await program.rpc.initialize(
      new anchor.BN(timelockDelay),
      nonce,
      {
        accounts: {
          timelock: timelock.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        instructions: [
          // Create the timelock prior to running initialize
          await program.account.timelock.createInstruction(timelock),
        ],
        signers: [timelock],
      }
    );

    const timelockData = await program.account.timelock.fetch(
      timelock.publicKey
    );
    assert.deepEqual(timelockData.delay, new anchor.BN(timelockDelay));
  });

  it("Can queue a transaction", async () => {
    // Initialize the puppet program
    await puppetProgram.rpc.initialize({
      accounts: {
        puppet: puppet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      instructions: [
        await puppetProgram.account.puppet.createInstruction(puppet),
      ],
      signers: [puppet],
    });

    const data = puppetProgram.coder.instruction.encode(
      "set_data",
      new anchor.BN(5),
      {
        puppet: puppet.publicKey,
      }
    );

    const accounts = [
      {
        pubkey: timelock.publicKey,
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: timelockSigner,
        isWritable: false,
        isSigner: true,
      },
    ];

    const txSize = 1000; // Why is this necessary?
    const tx = await program.rpc.queueTransaction(
      puppetProgram.programId,
      accounts,
      data,
      {
        accounts: {
          timelock: timelock.publicKey,
          transaction: transactionAccount.publicKey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        instructions: [
          await program.account.transaction.createInstruction(
            transactionAccount,
            txSize
          ),
        ],
        signers: [transactionAccount],
      }
    );

    const txAccount = await program.account.transaction.fetch(
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
      await program.rpc.executeTransaction({
        accounts: {
          timelock: timelock.publicKey,
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

    console.log("Timelock Program Signer", timelockSigner.toString());
    console.log("Timelock Program Account", timelock.publicKey.toString());
    console.log("Transaction Account", transactionAccount.publicKey.toString());
    console.log("Timelock", program.programId.toString());
    console.log("Puppet", puppetProgram.programId.toString());

    console.log();

    await program.rpc.executeTransaction({
      accounts: {
        timelock: timelock.publicKey,
        timelockSigner,
        transaction: transactionAccount.publicKey,
      },
      remainingAccounts: puppetProgram.instruction.setData
        .accounts({
          puppet: puppet.publicKey,
          timelockSigner,
        })
        .map((meta) =>
          meta.pubkey.equals(timelockSigner)
            ? { ...meta, isSigner: false }
            : meta
        )
        .concat(
          {
            pubkey: puppetProgram.programId,
            isWritable: false,
            isSigner: false,
          },
          {
            pubkey: timelock.publicKey,
            isWritable: false,
            isSigner: false,
          },
          {
            pubkey: timelockSigner,
            isWritable: false,
            isSigner: false,
          }
        ),
    });
  });
});
