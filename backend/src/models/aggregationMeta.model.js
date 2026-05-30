/**
 * @file 预聚合元数据（可读窗口）。
 */
import { DataTypes, Model } from 'sequelize';

export class AggregationMeta extends Model {
  static initModel(sequelize) {
    AggregationMeta.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        dataset: { type: DataTypes.STRING(64), allowNull: false },
        through_date: { type: DataTypes.DATEONLY, allowNull: false },
        earliest_date: { type: DataTypes.DATEONLY, allowNull: true },
      },
      {
        sequelize,
        modelName: 'AggregationMeta',
        tableName: 'aggregation_meta',
        underscored: true,
      },
    );
    return AggregationMeta;
  }
}
