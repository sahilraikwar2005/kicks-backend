import bcrypt from 'bcryptjs';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import User from '../src/modules/users/model.js';
import Brand from '../src/modules/brands/model.js';
import Category from '../src/modules/categories/model.js';
import Product from '../src/modules/products/model.js';
import Coupon from '../src/modules/coupons/model.js';
import Address from '../src/modules/addresses/model.js';
import Cart from '../src/modules/cart/model.js';
import Wishlist from '../src/modules/wishlist/model.js';
import BlogPost from '../src/modules/blog/model.js';
import CmsContent from '../src/modules/cms/model.js';
import Notification from '../src/modules/notifications/model.js';
import RecentlyViewed from '../src/modules/recentlyViewed/model.js';
import Order from '../src/modules/orders/model.js';
import Payment from '../src/modules/payments/model.js';
import Shipment from '../src/modules/shipments/model.js';
import Review from '../src/modules/reviews/model.js';
import Inventory, { InventoryMovement } from '../src/modules/inventory/model.js';

const DEMO_PASSWORD = 'KicksDemo@2026!';
const TAX_RATE = 0;

const stats = {
  created: 0,
  updated: 0,
};

const brandBlueprints = [
  { name: 'Nike', slug: 'nike', description: 'Performance-led sneakers built for everyday movement.', logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80' },
  { name: 'Adidas', slug: 'adidas', description: 'Iconic comfort and street-ready energy.', logo: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=600&q=80' },
  { name: 'Puma', slug: 'puma', description: 'Fast, expressive, and built for motion.', logo: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=600&q=80' },
  { name: 'New Balance', slug: 'new-balance', description: 'Comfort-first cushioning with a performance edge.', logo: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=600&q=80' },
  { name: 'ASICS', slug: 'asics', description: 'Engineered support for runners and everyday wearers.', logo: 'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=600&q=80' },
  { name: 'Converse', slug: 'converse', description: 'Classic silhouettes with modern utility.', logo: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=600&q=80' },
  { name: 'Jordan', slug: 'jordan', description: 'Heritage performance with unmistakable energy.', logo: 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?auto=format&fit=crop&w=600&q=80' },
  { name: 'Reebok', slug: 'reebok', description: 'Training-focused sneakers with clean design language.', logo: 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?auto=format&fit=crop&w=600&q=80' },
];

const categoryBlueprints = [
  { name: 'Running', slug: 'running', description: 'Built for speed, cushioning, and everyday miles.', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', parentId: null, sortOrder: 1, isActive: true },
  { name: 'Lifestyle', slug: 'lifestyle', description: 'Clean silhouettes for everyday wear.', image: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80', parentId: null, sortOrder: 2, isActive: true },
  { name: 'Basketball', slug: 'basketball', description: 'Explosive cushioning and court-ready support.', image: 'https://images.unsplash.com/photo-1511556820780-d912e42b4980?auto=format&fit=crop&w=900&q=80', parentId: null, sortOrder: 3, isActive: true },
  { name: 'Training', slug: 'training', description: 'Supportive performance designed for power and repetition.', image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80', parentId: null, sortOrder: 4, isActive: true },
  { name: 'Casual', slug: 'casual', description: 'Easy, refined sneakers for everyday rotation.', image: 'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=900&q=80', parentId: null, sortOrder: 5, isActive: true },
  { name: 'Men', slug: 'men', description: 'Performance and streetwear for men.', image: 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?auto=format&fit=crop&w=900&q=80', parentId: null, sortOrder: 6, isActive: true },
  { name: 'Women', slug: 'women', description: 'Comfortable flats, elevated runners, and everyday favorites.', image: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=80', parentId: null, sortOrder: 7, isActive: true },
  { name: 'New Arrivals', slug: 'new-arrivals', description: 'Fresh drops and limited-time favorites.', image: 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?auto=format&fit=crop&w=900&q=80', parentId: null, sortOrder: 8, isActive: true },
];

const productBlueprints = [
  { name: 'Nike Air Zoom Pegasus 41', brand: 'Nike', category: 'Running', gender: 'UNISEX', price: 12999, salePrice: 11499, featured: true, newArrival: true, bestSeller: true, tags: ['running', 'comfort', 'road'], shortDescription: 'Cushioned road runner for effortless daily miles.', description: 'The Pegasus 41 brings responsive cushioning and a stable ride for everyday training, commuting, and recovery miles.', seo: { title: 'Nike Air Zoom Pegasus 41 | KICKS DEMO', description: 'Responsive road running sneaker with soft cushioning and everyday comfort.' } },
  { name: 'Nike Air Force 1 Low', brand: 'Nike', category: 'Lifestyle', gender: 'MEN', price: 8899, salePrice: 7999, featured: true, newArrival: false, bestSeller: true, tags: ['lifestyle', 'classic', 'street'], shortDescription: 'An icon reworked for everyday wear.', description: 'A clean everyday leather sneaker with premium detailing and timeless appeal.', seo: { title: 'Nike Air Force 1 Low | KICKS DEMO', description: 'Classic sneaker with elevated comfort for street style and daily errands.' } },
  { name: 'Nike Zoom Vomero 5', brand: 'Nike', category: 'Running', gender: 'WOMEN', price: 14999, salePrice: 13499, featured: true, newArrival: true, bestSeller: false, tags: ['running', 'foam', 'daily'], shortDescription: 'Soft-yet-responsive cushioning for long hauls.', description: 'Built for those who want a soft landing and a fast, energized ride across the day.', seo: { title: 'Nike Zoom Vomero 5 | KICKS DEMO', description: 'High-cushion running shoe that feels soft underfoot and confident underfoot.' } },
  { name: 'Nike Pegasus Trail 4', brand: 'Nike', category: 'Running', gender: 'UNISEX', price: 13999, salePrice: 11999, featured: false, newArrival: true, bestSeller: false, tags: ['trail', 'running', 'grip'], shortDescription: 'Trail-ready grip without sacrificing everyday comfort.', description: 'A versatile trail runner combining responsive cushioning with dependable traction for mixed surfaces.', seo: { title: 'Nike Pegasus Trail 4 | KICKS DEMO', description: 'Trail-inspired comfort with everyday performance and traction.' } },
  { name: 'Nike Infinity Run 4', brand: 'Nike', category: 'Running', gender: 'UNISEX', price: 15999, salePrice: 14299, featured: false, newArrival: false, bestSeller: true, tags: ['running', 'support', 'daily'], shortDescription: 'Stability-led runner for smooth, effortless mileage.', description: 'The Infinity Run 4 keeps the ride smooth and supportive, making it a dependable choice for speed sessions and daily movement.', seo: { title: 'Nike Infinity Run 4 | KICKS DEMO', description: 'Long-distance trainer built for smooth transitions and soft support.' } },
  { name: 'Adidas Ultraboost 23', brand: 'Adidas', category: 'Running', gender: 'UNISEX', price: 16999, salePrice: 14999, featured: true, newArrival: true, bestSeller: true, tags: ['boost', 'running', 'comfort'], shortDescription: 'Cushioned daily trainer with premium energy return.', description: 'Ultraboost 23 blends soft comfort and energy return in a sleek silhouette built for everyday miles.', seo: { title: 'Adidas Ultraboost 23 | KICKS DEMO', description: 'Premium daily-run sneaker with responsive cushioning and everyday comfort.' } },
  { name: 'Adidas Samba OG', brand: 'Adidas', category: 'Lifestyle', gender: 'UNISEX', price: 7999, salePrice: 6999, featured: false, newArrival: false, bestSeller: true, tags: ['classic', 'street', 'lifestyle'], shortDescription: 'A heritage icon with a clean, effortless finish.', description: 'The Samba OG delivers a retro silhouette with modern comfort for everyday wear.', seo: { title: 'Adidas Samba OG | KICKS DEMO', description: 'Classic adidas silhouette made for everyday comfort and effortless styling.' } },
  { name: 'Adidas Superstar', brand: 'Adidas', category: 'Casual', gender: 'MEN', price: 7499, salePrice: 6499, featured: true, newArrival: false, bestSeller: true, tags: ['casual', 'classic', 'iconic'], shortDescription: 'A clean casual staple with an unmistakable profile.', description: 'The Superstar is a versatile favorite that balances heritage detailing and easy, everyday comfort.', seo: { title: 'Adidas Superstar | KICKS DEMO', description: 'Heritage casual sneaker built for relaxed, everyday styling.' } },
  { name: 'Adidas Adizero SL', brand: 'Adidas', category: 'Running', gender: 'WOMEN', price: 11999, salePrice: 10999, featured: false, newArrival: true, bestSeller: false, tags: ['speed', 'running', 'lightweight'], shortDescription: 'Lightweight speed feel for quick daily training.', description: 'Built for smooth transitions and light underfoot feel, the Adizero SL keeps sessions efficient and lively.', seo: { title: 'Adidas Adizero SL | KICKS DEMO', description: 'Lightweight daily trainer with a responsive, easy ride.' } },
  { name: 'Adidas NMD_R1', brand: 'Adidas', category: 'Lifestyle', gender: 'UNISEX', price: 12999, salePrice: 11699, featured: true, newArrival: false, bestSeller: false, tags: ['lifestyle', 'street', 'comfort'], shortDescription: 'A modern sneaker silhouette with layered comfort.', description: 'NMD_R1 blends soft cushioning with a futuristic shape that feels premium and practical.', seo: { title: 'Adidas NMD_R1 | KICKS DEMO', description: 'Street-ready sneaker with futuristic comfort and premium finish.' } },
  { name: 'Puma Velocity Nitro 3', brand: 'Puma', category: 'Running', gender: 'UNISEX', price: 10999, salePrice: 9999, featured: true, newArrival: true, bestSeller: false, tags: ['nitro', 'running', 'speed'], shortDescription: 'Fast-feeling runner with energised cushioning.', description: 'The Nitrolite setup helps keep each stride cushioned and responsive without adding bulk.', seo: { title: 'Puma Velocity Nitro 3 | KICKS DEMO', description: 'Responsive running trainer made for smooth speed and comfort.' } },
  { name: 'Puma RS-X', brand: 'Puma', category: 'Lifestyle', gender: 'MEN', price: 8999, salePrice: 7999, featured: true, newArrival: false, bestSeller: true, tags: ['street', 'lifestyle', 'design'], shortDescription: 'Layered cushioning and strong street styling.', description: 'An expressive everyday sneaker with layered comfort and bold accents for city movement.', seo: { title: 'Puma RS-X | KICKS DEMO', description: 'Chunky street runner with layered comfort and bold, modern styling.' } },
  { name: 'Puma Mx Speed Future', brand: 'Puma', category: 'Training', gender: 'WOMEN', price: 9999, salePrice: 8999, featured: false, newArrival: true, bestSeller: false, tags: ['training', 'power', 'motion'], shortDescription: 'Stable support for rep-heavy training days.', description: 'A hybrid sneaker with traction and structure for intense training sessions and dynamic movement.', seo: { title: 'Puma Mx Speed Future | KICKS DEMO', description: 'Performance training sneaker built for agility, traction, and power.' } },
  { name: 'New Balance 9060', brand: 'New Balance', category: 'Lifestyle', gender: 'UNISEX', price: 14999, salePrice: 13499, featured: true, newArrival: true, bestSeller: true, tags: ['retro', 'comfort', 'street'], shortDescription: 'Retro-inspired comfort with a reworked modern shape.', description: 'The 9060 merges retro design cues with layered cushioning and a refined everyday finish.', seo: { title: 'New Balance 9060 | KICKS DEMO', description: 'Retro-inspired sneaker with elevated comfort and layered cushioning.' } },
  { name: 'New Balance 530', brand: 'New Balance', category: 'Casual', gender: 'WOMEN', price: 9999, salePrice: 8799, featured: false, newArrival: false, bestSeller: true, tags: ['casual', 'comfort', 'everyday'], shortDescription: 'Soft everyday comfort with a minimal finish.', description: 'A relaxed silhouette for moving through daily errands with a soft underfoot feel.', seo: { title: 'New Balance 530 | KICKS DEMO', description: 'Minimal everyday sneaker with plush comfort and soft stability.' } },
  { name: 'New Balance FuelCell Propel', brand: 'New Balance', category: 'Running', gender: 'MEN', price: 12999, salePrice: 11899, featured: false, newArrival: true, bestSeller: false, tags: ['fuelcell', 'running', 'speed'], shortDescription: 'A responsive everyday running trainer with a springy ride.', description: 'Built for runners who want a lively ride without sacrificing support and cushioning.', seo: { title: 'New Balance FuelCell Propel | KICKS DEMO', description: 'Lively running trainer with springy cushioning and supportive fit.' } },
  { name: 'ASICS Gel-Kayano 30', brand: 'ASICS', category: 'Running', gender: 'UNISEX', price: 16999, salePrice: 15499, featured: true, newArrival: true, bestSeller: true, tags: ['running', 'stability', 'support'], shortDescription: 'Stability-first running comfort with soft cushioning.', description: 'A dependable trainer built for daily mileage, support, and smooth transitions through each step.', seo: { title: 'ASICS Gel-Kayano 30 | KICKS DEMO', description: 'Stability-focused trainer for everyday support and long-duration comfort.' } },
  { name: 'ASICS Nimbus 26', brand: 'ASICS', category: 'Running', gender: 'WOMEN', price: 15999, salePrice: 14499, featured: true, newArrival: false, bestSeller: true, tags: ['running', 'cushion', 'daily'], shortDescription: 'Soft-cushion ride with a smooth, floating feel.', description: 'A premium daily trainer designed for plush comfort and a smooth stride from start to finish.', seo: { title: 'ASICS Nimbus 26 | KICKS DEMO', description: 'Soft and smooth running shoe for long daily miles and relaxed comfort.' } },
  { name: 'ASICS GT-1000 13', brand: 'ASICS', category: 'Training', gender: 'MEN', price: 11999, salePrice: 10499, featured: false, newArrival: false, bestSeller: false, tags: ['training', 'support', 'stability'], shortDescription: 'Structured training support with a balanced, stable ride.', description: 'For controlled movement and dependable support, GT-1000 13 keeps training efficient and smooth.', seo: { title: 'ASICS GT-1000 13 | KICKS DEMO', description: 'Training sneaker with structured support and on-foot stability.' } },
  { name: 'Converse Chuck Taylor All Star', brand: 'Converse', category: 'Casual', gender: 'UNISEX', price: 6499, salePrice: 5699, featured: true, newArrival: false, bestSeller: true, tags: ['classic', 'casual', 'iconic'], shortDescription: 'A timeless classic for daily effortless styling.', description: 'This effortless classic fits right into a relaxed rotation with minimal effort and maximum versatility.', seo: { title: 'Converse Chuck Taylor All Star | KICKS DEMO', description: 'Heritage casual staple with timeless styling and all-day comfort.' } },
  { name: 'Converse Run Star Hike', brand: 'Converse', category: 'Lifestyle', gender: 'WOMEN', price: 9499, salePrice: 8499, featured: false, newArrival: true, bestSeller: false, tags: ['street', 'lifestyle', 'chunky'], shortDescription: 'Chunky profile with an elevated streetwear finish.', description: 'Built for easy styling and elevated everyday comfort, this silhouette adds volume without sacrificing wearability.', seo: { title: 'Converse Run Star Hike | KICKS DEMO', description: 'Chunky everyday sneaker with strong attitude and elevated comfort.' } },
  { name: 'Converse Star Player', brand: 'Converse', category: 'Training', gender: 'MEN', price: 7999, salePrice: 7099, featured: false, newArrival: false, bestSeller: false, tags: ['training', 'classic', 'stable'], shortDescription: 'A supportive everyday training essential.', description: 'The Star Player pairs familiar styling with the durable support needed for everyday movement.', seo: { title: 'Converse Star Player | KICKS DEMO', description: 'Classic training-inspired sneaker for daily movement and light support.' } },
  { name: 'Jordan 1 Retro High', brand: 'Jordan', category: 'Lifestyle', gender: 'MEN', price: 17999, salePrice: 16499, featured: true, newArrival: true, bestSeller: true, tags: ['jordan', 'street', 'heritage'], shortDescription: 'A heritage icon with a modern finish.', description: 'The Jordan 1 Retro High is built around a clean profile, premium leather finish, and everyday streetwear impact.', seo: { title: 'Jordan 1 Retro High | KICKS DEMO', description: 'Heritage-inspired sneaker with premium finish and streetwear energy.' } },
  { name: 'Jordan 4 Retro', brand: 'Jordan', category: 'Basketball', gender: 'UNISEX', price: 18999, salePrice: 17199, featured: true, newArrival: false, bestSeller: true, tags: ['basketball', 'heritage', 'performance'], shortDescription: 'Court-inspired comfort with heritage detailing.', description: 'A classic basketball silhouette built to blend heritage cues with performance comfort.', seo: { title: 'Jordan 4 Retro | KICKS DEMO', description: 'Basketball-inspired icon with heritage styling and comfortable support.' } },
  { name: 'Jordan Air M2', brand: 'Jordan', category: 'Basketball', gender: 'WOMEN', price: 13999, salePrice: 12499, featured: false, newArrival: true, bestSeller: false, tags: ['basketball', 'energy', 'daily'], shortDescription: 'A sleek court-inspired option for everyday movement.', description: 'Jordan Air M2 is a modern court-laced silhouette built for movement and impact.', seo: { title: 'Jordan Air M2 | KICKS DEMO', description: 'Modern court-inspired silhouette with responsive comfort.' } },
  { name: 'Reebok Club C 85', brand: 'Reebok', category: 'Lifestyle', gender: 'UNISEX', price: 7999, salePrice: 6999, featured: false, newArrival: false, bestSeller: true, tags: ['classic', 'everyday', 'minimal'], shortDescription: 'Vintage lines with a polished everyday feel.', description: 'Club C 85 is a refined classic that works effortlessly across casual and everyday looks.', seo: { title: 'Reebok Club C 85 | KICKS DEMO', description: 'Minimal lifestyle sneaker blending heritage details and easy comfort.' } },
  { name: 'Reebok Nano X4', brand: 'Reebok', category: 'Training', gender: 'MEN', price: 12999, salePrice: 11799, featured: true, newArrival: true, bestSeller: true, tags: ['training', 'performance', 'gym'], shortDescription: 'Training support with durable comfort and easy traction.', description: 'Nano X4 is designed for reps, movement, and daily training with a stable and supportive fit.', seo: { title: 'Reebok Nano X4 | KICKS DEMO', description: 'Training-ready performance sneaker with stable support and durable comfort.' } },
  { name: 'Reebok Zig Dynamica', brand: 'Reebok', category: 'Running', gender: 'WOMEN', price: 10999, salePrice: 9799, featured: false, newArrival: true, bestSeller: false, tags: ['running', 'support', 'dynamic'], shortDescription: 'Dynamic cushioning for an energetic ride.', description: 'A flexible, energetic runner built for quick strides and comfortable daily movement.', seo: { title: 'Reebok Zig Dynamica | KICKS DEMO', description: 'Dynamic cushioning runner built for smooth everyday momentum.' } },
];

const demoUsers = [
  { email: 'demo.superadmin@kicks.local', firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN' },
  { email: 'demo.admin@kicks.local', firstName: 'Demo', lastName: 'Admin', role: 'ADMIN' },
  { email: 'demo.customer1@kicks.local', firstName: 'Aisha', lastName: 'Patel', role: 'CUSTOMER' },
  { email: 'demo.customer2@kicks.local', firstName: 'Rohan', lastName: 'Sharma', role: 'CUSTOMER' },
  { email: 'demo.customer3@kicks.local', firstName: 'Meera', lastName: 'Nair', role: 'CUSTOMER' },
  { email: 'demo.customer4@kicks.local', firstName: 'Kabir', lastName: 'Menon', role: 'CUSTOMER' },
  { email: 'demo.customer5@kicks.local', firstName: 'Sana', lastName: 'Iqbal', role: 'CUSTOMER' },
  { email: 'demo.customer6@kicks.local', firstName: 'Nikhil', lastName: 'Reddy', role: 'CUSTOMER' },
  { email: 'demo.customer7@kicks.local', firstName: 'Anika', lastName: 'Joshi', role: 'CUSTOMER' },
  { email: 'demo.customer8@kicks.local', firstName: 'Yash', lastName: 'Singh', role: 'CUSTOMER' },
];

const demoCoupons = [
  { code: 'KICKS10', type: 'PERCENTAGE', value: 10, minCartValue: 2000, maxDiscount: 1000, expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180), usageLimit: 100, perUserLimit: 1, active: true, firstOrderOnly: false },
  { code: 'WELCOME500', type: 'FIXED', value: 500, minCartValue: 4000, maxDiscount: 500, expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120), usageLimit: 60, perUserLimit: 1, active: true, firstOrderOnly: true },
  { code: 'FIRSTKICKS', type: 'PERCENTAGE', value: 15, minCartValue: 3500, maxDiscount: 1500, expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 150), usageLimit: 50, perUserLimit: 1, active: true, firstOrderOnly: true },
  { code: 'BIGKICKS20', type: 'PERCENTAGE', value: 20, minCartValue: 5000, maxDiscount: 2000, expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 200), usageLimit: 40, perUserLimit: 2, active: true, firstOrderOnly: false },
  { code: 'RUNNING15', type: 'PERCENTAGE', value: 15, minCartValue: 3000, maxDiscount: 1200, expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), usageLimit: 30, perUserLimit: 1, active: true, firstOrderOnly: false },
];

const cmsBlocks = [
  { key: 'HOME_HERO', type: 'HERO', content: { title: 'Move Different', subtitle: 'The modern sneaker experience designed for motion.', ctaText: 'Shop now', ctaUrl: '/shop' }, sortOrder: 1, active: true },
  { key: 'ABOUT', type: 'FEATURED', content: { heading: 'More than just shoes', body: 'KICKS brings together premium craftsmanship, elevated design, and day-to-day comfort.' }, sortOrder: 2, active: true },
  { key: 'FAQ', type: 'BANNER', content: { heading: 'How can we help?', items: ['Shipping', 'Returns', 'Order tracking'] }, sortOrder: 3, active: true },
  { key: 'SHIPPING_POLICY', type: 'PROMOTION', content: { heading: 'Shipping policy', paragraphs: ['Standard delivery within 3-5 business days.', 'Express options available on eligible products.'] }, sortOrder: 4, active: true },
  { key: 'REFUND_POLICY', type: 'PROMOTION', content: { heading: 'Refund & cancellation', paragraphs: ['Easy returns for unused items.', 'Refunds processed within 5-7 business days.'] }, sortOrder: 5, active: true },
];

const blogPosts = [
  { title: 'How to Choose the Right Running Shoe', slug: 'how-to-choose-the-right-running-shoe', excerpt: 'A practical guide to picking the right cushioning, fit, and stability for everyday mileage.', content: 'Long-form editorial content for KICKS readers about cushioning, stability and fit.', seo: { title: 'How to Choose the Right Running Shoe', description: 'Understand cushioning, fit, and support before your next run.' }, status: 'PUBLISHED', tags: ['running', 'guide', 'training'] },
  { title: '5 Ways to Style White Sneakers', slug: '5-ways-to-style-white-sneakers', excerpt: 'Style white sneakers with relaxed denim, joggers, or elevated tailoring.', content: 'Editorial content on styling white sneakers across different outfits.', seo: { title: '5 Ways to Style White Sneakers', description: 'Ideas for pairing white sneakers with casual and smart looks.' }, status: 'PUBLISHED', tags: ['style', 'casual'] },
  { title: 'Running vs Lifestyle Sneakers', slug: 'running-vs-lifestyle-sneakers', excerpt: 'Compare support, cushioning, and everyday styling.', content: 'A comparison of technical running shoes and everyday lifestyle pairs.', seo: { title: 'Running vs Lifestyle Sneakers', description: 'Design and performance differences between running and lifestyle sneakers.' }, status: 'PUBLISHED', tags: ['running', 'lifestyle'] },
  { title: 'How to Clean Your Sneakers', slug: 'how-to-clean-your-sneakers', excerpt: 'Keep your favorite pairs fresh with a simple sneaker care routine.', content: 'A guide to cleaning leather, suede, and knit sneaker uppers safely.', seo: { title: 'How to Clean Your Sneakers', description: 'Learn quick sneaker care tips to keep your pairs fresh.' }, status: 'PUBLISHED', tags: ['care', 'maintenance'] },
  { title: 'Sneaker Size Guide', slug: 'sneaker-size-guide', excerpt: 'Learn how fit can vary across brands, materials, and last shapes.', content: 'A helpful overview of sizing, fit, and break-in expectations for sneaker shoppers.', seo: { title: 'Sneaker Size Guide', description: 'A practical guide to choosing your best sneaker size.' }, status: 'PUBLISHED', tags: ['guide', 'fit'] },
];

const addressTemplates = [
  { firstName: 'Aisha', lastName: 'Patel', phone: '9876543210', addressLine1: '87 Linden Avenue', addressLine2: 'Garden Block', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'India', isDefault: true },
  { firstName: 'Rohan', lastName: 'Sharma', phone: '9988776655', addressLine1: '12 Brigade Road', addressLine2: 'Near City Center', city: 'Bengaluru', state: 'Karnataka', postalCode: '560025', country: 'India', isDefault: true },
  { firstName: 'Meera', lastName: 'Nair', phone: '9123456789', addressLine1: '9 Warden Road', addressLine2: 'South Wing', city: 'Mumbai', state: 'Maharashtra', postalCode: '400020', country: 'India', isDefault: true },
  { firstName: 'Kabir', lastName: 'Menon', phone: '8765432109', addressLine1: '30 Skyline Heights', addressLine2: 'Rosewood Lane', city: 'Hyderabad', state: 'Telangana', postalCode: '500032', country: 'India', isDefault: true },
  { firstName: 'Sana', lastName: 'Iqbal', phone: '7654321098', addressLine1: '8 Silver Oaks', addressLine2: 'A Block', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'India', isDefault: true },
];

const notificationBlueprints = [
  { type: 'WELCOME', title: 'Welcome to KICKS', message: 'Your new KICKS account is ready. Start exploring the latest drops.' },
  { type: 'ORDER', title: 'Order confirmed', message: 'Your order has been confirmed and is being prepared for dispatch.' },
  { type: 'SHIPPING', title: 'Order shipped', message: 'Your pair has left our warehouse and is on the way.' },
  { type: 'NEW_ARRIVAL', title: 'New arrivals are live', message: 'Fresh sneakers just landed. Check out the latest KICKS release.' },
];

const orderSeedSpecs = [
  { orderNumber: 'KICKS-DEMO-001', userEmail: 'demo.customer1@kicks.local', status: 'PENDING', paymentStatus: 'PENDING' },
  { orderNumber: 'KICKS-DEMO-002', userEmail: 'demo.customer2@kicks.local', status: 'CONFIRMED', paymentStatus: 'PAID' },
  { orderNumber: 'KICKS-DEMO-003', userEmail: 'demo.customer3@kicks.local', status: 'SHIPPED', paymentStatus: 'PAID' },
  { orderNumber: 'KICKS-DEMO-004', userEmail: 'demo.customer4@kicks.local', status: 'DELIVERED', paymentStatus: 'PAID' },
];

async function ensureDoc(Model, query, data, label) {
  const existing = await Model.findOne(query).lean();
  if (existing) {
    await Model.updateOne(query, { $set: data }, { upsert: true });
    stats.updated += 1;
    return existing;
  }

  const created = await Model.create(data);
  stats.created += 1;
  if (label) {
    console.log(`${label}: created`);
  }
  return created;
}

const toSlug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const buildVariantList = (productIndex, basePrice, salePrice, colorSet = ['Black', 'White', 'Grey']) => {
  const sizes = ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'];
  const colors = colorSet.length ? colorSet : ['Black', 'White', 'Grey'];

  return sizes.slice(0, 4).map((size, index) => {
    const color = colors[index % colors.length];
    const variantStock = [5, 7, 9, 4, 6][index % 5] + (productIndex % 3);
    return {
      sku: `KICKS-DEMO-${String(productIndex + 1).padStart(3, '0')}-${color.slice(0, 3).toUpperCase()}-${size.replace(/\D+/g, '')}`,
      size,
      color,
      price: basePrice,
      salePrice: salePrice || null,
      stock: variantStock,
      images: [`https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80`, `https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80`],
      status: 'ACTIVE',
    };
  });
};

const userMap = new Map();
const brandMap = new Map();
const categoryMap = new Map();

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const user of demoUsers) {
    const saved = await ensureDoc(
      User,
      { email: user.email.toLowerCase() },
      {
        ...user,
        email: user.email.toLowerCase(),
        password: passwordHash,
        phone: '+91 90000 00000'.replace('00000', String(Math.floor(Math.random() * 90000) + 10000)),
        isActive: true,
        emailVerified: true,
        avatar: '',
      },
      'User',
    );

    userMap.set(user.email.toLowerCase(), saved);
  }
}

async function seedBrandsAndCategories() {
  for (const brand of brandBlueprints) {
    const saved = await ensureDoc(Brand, { slug: brand.slug }, { ...brand, isActive: true }, 'Brand');
    brandMap.set(brand.name, saved);
  }

  for (const category of categoryBlueprints) {
    const saved = await ensureDoc(Category, { slug: category.slug }, category, 'Category');
    categoryMap.set(category.name, saved);
  }
}

async function seedProducts() {
  const imagePool = [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1000&q=80',
  ];

  for (const [index, blueprint] of productBlueprints.entries()) {
    const brand = brandMap.get(blueprint.brand);
    const category = categoryMap.get(blueprint.category);
    if (!brand || !category) continue;

    const slug = toSlug(blueprint.name);
    const variants = buildVariantList(index, blueprint.price, blueprint.salePrice, ['Black', 'White', 'Grey']);
    const payload = {
      name: blueprint.name,
      slug,
      brand: brand._id,
      category: category._id,
      gender: blueprint.gender,
      description: blueprint.description,
      shortDescription: blueprint.shortDescription,
      images: imagePool.slice(index % imagePool.length, (index % imagePool.length) + 2),
      variants,
      tags: blueprint.tags,
      price: blueprint.price,
      salePrice: blueprint.salePrice,
      status: 'PUBLISHED',
      featured: Boolean(blueprint.featured),
      newArrival: Boolean(blueprint.newArrival),
      bestSeller: Boolean(blueprint.bestSeller),
      seo: {
        title: blueprint.seo.title,
        description: blueprint.seo.description,
        keywords: [...blueprint.tags, 'kicks', 'demo'],
      },
    };

    const product = await ensureDoc(Product, { slug }, payload, 'Product');

    for (const variant of product.variants || payload.variants) {
      const doc = await ensureDoc(
        Inventory,
        { product: product._id, variant: variant._id },
        {
          product: product._id,
          variant: variant._id,
          availableStock: variant.stock ?? 0,
          reservedStock: variant.stock > 7 ? 2 : 1,
          soldStock: Math.max(0, 12 - (variant.stock ?? 0)),
          lowStockThreshold: 5,
        },
        'Inventory',
      );

      await ensureDoc(
        InventoryMovement,
        { inventory: doc._id, product: product._id, variant: variant._id, reason: 'seed_demo' },
        {
          inventory: doc._id,
          product: product._id,
          variant: variant._id,
          type: 'RESTOCK',
          quantity: doc.availableStock,
          reason: 'seed_demo',
          metadata: { source: 'demo_seed' },
        },
        'InventoryMovement',
      );
    }
  }
}

async function seedCoupons() {
  for (const coupon of demoCoupons) {
    await ensureDoc(Coupon, { code: coupon.code }, { ...coupon, code: coupon.code.toUpperCase() }, 'Coupon');
  }
}

async function seedAddresses() {
  const userAddressMap = new Map();

  for (const [index, address] of addressTemplates.entries()) {
    const user = demoUsers[index % demoUsers.length];
    const userDoc = userMap.get(user.email.toLowerCase());
    if (!userDoc) continue;

    const saved = await ensureDoc(
      Address,
      { user: userDoc._id, addressLine1: address.addressLine1 },
      { user: userDoc._id, ...address },
      'Address',
    );

    userAddressMap.set(String(userDoc._id), saved);
  }

  return userAddressMap;
}

async function seedWishlistAndCart(userAddressMap) {
  const productIds = (await Product.find({ status: 'PUBLISHED' }).limit(6).lean()).map((item) => item._id);

  for (const user of demoUsers.slice(2, 8)) {
    const userDoc = userMap.get(user.email.toLowerCase());
    if (!userDoc) continue;

    await ensureDoc(
      Wishlist,
      { userId: userDoc._id },
      { userId: userDoc._id, productIds: productIds.slice(0, 3) },
      'Wishlist',
    );

    const cartItems = [];
    for (const productId of productIds.slice(0, 2)) {
      const productDoc = await Product.findById(productId);
      const variant = productDoc?.variants?.[0];
      cartItems.push({
        productId: productDoc?._id || productId,
        variantId: String(variant?._id || 'seed-variant'),
        size: variant?.size || 'UK 8',
        color: variant?.color || 'Black',
        quantity: 1,
        unitPrice: variant?.salePrice ?? variant?.price ?? 0,
      });
    }

    await ensureDoc(
      Cart,
      { userId: userDoc._id },
      { userId: userDoc._id, items: cartItems },
      'Cart',
    );

    userAddressMap.set(String(userDoc._id), userAddressMap.get(String(userDoc._id)) || null);
  }
}

async function seedBlogCmsNotifications() {
  for (const admin of demoUsers.filter((user) => user.role !== 'CUSTOMER')) {
    const adminDoc = userMap.get(admin.email.toLowerCase());
    if (!adminDoc) continue;

    for (const blog of blogPosts) {
      await ensureDoc(BlogPost, { slug: blog.slug }, { ...blog, author: adminDoc._id, coverImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80', publishedAt: new Date() }, 'Blog');
    }

    break;
  }

  for (const block of cmsBlocks) {
    await ensureDoc(CmsContent, { key: block.key }, { ...block }, 'CMS');
  }

  for (const user of demoUsers) {
    const userDoc = userMap.get(user.email.toLowerCase());
    if (!userDoc) continue;

    for (const [index, notification] of notificationBlueprints.entries()) {
      await ensureDoc(
        Notification,
        { user: userDoc._id, title: notification.title },
        {
          user: userDoc._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: { source: 'demo_seed', index },
          readAt: index === 0 ? null : new Date(),
        },
        'Notification',
      );
    }
  }
}

async function seedRecentlyViewed() {
  const demoProducts = await Product.find({ status: 'PUBLISHED' }).limit(4).lean();

  for (const user of demoUsers.slice(2, 6)) {
    const userDoc = userMap.get(user.email.toLowerCase());
    if (!userDoc) continue;

    const items = demoProducts.slice(0, 2).map((product, index) => ({
      product: product._id,
      viewedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
    }));

    await ensureDoc(
      RecentlyViewed,
      { user: userDoc._id },
      { user: userDoc._id, products: items },
      'RecentlyViewed',
    );
  }
}

async function seedOrders() {
  const allProducts = await Product.find({ status: 'PUBLISHED' }).lean();

  for (const spec of orderSeedSpecs) {
    const user = userMap.get(spec.userEmail.toLowerCase());
    if (!user) continue;

    const address = await Address.findOne({ user: user._id }).sort({ createdAt: -1 });
    if (!address) continue;

    const itemProducts = allProducts.slice(0, 2);
    const items = itemProducts.map((product, index) => {
      const variant = product.variants[0];
      const quantity = index === 0 ? 1 : 2;
      const unitPrice = variant.salePrice ?? variant.price ?? 0;
      return {
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        quantity,
        unitPrice,
        discount: 0,
        finalPrice: unitPrice * quantity,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + Number(item.finalPrice || 0), 0);
    const discountAmount = spec.paymentStatus === 'PAID' ? 500 : 0;
    const grandTotal = Math.max(subtotal - discountAmount + TAX_RATE, 0);

    const existingOrder = await Order.findOne({ orderNumber: spec.orderNumber }).lean();
    if (existingOrder) {
      stats.updated += 1;
      continue;
    }

    const order = await Order.create({
      user: user._id,
      orderNumber: spec.orderNumber,
      items,
      shippingAddress: { ...address.toObject(), _id: undefined },
      customerSnapshot: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '+91 99999 99999',
      },
      subtotal,
      discountAmount,
      shippingCharge: 0,
      tax: TAX_RATE,
      grandTotal,
      status: spec.status,
      paymentStatus: spec.paymentStatus,
      couponCode: '',
    });

    stats.created += 1;

    if (spec.paymentStatus === 'PAID') {
      await Payment.findOneAndUpdate(
        { order: order._id },
        {
          $set: {
            order: order._id,
            user: user._id,
            gateway: 'RAZORPAY',
            gatewayOrderId: `${spec.orderNumber}-gateway`,
            paymentId: `${spec.orderNumber}-pay`,
            amount: grandTotal,
            currency: 'INR',
            status: 'PAID',
            metadata: { source: 'demo_seed' },
          },
        },
        { upsert: true, new: true },
      );
    }

    if (['SHIPPED', 'DELIVERED'].includes(spec.status)) {
      await Shipment.findOneAndUpdate(
        { order: order._id },
        {
          $set: {
            order: order._id,
            provider: 'SHIPROCKET',
            shipmentId: `${spec.orderNumber}-shipment`,
            awb: `${spec.orderNumber}-AWB`,
            trackingUrl: `https://demo.kicks.local/track/${spec.orderNumber}`,
            status: spec.status,
            events: [{ status: spec.status, occurredAt: new Date(), source: 'demo_seed', metadata: { seeded: true } }],
            metadata: { source: 'demo_seed' },
          },
        },
        { upsert: true, new: true },
      );
    }
  }
}

async function seedReviews() {
  const deliveredOrder = await Order.findOne({ status: 'DELIVERED', paymentStatus: 'PAID' }).lean();
  if (!deliveredOrder) return;

  const product = await Product.findById(deliveredOrder.items[0].productId).lean();
  if (!product) return;

  const reviewData = {
    product: product._id,
    user: deliveredOrder.user,
    order: deliveredOrder._id,
    rating: 5,
    title: 'Premium fit and comfort',
    comment: 'The comfort and finish feel premium, and the fit suits everyday wear very well.',
    images: [product.images[0] || ''],
    status: 'APPROVED',
  };

  await ensureDoc(Review, { product: product._id, user: deliveredOrder.user, order: deliveredOrder._id }, reviewData, 'Review');
}

async function verifyDatabase() {
  const checks = [
    ['SUPER_ADMIN', await User.exists({ role: 'SUPER_ADMIN', email: 'demo.superadmin@kicks.local' })],
    ['ADMIN', await User.exists({ role: 'ADMIN', email: 'demo.admin@kicks.local' })],
    ['CUSTOMER_USERS', await User.countDocuments({ role: 'CUSTOMER' })],
    ['PRODUCTS', await Product.countDocuments({ status: 'PUBLISHED' })],
    ['BRANDS', await Brand.countDocuments() ],
    ['CATEGORIES', await Category.countDocuments() ],
    ['COUPONS', await Coupon.countDocuments() ],
    ['INVENTORY', await Inventory.countDocuments() ],
    ['ORDERS', await Order.countDocuments() ],
  ];

  for (const [label, value] of checks) {
    console.log(`${label}: ${value}`);
  }

  const skuDuplicates = await Product.aggregate([
    { $unwind: '$variants' },
    { $group: { _id: '$variants.sku', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'duplicates' },
  ]);
  console.log(`UNIQUE_SKU_DUPLICATES: ${skuDuplicates[0]?.duplicates || 0}`);
}

async function main() {
  if (env.nodeEnv === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    console.error('SEED BLOCKED: production seeding is disabled by default. Set ALLOW_SEED_IN_PRODUCTION=true to run explicitly in dev override mode.');
    process.exit(1);
  }

  if (env.nodeEnv !== 'development' && env.nodeEnv !== 'test') {
    console.warn(`SEED INFO: running in ${env.nodeEnv} mode. This script is intended for development usage.`);
  }

  if (!env.mongoUri) {
    throw new Error('MONGO_URI is not configured. Seed cannot continue without a database connection string.');
  }

  await connectDatabase();

  try {
    await seedUsers();
    await seedBrandsAndCategories();
    await seedProducts();
    await seedCoupons();
    const userAddressMap = await seedAddresses();
    await seedWishlistAndCart(userAddressMap);
    await seedBlogCmsNotifications();
    await seedRecentlyViewed();
    await seedOrders();
    await seedReviews();
    await verifyDatabase();

    console.log('');
    console.log('=====================================');
    console.log('KICKS DEMO SEED COMPLETE');
    console.log('=====================================');
    console.log(`SUPER_ADMIN: ${stats.created + stats.updated > 0 ? '1 verified' : 'not created'}`);
    console.log(`ADMIN: ${await User.exists({ role: 'ADMIN', email: 'demo.admin@kicks.local' }) ? '1 verified' : 'missing'}`);
    console.log(`CUSTOMERS: ${await User.countDocuments({ role: 'CUSTOMER' })}`);
    console.log(`BRANDS: ${await Brand.countDocuments()}`);
    console.log(`CATEGORIES: ${await Category.countDocuments()}`);
    console.log(`PRODUCTS: ${await Product.countDocuments({ status: 'PUBLISHED' })}`);
    console.log(`VARIANTS: ${await Product.aggregate([{ $unwind: '$variants' }, { $count: 'count' }]).then((rows) => rows[0]?.count || 0)}`);
    console.log(`COUPONS: ${await Coupon.countDocuments()}`);
    console.log(`ADDRESSES: ${await Address.countDocuments()}`);
    console.log(`WISHLISTS: ${await Wishlist.countDocuments()}`);
    console.log(`CARTS: ${await Cart.countDocuments()}`);
    console.log(`BLOG POSTS: ${await BlogPost.countDocuments()}`);
    console.log(`CMS RECORDS: ${await CmsContent.countDocuments()}`);
    console.log(`NOTIFICATIONS: ${await Notification.countDocuments()}`);
    console.log(`RECENTLY VIEWED: ${await RecentlyViewed.countDocuments()}`);
    console.log(`ORDERS: ${await Order.countDocuments()}`);
    console.log(`REVIEWS: ${await Review.countDocuments()}`);
    console.log('=====================================');
    console.log('DEMO LOGIN CREDENTIALS');
    console.log('=====================================');
    console.log('SUPER_ADMIN');
    console.log(`Email: demo.superadmin@kicks.local`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log('');
    console.log('ADMIN');
    console.log(`Email: demo.admin@kicks.local`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log('');
    console.log('CUSTOMER');
    console.log(`Email: demo.customer1@kicks.local`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log('=====================================');
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error('SEED FAILED');
  console.error(error);
  process.exit(1);
});
