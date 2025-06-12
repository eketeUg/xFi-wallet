// await this.transactionService.createTransaction({
//   userId: 'afab72a1-0a13-4d24-a5a9-83d3fae3901e', // UUID from your user
//   type: 'tip',
//   chain: 'ethereum',
//   amount: '10',
//   token: {
//     address: '0x123abc...token',
//     type: 'token',
//   },
//   receiver: {
//     value: '@cooldev',
//     type: 'username',
//   },
//   receiverUserId: 'cooluser-uuid-4567', // optional, if resolved
//   txHash: '0xhashfromblockchain',
//   meta: {
//     platform: 'twitter',
//     originalCommand: '@TestBot tip 10 0xToken to @cooldev on Ethereum',
//   },
// });

// // await new this.transactionModel({
// //   userId,
// //   type: 'buy',
// //   chain,
// //   amount: amountInNative,
// //   token: {
// //     address: tokenAddress,
// //     type: 'token',
// //   },
// //   txHash: buyTxHash,
// //   meta: {
// //     platform: 'twitter',
// //     originalCommand,
// //   },
// // }).save();

// // await new this.transactionModel({
// //   userId,
// //   type: 'sell',
// //   chain,
// //   amount: amountInTokens,
// //   token: {
// //     address: tokenAddress,
// //     type: 'token',
// //   },
// //   txHash: sellTxHash,
// //   meta: {
// //     platform: 'twitter',
// //     originalCommand,
// //   },
// // }).save();
