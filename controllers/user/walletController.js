const Wallet = require("../../models/walletSchema");

const getWallet = async (req, res) => {
    try {
        console.log('is wallet')
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect("/login");
        }

        let wallet = await Wallet.findOne({ userId });
        
        if (!wallet) {
            const newWallet = new Wallet({
                userId,
                balance: 0,
                transactions: []
            });
            await newWallet.save();
            return res.render("profile", { wallet: newWallet });
        }


       
        // console.log(new Date(a.createdAt), new Date(b.createdAt)); 


        res.render("wallet", { wallet });
    } catch (error) {
        console.error("Error fetching wallet:", error);
        res.status(500).send("Internal Server error");
    }
};

module.exports = {
    getWallet
};
