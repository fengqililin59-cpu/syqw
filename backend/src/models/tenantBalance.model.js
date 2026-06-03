/**
 * @file 租户余额账户。
 */
import { DataTypes, Model } from 'sequelize';

export class TenantBalance extends Model {
  static initModel(sequelize) {
    TenantBalance.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
        balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
        total_recharged: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
        total_consumed: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
      },
      {
        sequelize,
        modelName: 'TenantBalance',
        tableName: 'tenant_balances',
        underscored: true,
        timestamps: true,
      },
    );
    return TenantBalance;
  }
}
