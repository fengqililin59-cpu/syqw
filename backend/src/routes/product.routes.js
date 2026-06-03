import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listProducts,
  getCategories,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';

const router = Router();

router.use(requireAuth);

// 分类列表（必须在 /:id 之前）
router.get('/categories', requirePerm('customer:read'), asyncHandler(getCategories));

// 产品列表
router.get('/', requirePerm('customer:read'), asyncHandler(listProducts));

// 产品详情
router.get('/:id', requirePerm('customer:read'), asyncHandler(getProduct));

// 创建产品
router.post('/', requirePerm('customer:manage'), asyncHandler(createProduct));

// 更新产品
router.put('/:id', requirePerm('customer:manage'), asyncHandler(updateProduct));

// 删除产品
router.delete('/:id', requirePerm('customer:manage'), asyncHandler(deleteProduct));

export default router;
