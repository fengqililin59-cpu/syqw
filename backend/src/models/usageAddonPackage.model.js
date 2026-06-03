/**
 * @file 加购包配置。
 */
import { DataTypes, Model } from 'sequelize';

export class UsageAddonPackage extends Model {
  static initModel(sequelize) {
    UsageAddonPackage.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(50), allowNull: false },
        code: { type: DataTypes.STRING(32), allowNull: false, unique: true },
        resource_type: { type: DataTypes.ENUM('customers', 'seats', 'broadcasts', 'ai_calls'), allowNull: false },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        duration_months: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        sort_order: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      },
      {
        sequelize,
        modelName: 'UsageAddonPackage',
        tableName: 'usage_addon_packages',
        underscored: true,
        timestamps: true,
        updatedAt: false,
      },
    );
    return UsageAddonPackage;
  }
}
