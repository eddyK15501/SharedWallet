const chai = require('chai');
const { utils } = require('ethers');
const { ethers } = require('hardhat');
const { solidity } = require('ethereum-waffle');

chai.use(solidity);
const { expect } = chai;

let sharedWallet;

beforeEach(async () => {
  [account0, account1, account2, account3] = await ethers.getSigners();

  const SharedWallet = await ethers.getContractFactory("SharedWallet")
  sharedWallet = await SharedWallet.deploy();
  await sharedWallet.deployed();

  console.log("SharedWallet contract deployed to: ", sharedWallet.address);
});

describe("Allowance contract", () => {
  it('The contract has an owner', async () => {
    expect(await sharedWallet.owner()).to.eq(account0.address);
  });

  it('only owner can call the setAllowance function', async () => {
    await expect(sharedWallet.connect(account1)
      .setAllowance(account0.address, utils.parseEther('1')))
      .to.be.revertedWith("You are not the owner");
  });

  it('setAllowance can emit an event', async () => {
    await expect(sharedWallet.connect(account0).setAllowance(account1.address, utils.parseEther('1')))
      .to.emit(sharedWallet, 'AllowanceChanged')
      .withArgs(account1.address, account0.address, 0, utils.parseEther('1'));
  });

  it('setAllowance', async () => {
    await sharedWallet.connect(account0).setAllowance(account1.address, utils.parseEther('1'));
    expect(await sharedWallet.allowance(account1.address)).to.eq(utils.parseEther('1'));
  });
});

describe("SharedWallet contract", () => {
  it('can send money to this contract', async () => {
    await account0.sendTransaction({
      to: sharedWallet.address,
      value: utils.parseEther('10')
    });
    expect(await ethers.provider.getBalance(sharedWallet.address)).to.eq(utils.parseEther('10'));
  });

  it('sending money to the contract emits an event', async () => {
    const transaction = await account0.sendTransaction({
      to: sharedWallet.address,
      value: utils.parseEther('10')
    });
    await expect(transaction).to.emit(sharedWallet, 'MoneyReceived')
      .withArgs(account0.address, utils.parseEther('10'));
  });

  it('cannot call withdrawMoney function without permission', async () => {
    await account0.sendTransaction({
      to: sharedWallet.address,
      value: utils.parseEther('10')
    });
    await expect(sharedWallet.connect(account1).withdrawMoney(account2.address, utils.parseEther('5')))
      .to.be.revertedWith("You are not allowed");
  });

  it('cannot withdraw more than the balance of the smart contract', async () => {
    await account0.sendTransaction({
      to: sharedWallet.address,
      value: utils.parseEther('10')
    });
    await expect(sharedWallet.connect(account0).withdrawMoney(account1.address, utils.parseEther('11')))
      .to.be.revertedWith("Exceeds the total contract balance");
  });

  it('withdrawMoney can emit an event', async () => {
    await account0.sendTransaction({
      to: sharedWallet.address,
      value: utils.parseEther('10')
    });
    await sharedWallet.connect(account0).setAllowance(account2.address, utils.parseEther('2'));
    expect(await sharedWallet.allowance(account2.address)).to.eq(utils.parseEther('2'));
    const withdraw = await sharedWallet.connect(account2).withdrawMoney(account2.address, utils.parseEther('2'));
    await expect(withdraw).to.emit(sharedWallet, 'MoneySent').withArgs(account2.address, utils.parseEther('2'));
  });

  it('owner can call withdrawMoney, and it will emit an event', async () => {
    await account0.sendTransaction({
      to: sharedWallet.address,
      value: utils.parseEther('10')
    });
    await expect(sharedWallet.connect(account0).withdrawMoney(account1.address, utils.parseEther('5')))
      .to.emit(sharedWallet, 'MoneySent')
      .withArgs(account1.address, utils.parseEther('5'));
    expect(await ethers.provider.getBalance(sharedWallet.address)).to.eq(utils.parseEther('5'));
  });

  it('withdrawMoney after setting an allowance', async () => {
    const balanceBefore = utils.formatEther(await account1.getBalance());

    await account0.sendTransaction({
      to: sharedWallet.address,
      value: utils.parseEther('10')
    });
    await sharedWallet.connect(account0).setAllowance(account1.address, utils.parseEther('3'));
    expect(await sharedWallet.allowance(account1.address)).to.eq(utils.parseEther('3'));
    await sharedWallet.connect(account1).withdrawMoney(account1.address, utils.parseEther('3'))
    
    const balanceAfter = utils.formatEther(await account1.getBalance());

    expect(parseFloat(balanceAfter) - parseFloat(balanceBefore)).to.be.closeTo(3, 1e-3);
  });

  it('withdrawMoney by the owner', async () => {
    const balanceBefore = utils.formatEther(await account2.getBalance());

    await account0.sendTransaction({
      to: sharedWallet.address,
      value: utils.parseEther('50')
    });
    await sharedWallet.connect(account0).withdrawMoney(account2.address, utils.parseEther('20'));
    expect(await ethers.provider.getBalance(sharedWallet.address)).to.eq(utils.parseEther('30'));

    const balanceAfter = utils.formatEther(await account2.getBalance());

    expect(parseFloat(balanceAfter) - parseFloat(balanceBefore)).to.be.closeTo(20, 1e-3);
  });
});