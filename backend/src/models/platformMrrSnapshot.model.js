/**
 * @file 平台 MRR 月度快照。
 */
import { DataTypes, Model } from 'sequelize';

export class PlatformMrrSnapshot extends Model {
  static initModel(sequelize) {
    PlatformMrrSnapshot.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        snapshot_month: { type: DataTypes.CHAR(7), allowNull: false },
        mrr_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        active_subscriptions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        mrr_by_plan_json: { type: DataTypes.JSON, allowNull: false },
        captured_at: { type: DataTypes.DATE, allowNull: false },
      },
      {
        sequelize,
        modelName: 'PlatformMrrSnapshot',
        tableName: 'platform_mrr_snapshots',
        underscored: true,
        timestamps: true,
      },
    );
    return PlatformMrrSnapshot;
  }
}
