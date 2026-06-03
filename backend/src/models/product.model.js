/**
 * @file 产品/服务目录模型 — 全行业通用的产品管理。
 * metadata 为 JSON 字段，支持按行业扩展自定义属性。
 */
import { DataTypes, Model } from 'sequelize';

export class Product extends Model {
  static initModel(sequelize) {
    Product.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(200), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        category: { type: DataTypes.STRING(100), allowNull: true, comment: '产品分类' },
        unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0, comment: '单价' },
        unit: { type: DataTypes.STRING(20), allowNull: true, comment: '单位（件/套/次/人/小时等）' },
        is_active: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        image_url: { type: DataTypes.STRING(500), allowNull: true },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          comment: '行业自定义属性（如规格/型号/颜色等）',
        },
      },
      {
        sequelize,
        modelName: 'Product',
        tableName: 'products',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          { fields: ['tenant_id', 'category'] },
          { fields: ['tenant_id', 'is_active'] },
          { fields: ['tenant_id', 'name'] },
        ],
      },
    );
    return Product;
  }
}
