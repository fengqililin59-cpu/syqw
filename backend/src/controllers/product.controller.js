/**
 * @file 产品/服务项目控制器。
 * 错误统一交给 asyncHandler + errorHandler 处理：errorHandler 会识别 HttpError
 * 与数据库连接类异常并给出正确的 HTTP 状态码。
 */
import { productService } from '../services/product.service.js';
import { ok } from '../utils/response.js';

export const listProducts = async (req, res) => {
  ok(res, await productService.listProducts(req.auth, req.query));
};

export const getCategories = async (req, res) => {
  ok(res, { categories: await productService.getCategories(req.auth) });
};

export const getProduct = async (req, res) => {
  ok(res, await productService.getProduct(req.auth, req.params.id));
};

export const createProduct = async (req, res) => {
  ok(res, await productService.createProduct(req.auth, req.body), '创建成功');
};

export const updateProduct = async (req, res) => {
  ok(res, await productService.updateProduct(req.auth, req.params.id, req.body), '更新成功');
};

export const deleteProduct = async (req, res) => {
  ok(res, await productService.deleteProduct(req.auth, req.params.id), '已删除');
};
