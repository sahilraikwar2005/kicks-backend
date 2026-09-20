import { apiSuccess } from '../../utils/apiResponse.js';
import { wishlistService } from './service.js';

export const wishlistController = {
  getWishlist: async (req, res) => {
    const wishlist = await wishlistService.getWishlist(req.user._id);
    return res.status(200).json(apiSuccess('Wishlist fetched successfully', { wishlist }));
  },

  addToWishlist: async (req, res) => {
    const wishlist = await wishlistService.addToWishlist(req.user._id, req.body.productId);
    return res.status(200).json(apiSuccess('Product added to wishlist', { wishlist }));
  },

  removeFromWishlist: async (req, res) => {
    const wishlist = await wishlistService.removeFromWishlist(req.user._id, req.params.productId);
    return res.status(200).json(apiSuccess('Product removed from wishlist', { wishlist }));
  },
};
