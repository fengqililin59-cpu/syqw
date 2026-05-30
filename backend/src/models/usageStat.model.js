/**
 * @file 用量统计（月度）。
 */
import { DataTypes, Model } from 'sequelize';

export class UsageStat extends Model {
  static initModel(sequelize) {
    UsageStat.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        stat_month: { type: DataTypes.CHAR(7), allowNull: false },
        customers_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        seats_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        broadcasts_used: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        ai_calls_used: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'UsageStat',
        tableName: 'usage_stats',
        underscored: true,
        timestamps: true,
        createdAt: false,
        updatedAt: 'updated_at',
      },
    );
    return UsageStat;
  }
}
