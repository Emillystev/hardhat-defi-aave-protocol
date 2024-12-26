const { ethers, getNamedAccounts, network } = require("hardhat")
const { getWeth, AMOUNT } = require("./getWeth.js")
const { networkConfig } = require("../helper-hardhat-config")

const BORROW_MODE = 2 // Variable borrow mode. Stable was disabled.

async function main(){
    await getWeth()
    const {deployer} = await getNamedAccounts();
    const signer = await ethers.provider.getSigner();

    const lendingPool = await getLendingPool(signer)
    const lendingPoolContractAddress = await lendingPool.getAddress();
	console.log(`Lending Pool address ${lendingPoolContractAddress}`);

    const wethTokenAddress = networkConfig[network.config.chainId].wethToken
    // APPROVE
    await approveErc20(wethTokenAddress, lendingPoolContractAddress, AMOUNT, signer)
    // DEPOSIT
    console.log("Depositing WETH...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, signer, 0)
    console.log("Desposited!")

    // BORROW
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, signer)

    const daiPrice = await getDaiPrice()
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / (BigInt(daiPrice).toString()))
    const amountDaiToBorrowWei = ethers.parseEther(amountDaiToBorrow.toString())
    console.log(`You can borrow ${amountDaiToBorrow.toString()} DAI`)

    await borrowDai(
        networkConfig[network.config.chainId].daiToken,
        lendingPool,
        amountDaiToBorrowWei,
        signer
    )
    await getBorrowUserData(lendingPool, signer)

    // REPAY DAI
    await repay(
        amountDaiToBorrowWei,
        networkConfig[network.config.chainId].daiToken,
        lendingPool,
        signer
    )

    await getBorrowUserData(lendingPool, signer)
}




async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[network.config.chainId].lendingPoolAddressesProvider,
        account
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}

async function approveErc20(erc20Address, spenderAddress, amount, signer) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, signer)
    txResponse = await erc20Token.approve(spenderAddress, amount)
    await txResponse.wait(1)
    console.log("Approved!")
}

async function getBorrowUserData(lendingPool, account) {
    const {
        totalCollateralETH,
        totalDebtETH,
        availableBorrowsETH
    } = await lendingPool.getUserAccountData(account)
    console.log(`You have ${totalCollateralETH} worth of ETH deposited.`)
    console.log(`You have ${totalDebtETH} worth of ETH borrowed.`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`)
    return { availableBorrowsETH, totalDebtETH }
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config.chainId].daiEthPriceFeed
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`The DAI/ETH price is ${price.toString()}`)
    return price
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrow, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrow, BORROW_MODE, 0, account)
    await borrowTx.wait(1)
    console.log("You've borrowed!")
}

async function repay(amount, daiAddress, lendingPool, account) {
    await approveErc20(daiAddress, lendingPool.getAddress(), amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, BORROW_MODE, account)
    await repayTx.wait(1)
    console.log("Repaid!")
}

async function getBorrowUserData(lendingPool, account) {
    const {
        totalCollateralETH,
        totalDebtETH,
        availableBorrowsETH
    } = await lendingPool.getUserAccountData(account)
    console.log(`You have ${totalCollateralETH} worth of ETH deposited.`)
    console.log(`You have ${totalDebtETH} worth of ETH borrowed.`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`)
    return { availableBorrowsETH, totalDebtETH }
}




main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })


// yarn hardhat run scripts/aaveBorrow.js