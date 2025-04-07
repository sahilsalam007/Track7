const Wallet=require("../../models/walletSchema");

const getWallet=async(req,res)=>{
    try {
        const userId=req.session.userId
        if(!userId){
            return res.redirect("/login")
        }
        const wallet=await Wallet.findOne({userId})
        wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        if(!wallet){
            const newWallet=new Wallet({
                userId,
                balance:0,
                transactions:[]
            })
            await newWallet.save()
            return res.render("profile",{wallet:newWallet});
        }
        res.render("profile",{wallet})
    } catch (error) {
        console.error("Error fetching wallet:",error);
        res.status(500).send("Internal Server error")
    }
}

module.exports={
    getWallet
}