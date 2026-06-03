/**
 * @file 租户已购加购包。
 */
import { DataTypes, Model } from 'sequelize';

export class TenantUsageAddon extends Model {
  static initModel(sequelize) {
    TenantUsageAddon.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        addon_package_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        resource_type: { type: DataTypes.ENUM('customers', 'seats', 'broadcasts', 'ai_calls'), allowNull: false },
        quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        consumed: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        expires_at: { type: DataTypes.DATEONLY, allowNull: false },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        payment_record_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'TenantUsageAddon',
        tableName: 'tenant_usage_addons',
        underscored: true,
        timestamps: true,
        updatedAt: false,
      },
    );
    return TenantUsageAddon;
  }
}
