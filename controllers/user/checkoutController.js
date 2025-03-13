const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const Cart = require('../../models/cartSchema')
const Product = require('../../models/productSchema')
const mongoose = require('mongoose')
const { CURSOR_FLAGS } = require('mongodb')



const getCheckOut = async (req, res) => {
    try {

        const userId = req.session.user
        if (!userId) {
            res.render('login', { message: 'Please login to access your cart' })
        }

        let user = await User.findOne({ _id:userId }).populate('cart.productId')
        if (!user) {
            user = { items: [] };
            }
        const cart=user.cart
        console.log(cart);
        const userAddresses = await Address.findOne({ userId })

        const currentDate = new Date()
        let totalPrice = 0
        if (cart) {
            totalPrice = cart.reduce((sum, item) => sum + (item.productId.salesPrice * item.quantity), 0)
        }

        res.render('checkout', {
            cart,
            addresses: userAddresses ? userAddresses.address : [],
            title: 'Checkout',
            user,
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

    try {
        const { addressId, name, addressType, city, landMark, state, pincode, phone } = req.body;

        console.log('Edit address request:', req.body);

        if (!addressId) {
            return res.json({ success: false, message: "Address ID is required" });
        }

        
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