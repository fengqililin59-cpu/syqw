/**
 * @file 标签模型（第 2 期功能预留）。
 */
import { DataTypes, Model } from 'sequelize';

export class Tag extends Model {
  static initModel(sequelize) {
    Tag.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name: { type: DataTypes.STRING(50), allowNull: false },
        color: { type: DataTypes.STRING(20), allowNull: true },
        category: { type: DataTypes.STRING(50), allowNull: true },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'Tag',
        tableName: 'tags',
        scopes: {
          tenant(tenantId) {
            return { where: { tenant_id: tenantId } };
          },
        },
      }
    );
    return Tag;
  }
}
