/**
 * @file 充值面额配置。
 */
import { DataTypes, Model } from 'sequelize';

export class RechargePackage extends Model {
  static initModel(sequelize) {
    RechargePackage.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(50), allowNull: false },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        bonus: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
        sort_order: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      },
      {
        sequelize,
        modelName: 'RechargePackage',
        tableName: 'recharge_packages',
        underscored: true,
        timestamps: true,
        updatedAt: false,
      },
    );
    return RechargePackage;
  }
}
