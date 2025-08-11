const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

const getBrandPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const searchQuery = req.query.search?.trim() || "";

    const searchCondition = searchQuery
      ? { brandName: { $regex: searchQuery, $options: "i" } }
      : {};

    const brandData = await Brand.find(searchCondition)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBrands = await Brand.countDocuments(searchCondition);
    const totalPages = Math.ceil(totalBrands / limit);

    const reverseBrand = brandData.reverse();

    res.status(200).render("brands", {
      data: reverseBrand,
      currentPage: page,
      totalPages: totalPages,
      totalBrands: totalBrands,
      searchQuery: searchQuery,
    });
  } catch (error) {
    console.error("Error fetching brand page:", error);
    res.status(500).redirect("/pageerror");
  }
};

const addBrand = async (req, res) => {
  try {
    const brand = req.body.name?.trim();
    const findBrand = await Brand.findOne({ brand });
    if (!findBrand) {
      const image = req.file.filename;
      const newBrand = new Brand({
        brandName: brand,
        brandImage: image,
      });
      await newBrand.save();
      res.status(201).redirect("/admin/brands");
    }
  } catch (error) {
    res.status(500).redirect("/pageerror");
  }
};

const blockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.status(200).redirect("/admin/brands");
  } catch (error) {
    res.status(500).redirect("/pageerror");
  }
};

const unBlockBrand = async (req, res) => {
  try {
    const id = req.query.id;
    await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.status(200).redirect("/admin/brands");
  } catch (error) {
    res.status(500).redirect("/pageerror");
  }
};

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).redirect("/pageerror");
    }
    await Brand.deleteOne({ _id: id });
    res.status(200).redirect("/admin/brands");
  } catch (error) {
    console.error("Error deleting brand:", error);
    res.status(500).redirect("/pageerror");
  }
};

module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unBlockBrand,
  deleteBrand,
};
