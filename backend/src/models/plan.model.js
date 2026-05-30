/**
 * @file 套餐定义（系统级）。
 */
import { DataTypes, Model } from 'sequelize';

export class Plan extends Model {
  static initModel(sequelize) {
    Plan.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(50), allowNull: false },
        code: { type: DataTypes.STRING(32), allowNull: false, unique: true },
        price_monthly: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        price_yearly: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        customers_limit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: -1 },
        seats_limit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: -1 },
        broadcasts_monthly: { type: DataTypes.INTEGER, allowNull: false, defaultValue: -1 },
        ai_calls_monthly: { type: DataTypes.INTEGER, allowNull: false, defaultValue: -1 },
        features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        sort_order: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'Plan',
        tableName: 'plans',
        underscored: true,
        timestamps: true,
      },
    );
    return Plan;
  }
}
