const Wallet = require("../../models/walletSchema");
const mongoose = require("mongoose");

const getWallet = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const totalTransactions = await Wallet.aggregate([
      { $unwind: "$transactions" },
      { $count: "count" },
    ]);
    const transactions = await Wallet.aggregate([
      { $unwind: "$transactions" },
      { $sort: { "transactions.createdAt": -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
    ]);
    console.log(transactions);
    const totalPages = Math.ceil((totalTransactions[0]?.count || 0) / limit);
    res.render("admin-wallet", {
      transactions,
      currentPage: page,
      totalPages,
      totalCredits: await Wallet.aggregate([
        { $unwind: "$transactions" },
        { $match: { "transactions.type": "credit" } },
        { $group: { _id: null, total: { $sum: "$transactions.amount" } } },
      ]).then((result) => result[0]?.total || 0),
      totalDebits: await Wallet.aggregate([
        { $unwind: "$transactions" },
        { $match: { "transactions.type": "debit" } },
        { $group: { _id: null, total: { $sum: "$transactions.amount" } } },
      ]).then((result) => result[0]?.total || 0),
    });
  } catch (error) {
    console.error("Error fetching wallet transactions:", error);
    res.status(500).send("Server Error");
  }
};

const getWalletDetails = async (req, res) => {
  try {
    const { transactionId } = req.query;
    const transaction = await Wallet.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions._id": new mongoose.Types.ObjectId(transactionId),
        },
      },
    ]);

    res.render("admin-wallet-details", { transaction: transaction[0] });
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  getWallet,
  getWalletDetails,
};
