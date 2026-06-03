import { Product } from '../models/product.model.js';
import { Op } from 'sequelize';

export const productService = {
  /**
   * 产品列表 — 支持搜索、分类筛选、状态筛选、分页
   */
  async listProducts(auth, query = {}) {
    const { page = 1, limit = 20, keyword, category, is_active } = query;
    const offset = (Number(page) - 1) * Number(limit);
    const where = { tenant_id: auth.tenantId };

    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (category) where.category = category;
    if (is_active !== undefined && is_active !== null && is_active !== '') {
      where.is_active = is_active === 'true' || is_active === true ? 1 : 0;
    }

    const { rows, count } = await Product.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return {
      list: rows,
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / Number(limit)),
    };
  },

  /** 获取所有分类（去重） */
  async getCategories(auth) {
    const products = await Product.findAll({
      where: { tenant_id: auth.tenantId },
      attributes: ['category'],
      group: ['category'],
      raw: true,
    });
    return products.map((p) => p.category).filter(Boolean);
  },

  /** 产品详情 */
  async getProduct(auth, id) {
    const product = await Product.findOne({
      where: { id, tenant_id: auth.tenantId },
    });
    if (!product) throw Object.assign(new Error('产品不存在'), { status: 404 });
    return product;
  },

  /** 创建产品 */
  async createProduct(auth, body) {
    const { name, description, category, unit_price, unit, is_active, image_url, metadata } = body;
    if (!name) throw Object.assign(new Error('产品名称不能为空'), { status: 400 });

    const product = await Product.create({
      tenant_id: auth.tenantId,
      name,
      description: description || null,
      category: category || null,
      unit_price: unit_price != null ? Number(unit_price) : 0,
      unit: unit || null,
      is_active: is_active !== false ? 1 : 0,
      image_url: image_url || null,
      metadata: metadata || null,
    });
    return product;
  },

  /** 更新产品 */
  async updateProduct(auth, id, body) {
    const product = await Product.findOne({
      where: { id, tenant_id: auth.tenantId },
    });
    if (!product) throw Object.assign(new Error('产品不存在'), { status: 404 });

    const updatableFields = [
      'name', 'description', 'category', 'unit_price', 'unit',
      'is_active', 'image_url', 'metadata',
    ];
    const updates = {};
    for (const key of updatableFields) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }
    if (updates.is_active !== undefined) {
      updates.is_active = updates.is_active ? 1 : 0;
    }
    if (updates.unit_price !== undefined) {
      updates.unit_price = Number(updates.unit_price);
    }

    await product.update(updates);
    return product;
  },

  /** 删除产品 */
  async deleteProduct(auth, id) {
    const product = await Product.findOne({
      where: { id, tenant_id: auth.tenantId },
    });
    if (!product) throw Object.assign(new Error('产品不存在'), { status: 404 });

    await product.destroy();
    return { deleted: true };
  },
};
