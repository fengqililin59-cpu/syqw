import { productService } from '../services/product.service.js';
import { ok, fail } from '../utils/response.js';

export const listProducts = async (req, res) => {
  try {
    const result = await productService.listProducts(req.auth, req.query);
    ok(res, result);
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
};

export const getCategories = async (req, res) => {
  try {
    const result = await productService.getCategories(req.auth);
    ok(res, { categories: result });
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
};

export const getProduct = async (req, res) => {
  try {
    const result = await productService.getProduct(req.auth, req.params.id);
    ok(res, result);
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
};

export const createProduct = async (req, res) => {
  try {
    const result = await productService.createProduct(req.auth, req.body);
    ok(res, result, '创建成功');
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const result = await productService.updateProduct(req.auth, req.params.id, req.body);
    ok(res, result, '更新成功');
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const result = await productService.deleteProduct(req.auth, req.params.id);
    ok(res, result, '已删除');
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
};
