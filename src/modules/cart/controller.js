import { apiSuccess } from '../../utils/apiResponse.js';
import { cartService } from './service.js';

export const cartController = {
  getCart: async (req, res) => {
    const cart = await cartService.getCart(req.user._id);
    return res.status(200).json(apiSuccess('Cart fetched successfully', { cart }));
  },

  addItem: async (req, res) => {
    const cart = await cartService.addItem(req.user._id, req.body);
    return res.status(200).json(apiSuccess('Item added to cart', { cart }));
  },

  updateItem: async (req, res) => {
    const cart = await cartService.updateItem(req.user._id, req.params.variantId, req.body.quantity);
    return res.status(200).json(apiSuccess('Cart item updated', { cart }));
  },

  removeItem: async (req, res) => {
    const cart = await cartService.removeItem(req.user._id, req.params.variantId);
    return res.status(200).json(apiSuccess('Cart item removed', { cart }));
  },

  clearCart: async (req, res) => {
    const cart = await cartService.clearCart(req.user._id);
    return res.status(200).json(apiSuccess('Cart cleared', { cart }));
  },
};
