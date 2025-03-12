const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
//const Order = require('../../models/orderSchema')
const mongoose = require('mongoose')




const getCheckOut = async (req, res) => {
    try {

        const userId = req.session.user

        if (!userId) {
            res.render('login', { message: 'Please login to access your cart' })
        }


        let cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product'
        })

        if (!cart) {
            cart = { items: [] };
        }


        const userAddresses = await Address.findOne({ userId })

        const currentDate = new Date()
        // const coupons = await Coupon.find({
        //     expireOn:{$gt:currentDate},
        //     isList:true,
        //     $or:[

        //        { UsageLimit:{$gt: 0} },
        //        {UsageLimit:{ $exists:false} },
        //        { isList:false }
        //     ]
        // })


        const userData = await User.findById(userId)

        //const wallets = await Wallet.find({userId})

        // const sumOfCredit = wallets.reduct((sum, transaction) => 
        //    transaction.type === "Credit" ? sum + transaction.amount : sum,0
        // )


        // const sumOfDebit = wallets.reduce((sum, transaction) => 
        //     transaction.type === "Debit" ? sum + transaction.amount : sum, 0
        // )


        //   const totalBalanceAmount = sumOfCredit - sumOfDebit;


        let totalPrice = 0
        if (cart && cart.items) {
            totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0)
        }



        res.render('checkout', {
            cart,
            addresses: userAddresses ? userAddresses.address : [],
            title: 'Checkout',
            user: userData,
            //  coupon:coupons,
            //  totalBalanceAmount
            totalPrice: totalPrice
        })

    } catch (error) {
        console.log('checkout page error', error)

        res.redirect('/cart')

    }
}



const addaddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressType, name, city, landMark, state, pincode, phone } = req.body;


        let userAddress = await Address.findOne({ userId });

        if (!userAddress) {

            userAddress = new Address({
                userId,
                address: [{
                    addressType,
                    name,
                    city,
                    state,
                    pincode,
                    landMark,
                    phone,
                }]
            });
        } else {
            userAddress.address.push({
                addressType,
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
            });
        }

        await userAddress.save();

        res.json({ success: true, message: "address added successfully" })



    } catch (error) {

        console.error('Add address error:', error);

        res.redirect('/checkOut');
    }
}



const editaddress = async (req, res) => {
    //     try {
    //         const { addressId, name, addressType, city, landMark, state, pincode, phone } = req.body;

    //         console.log('Edit address:', addressId, name, addressType, city, landMark, state, pincode, phone);

    //         if (!addressId) {
    //             return res.json({ success: false, message: "Address ID is required" });
    //         }


    //         const userAddress = await Address.findOne({ "address._id": addressId });

    //         if (!userAddress) {
    //             return res.json({ success: false, message: "Address not found" });
    //         }


    //         const addressToUpdate = userAddress.address.id(addressId);
    //         if (!addressToUpdate) {
    //             return res.json({ success: false, message: "Address not found in user's address list" });
    //         }

    //         addressToUpdate.name = name;
    //         addressToUpdate.addressType = addressType;
    //         addressToUpdate.city = city;
    //         addressToUpdate.landMark = landMark;
    //         addressToUpdate.state = state;
    //         addressToUpdate.pincode = pincode;
    //         addressToUpdate.phone = phone;

    //         await userAddress.save(); // Save the document after modifying the nested array

    //         res.json({ success: true, message: "Address updated successfully", address: addressToUpdate });

    //     } catch (error) {
    //         console.error("Edit Address Error:", error);
    //         res.json({ success: false, message: "Failed to update address" });
    //     }
    // };

    try {
        const { addressId, name, addressType, city, landMark, state, pincode, phone } = req.body;

        console.log('Edit address request:', req.body);

        if (!addressId) {
            return res.json({ success: false, message: "Address ID is required" });
        }

        // Find the user's address document containing the address to update
        const result = await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$.name": name,
                    "address.$.addressType": addressType,
                    "address.$.city": city,
                    "address.$.landMark": landMark,
                    "address.$.state": state,
                    "address.$.pincode": pincode,
                    "address.$.phone": phone
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.json({ success: false, message: "Address not found or not modified" });
        }

        return res.json({ success: true, message: "Address updated successfully" });
    } catch (error) {
        console.error("Edit Address Error:", error);
        return res.json({ success: false, message: "Failed to update address" });
    }
};




module.exports = {
    getCheckOut,
    addaddress,
    editaddress,
}